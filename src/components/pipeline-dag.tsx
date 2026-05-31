/**
 * PipelineDAG — visual representation of the ADADD 8-stage LangGraph pipeline.
 * Active stages (derived from plan steps) are highlighted.
 * Leaves LangGraph integration hook as comment for future wiring.
 */

import type { AgentStage } from "@/lib/types";

type StageConfig = {
  id: AgentStage;
  label: string;
  shortLabel: string;
  color: string;
  activeColor: string;
};

const STAGES: StageConfig[] = [
  {
    id: "input",
    label: "输入节点",
    shortLabel: "输入",
    color: "bg-slate-700/40 border-slate-600/50 text-slate-400",
    activeColor: "bg-slate-600/60 border-slate-400 text-slate-200",
  },
  {
    id: "structure_prediction",
    label: "结构预测 Agent",
    shortLabel: "结构预测",
    color: "bg-blue-950/40 border-blue-800/40 text-blue-400/70",
    activeColor: "bg-blue-900/60 border-blue-500 text-blue-200",
  },
  {
    id: "mutation_generation",
    label: "突变生成 Agent",
    shortLabel: "突变生成",
    color: "bg-violet-950/40 border-violet-800/40 text-violet-400/70",
    activeColor: "bg-violet-900/60 border-violet-500 text-violet-200",
  },
  {
    id: "affinity_scoring",
    label: "评分 Agent",
    shortLabel: "亲和力评分",
    color: "bg-teal-950/40 border-teal-800/40 text-teal-400/70",
    activeColor: "bg-teal-900/60 border-teal-400 text-teal-200",
  },
  {
    id: "bayesian_optimization",
    label: "ODBO 优化 Agent",
    shortLabel: "ODBO",
    color: "bg-emerald-950/40 border-emerald-800/40 text-emerald-400/70",
    activeColor: "bg-emerald-900/60 border-emerald-400 text-emerald-200",
  },
  {
    id: "immunogenicity",
    label: "免疫原性 Agent",
    shortLabel: "免疫原性",
    color: "bg-amber-950/40 border-amber-800/40 text-amber-400/70",
    activeColor: "bg-amber-900/60 border-amber-400 text-amber-200",
  },
  {
    id: "molecular_dynamics",
    label: "MD 验证 Agent",
    shortLabel: "MD 验证",
    color: "bg-rose-950/40 border-rose-800/40 text-rose-400/70",
    activeColor: "bg-rose-900/60 border-rose-400 text-rose-200",
  },
  {
    id: "output",
    label: "输出节点",
    shortLabel: "输出",
    color: "bg-slate-700/40 border-slate-600/50 text-slate-400",
    activeColor: "bg-slate-600/60 border-slate-400 text-slate-200",
  },
];

type Props = {
  /** Which stages are active in the current plan */
  activeStages: AgentStage[];
  /** Optional: highlight a stage that is currently running */
  runningStage?: AgentStage;
};

export function PipelineDAG({ activeStages, runningStage }: Props) {
  const activeSet = new Set(activeStages);

  return (
    <div className="mt-3 rounded-lg border border-border bg-background/30 p-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        ADADD LangGraph 流水线
      </p>

      {/* Horizontal scrollable DAG */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1">
        {STAGES.map((stage, i) => {
          const isActive = activeSet.has(stage.id);
          const isRunning = runningStage === stage.id;
          const isLast = i === STAGES.length - 1;

          return (
            <div key={stage.id} className="flex shrink-0 items-center">
              {/* Stage node */}
              <div
                className={`
                  relative flex min-w-[60px] flex-col items-center gap-0.5 rounded border px-2 py-1.5
                  text-center text-[10px] font-medium transition-all duration-200
                  ${isActive ? stage.activeColor : stage.color}
                  ${isRunning ? "animate-pulse ring-1 ring-current" : ""}
                `}
                title={stage.label}
              >
                <span className="leading-tight">{stage.shortLabel}</span>
                {isRunning && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-background" />
                )}
              </div>

              {/* Arrow connector */}
              {!isLast && (
                <svg
                  className={`mx-0.5 h-3 w-4 shrink-0 ${isActive ? "text-primary/60" : "text-border"}`}
                  viewBox="0 0 16 12"
                  fill="none"
                >
                  <path
                    d="M0 6h12M9 2l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Active stage count */}
      {activeSet.size > 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {activeSet.size} 个节点激活
          {/* LangGraph hook — replace with actual DAG execution status */}
          {/* TODO: import { useLangGraphRun } from "@adadd/langgraph-client" */}
        </p>
      )}
    </div>
  );
}
