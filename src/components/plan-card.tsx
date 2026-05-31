import { CheckCircle2, Clock, Pencil, Workflow } from "lucide-react";

import { PipelineDAG } from "@/components/pipeline-dag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inferStageFromToolName } from "@/lib/knowledge-base";
import type { AgentStage, ComputationPlan } from "@/lib/types";

const confidenceMap = {
  low: { label: "低", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  medium: { label: "中", color: "bg-primary/20 text-primary border-primary/40" },
  high: { label: "高", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
};

/** Derive active pipeline stages from the plan steps */
function deriveActiveStages(plan: ComputationPlan): AgentStage[] {
  const stages = new Set<AgentStage>(["input", "output"]);
  for (const step of plan.steps) {
    const stage =
      step.agent_stage ?? inferStageFromToolName(step.tool || step.name);
    if (stage) stages.add(stage);
  }
  return [...stages];
}

export function PlanCard({
  plan,
  onConfirm,
  onEdit,
  confirmed,
}: {
  plan: ComputationPlan;
  onConfirm: () => void;
  onEdit: () => void;
  confirmed: boolean;
}) {
  const total = plan.steps.reduce((s, x) => s + x.estimated_minutes, 0);
  // Fallback to "medium" if LLM outputs a non-canonical confidence value
  const conf = confidenceMap[plan.confidence] ?? confidenceMap["medium"];
  const activeStages = deriveActiveStages(plan);

  return (
    <div className="rounded-xl border border-primary/40 bg-card p-4 shadow-lg shadow-primary/10">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">计算方案</h3>
        </div>
        <Badge variant="outline" className={conf.color}>
          置信度 {conf.label}
        </Badge>
      </div>

      <h4 className="text-base font-bold text-foreground">{plan.title}</h4>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {plan.tools.map((t) => (
          <Badge key={t} variant="secondary" className="text-[10px]">
            {t}
          </Badge>
        ))}
      </div>

      {/* ADADD LangGraph pipeline DAG */}
      <PipelineDAG activeStages={activeStages} />

      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" /> 预计总时长 {total} 分钟 · {plan.steps.length} 个步骤
      </div>

      <ol className="mt-3 space-y-2">
        {plan.steps.map((s, i) => {
          const stage =
            s.agent_stage ?? inferStageFromToolName(s.tool || s.name);
          return (
            <li
              key={i}
              className="rounded-md border border-border bg-background/40 p-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">
                  {i + 1}. {s.name}
                </span>
                <div className="flex items-center gap-1.5">
                  {stage && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      {stageLabel(stage)}
                    </span>
                  )}
                  <span className="text-muted-foreground">{s.estimated_minutes} 分钟</span>
                </div>
              </div>
              <div className="mt-1 text-muted-foreground">
                工具：<span className="text-foreground">{s.tool}</span>
              </div>
              <div className="mt-0.5 text-muted-foreground">
                输入：<span className="text-foreground">{s.inputs}</span> → 输出：
                <span className="text-foreground">{s.outputs}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 rounded-md border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">设计理由：</span> {plan.reasoning}
      </div>

      <div className="mt-4 flex gap-2">
        <Button className="flex-1 gap-1.5" onClick={onConfirm} disabled={confirmed}>
          <CheckCircle2 className="h-4 w-4" />
          {confirmed ? "已启动运行" : "确认并运行"}
        </Button>
        <Button variant="outline" onClick={onEdit} disabled={confirmed} className="gap-1.5">
          <Pencil className="h-4 w-4" /> 修改方案
        </Button>
      </div>
    </div>
  );
}

function stageLabel(stage: AgentStage): string {
  const map: Record<AgentStage, string> = {
    input: "输入",
    structure_prediction: "结构预测",
    mutation_generation: "突变生成",
    affinity_scoring: "亲和力打分",
    bayesian_optimization: "ODBO",
    immunogenicity: "免疫原性",
    molecular_dynamics: "MD验证",
    output: "输出",
  };
  return map[stage] ?? stage;
}
