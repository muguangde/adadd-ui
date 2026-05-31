import { useChat } from "@ai-sdk/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Microscope, PanelRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { PlanCard } from "@/components/plan-card";
import { RequirementsPanel } from "@/components/requirements-panel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  createBlankThread,
  getThread,
  mergeRequirements,
  runJobOnServer,
  updateThread,
  upsertThread,
} from "@/lib/storage";
import type { ComputationPlan, RequirementItem, Thread } from "@/lib/types";

export const Route = createFileRoute("/c/$threadId")({
  head: () => ({
    meta: [
      { title: "研究对话 — ADADD" },
      { name: "description", content: "与 ADADD AI 助手对话，明确你的药物研究任务并生成计算方案。" },
    ],
  }),
  component: ChatThreadPage,
});

// ── <ACTION> block parser ─────────────────────────────────────────────────────

type ActionUpdateRequirements = {
  type: "update_requirements";
  items: RequirementItem[];
};
type ActionProposePlan = {
  type: "propose_plan";
  title: string;
  tools: string[];
  steps: ComputationPlan["steps"];
  confidence: ComputationPlan["confidence"];
  reasoning: string;
};
type Action = ActionUpdateRequirements | ActionProposePlan;

function parseActionBlocks(text: string): Action[] {
  const actions: Action[] = [];
  const re = /<ACTION>([\s\S]*?)<\/ACTION>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as Action;
      if (parsed?.type) actions.push(parsed);
    } catch {
      // malformed JSON — skip
    }
  }
  return actions;
}

/** Strip <ACTION>…</ACTION> blocks from visible text */
function stripActionBlocks(text: string): string {
  return text.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, "").trim();
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TextPart = { type: "text"; text: string };
type ToolPart = {
  type: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  state?: string;
  args?: unknown;
  result?: unknown;
};
type MessagePart = TextPart | ToolPart;

// ── Route components ──────────────────────────────────────────────────────────

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState<Thread | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [confirmedPlanId, setConfirmedPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let t = getThread(threadId);
    if (!t) {
      t = createBlankThread(threadId);
      upsertThread(t);
      window.dispatchEvent(new CustomEvent("adadd:threads-updated"));
    }
    setThread(t);
    setHydrated(true);
  }, [threadId]);

  if (!hydrated || !thread) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <ChatThreadView
      key={threadId}
      threadId={threadId}
      initial={thread}
      confirmedPlanId={confirmedPlanId}
      setConfirmedPlanId={setConfirmedPlanId}
      onGoJobs={() => navigate({ to: "/jobs" })}
    />
  );
}

function ChatThreadView({
  threadId,
  initial,
  confirmedPlanId,
  setConfirmedPlanId,
  onGoJobs,
}: {
  threadId: string;
  initial: Thread;
  confirmedPlanId: string | null;
  setConfirmedPlanId: (id: string | null) => void;
  onGoJobs: () => void;
}) {
  const [requirements, setRequirements] = useState<RequirementItem[]>(initial.requirements);
  const [plan, setPlan] = useState<ComputationPlan | null>(initial.plan);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initial.messages as UIMessage[],
    transport,
    onError: (e) => toast.error(e?.message ?? "请求出错"),
  });

  // Extract <ACTION> blocks from assistant text messages
  useEffect(() => {
    let mergedReqs: RequirementItem[] = initial.requirements;
    let latestPlan: ComputationPlan | null = initial.plan;

    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of (m.parts ?? []) as MessagePart[]) {
        if (part.type === "text") {
          const actions = parseActionBlocks((part as TextPart).text);
          for (const action of actions) {
            if (action.type === "update_requirements") {
              mergedReqs = mergeRequirements(mergedReqs, action.items);
            } else if (action.type === "propose_plan") {
              latestPlan = {
                id: `plan_${m.id}`,
                title: action.title,
                tools: action.tools ?? [],
                steps: action.steps ?? [],
                confidence: action.confidence ?? "medium",
                reasoning: action.reasoning ?? "",
                createdAt: Date.now(),
              };
            }
          }
        }
        // Legacy: also handle tool-call parts if present
        const t = (part as ToolPart).type ?? "";
        if (t.startsWith("tool-")) {
          const name = t.replace(/^tool-/, "") || (part as ToolPart).toolName;
          const data = ((part as ToolPart).input ?? (part as ToolPart).args) as {
            items?: RequirementItem[];
          } & Partial<ComputationPlan>;
          if (name === "update_requirements" && data?.items) {
            mergedReqs = mergeRequirements(mergedReqs, data.items);
          } else if (name === "propose_plan" && data?.title) {
            latestPlan = {
              id: `plan_${m.id}`,
              title: data.title!,
              tools: data.tools ?? [],
              steps: data.steps ?? [],
              confidence: (data.confidence as ComputationPlan["confidence"]) ?? "medium",
              reasoning: data.reasoning ?? "",
              createdAt: Date.now(),
            };
          }
        }
      }
    }

    setRequirements(mergedReqs);
    setPlan(latestPlan);
  }, [messages, initial.requirements, initial.plan]);

  // Persist on state change
  useEffect(() => {
    const title = deriveTitle(messages, initial.title);
    updateThread(threadId, {
      messages: messages as unknown[],
      requirements,
      plan,
      title,
    });
    window.dispatchEvent(new CustomEvent("adadd:threads-updated"));
  }, [messages, requirements, plan, threadId, initial.title]);

  // Focus textarea after status changes / thread switch
  useEffect(() => {
    const el = document.querySelector<HTMLTextAreaElement>(
      'textarea[name="message"]',
    );
    el?.focus();
  }, [threadId, status]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage({ text });
  };

  const handleConfirmPlan = () => {
    if (!plan) return;
    const target = requirements.find((r) => /靶|target/i.test(r.key))?.value ?? "—";
    const method = requirements.find((r) => /方法|method/i.test(r.key))?.value ?? plan.tools[0] ?? "—";
    void runJobOnServer(threadId, plan, target, method);
    setConfirmedPlanId(plan.id);
    toast.success("任务已提交至计算流水线，正在前往任务监控…");
    setTimeout(onGoJobs, 800);
  };

  const handleEditPlan = () => {
    setInput("我想修改方案：");
  };

  const isLoading = status === "submitted" || status === "streaming";

  const sidePanel = (
    <>
      <RequirementsPanel items={requirements} />
      {plan ? (
        <PlanCard
          plan={plan}
          onConfirm={handleConfirmPlan}
          onEdit={handleEditPlan}
          confirmed={confirmedPlanId === plan.id}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-4 text-xs text-muted-foreground">
          参数齐备后，AI 会在这里提出计算方案，由你确认运行。
        </div>
      )}
    </>
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Chat column */}
      <div className="flex min-h-0 flex-col">
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl">
            {messages.length === 0 && (
              <EmptyState />
            )}
            {messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {renderMessageParts(m.parts as MessagePart[])}
                </MessageContent>
              </Message>
            ))}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>正在思考…</Shimmer>
                </MessageContent>
              </Message>
            )}
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                出错：{error.message}
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-t border-border bg-background/60 p-3 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl">
            <PromptInput
              onSubmit={(_msg, e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="用一句话描述你的研究任务，例如：预测化合物 X 与靶点 Y 的结合亲和力…"
                disabled={isLoading}
                autoFocus
              />
              <PromptInputFooter className="justify-between">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 lg:hidden"
                    >
                      <PanelRight className="h-3.5 w-3.5" />
                      需求 / 方案
                      {plan && (
                        <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                          1
                        </span>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[min(420px,92vw)] overflow-y-auto bg-sidebar/95 p-4">
                    <SheetHeader className="mb-3 p-0">
                      <SheetTitle className="text-sm">研究面板</SheetTitle>
                    </SheetHeader>
                    <div className="flex flex-col gap-3">{sidePanel}</div>
                  </SheetContent>
                </Sheet>
                <span className="hidden lg:block" />
                <PromptInputSubmit status={status} disabled={!input.trim() || isLoading} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>

      {/* Side panel */}
      <aside className="hidden flex-col gap-3 overflow-y-auto border-l border-border bg-sidebar/40 p-4 lg:flex">
        {sidePanel}
      </aside>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

const EXAMPLE_TASKS = [
  "优化曲妥珠单抗 CDR-H3 区域的 HER2 结合亲和力，使用 ODBO 多轮迭代",
  "预测候选抗体 VH 序列与 PD-1 靶点的复合物结构，评估结合 ΔΔG",
  "对 20 个 CDR 突变体做免疫原性风险评估和人源化打分",
  "从 wt_vh.fasta 出发，IgLM 生成 100 个多样性候选，FoldX 打分筛选 Top-10",
];

function EmptyState() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center pt-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Microscope className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">描述你的抗体研究任务</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        ADADD 平台通过 LangGraph 编排 8 个 Agent 节点——结构预测、突变生成、亲和力打分、
        ODBO 迭代优化、免疫原性评估、MD 验证。告诉 AI 助手你的研究目标，
        助手会逐步确认参数并为你选择合适的节点组合。
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[10px]">
        {[
          { label: "结构预测", color: "bg-blue-900/40 text-blue-300 border-blue-700/50" },
          { label: "突变生成", color: "bg-violet-900/40 text-violet-300 border-violet-700/50" },
          { label: "亲和力打分", color: "bg-teal-900/40 text-teal-300 border-teal-700/50" },
          { label: "ODBO 优化", color: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50" },
          { label: "免疫原性", color: "bg-amber-900/40 text-amber-300 border-amber-700/50" },
          { label: "MD 验证", color: "bg-rose-900/40 text-rose-300 border-rose-700/50" },
        ].map((s) => (
          <span
            key={s.label}
            className={`rounded border px-2 py-0.5 font-medium ${s.color}`}
          >
            {s.label}
          </span>
        ))}
      </div>

      <div className="mt-5 w-full space-y-2 text-left">
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          示例任务
        </p>
        {EXAMPLE_TASKS.map((task) => (
          <button
            key={task}
            type="button"
            className="w-full rounded-md border border-border bg-card/40 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            onClick={() => {
              const ta = document.querySelector<HTMLTextAreaElement>(
                'textarea[name="message"]',
              );
              if (ta) {
                const nativeInput = Object.getOwnPropertyDescriptor(
                  window.HTMLTextAreaElement.prototype,
                  "value",
                )?.set;
                nativeInput?.call(ta, task);
                ta.dispatchEvent(new Event("input", { bubbles: true }));
                ta.focus();
              }
            }}
          >
            {task}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Message rendering ─────────────────────────────────────────────────────────

function renderMessageParts(parts: MessagePart[] = []) {
  return (
    <>
      {parts.map((part, i) => {
        const t = part.type ?? "";

        if (t === "text") {
          const rawText = (part as TextPart).text ?? "";
          // Collect inline action indicators before stripping
          const actions = parseActionBlocks(rawText);
          const visibleText = stripActionBlocks(rawText);

          return (
            <div key={i}>
              {/* Inline action badges */}
              {actions.map((action, j) => {
                const label =
                  action.type === "update_requirements"
                    ? "已更新需求摘要 →"
                    : action.type === "propose_plan"
                      ? "已提出计算方案 →"
                      : (action as { type: string }).type;
                return (
                  <div
                    key={j}
                    className="mb-1 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {label}
                  </div>
                );
              })}
              {visibleText && (
                <div className="max-w-none break-words text-sm leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:font-semibold [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline">
                  <Streamdown>{visibleText}</Streamdown>
                </div>
              )}
            </div>
          );
        }

        // Legacy tool-call parts
        if (t.startsWith("tool-")) {
          const name = t.replace(/^tool-/, "");
          const label =
            name === "update_requirements"
              ? "已更新需求摘要"
              : name === "propose_plan"
                ? "已提出计算方案"
                : name;
          return (
            <div
              key={i}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {label} →
            </div>
          );
        }

        return null;
      })}
    </>
  );
}

function deriveTitle(messages: UIMessage[], fallback: string): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return fallback;
  const parts = (first.parts ?? []) as { type: string; text?: string }[];
  const text = parts.find((p) => p.type === "text")?.text ?? "";
  if (!text) return fallback;
  return text.length > 30 ? text.slice(0, 30) + "…" : text;
}
