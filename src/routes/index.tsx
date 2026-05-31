import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { Beaker, FlaskConical, MessageSquarePlus, Workflow } from "lucide-react";

import logo from "@/assets/adadd-logo.png";
import { Button } from "@/components/ui/button";
import { createBlankThread, upsertThread } from "@/lib/storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADADD — 对话式药物发现 AI 平台" },
      { name: "description", content: "用自然语言描述你的药物研究任务，ADADD 自动生成计算方案并监控运行。" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  const startNew = () => {
    const t = createBlankThread();
    upsertThread(t);
    window.dispatchEvent(new CustomEvent("adadd:threads-updated"));
    navigate({ to: "/c/$threadId", params: { threadId: t.id } });
  };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-3xl text-center">
        <img
          src={logo}
          alt="ADADD logo"
          width={96}
          height={96}
          className="mx-auto mb-6 h-24 w-24"
        />
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          对话即流水线
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
          ADADD 是面向实验科学家的 AI 辅助药物发现与开发平台 ——
          用自然语言描述你的研究任务，AI 助手会逐步澄清参数、自动生成计算方案，并监控运行。
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={startNew} className="gap-2">
            <MessageSquarePlus className="h-5 w-5" />
            开始一项新研究
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate({ to: "/jobs" })}
          >
            查看任务监控
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
          {[
            {
              icon: Beaker,
              title: "需求澄清",
              desc: "AI 助手逐步引导你确认靶点、配体、方法与评分标准。",
            },
            {
              icon: Workflow,
              title: "方案生成",
              desc: "自动选择 AlphaFold、AutoDock、ESM-2 等工具，构建完整流水线。",
            },
            {
              icon: FlaskConical,
              title: "任务监控",
              desc: "实时追踪运行步骤、状态与产物。",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card/50 p-5 backdrop-blur"
            >
              <f.icon className="mb-3 h-6 w-6 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
