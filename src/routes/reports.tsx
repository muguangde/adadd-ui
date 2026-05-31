import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileText,
  FlaskConical,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadJobs } from "@/lib/storage";
import type { Job, JobArtifact, JobStep } from "@/lib/types";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "历史报告 — ADADD" },
      { name: "description", content: "查看已完成的计算任务报告，浏览并下载结构预测、亲和力打分、免疫原性评估等产物文件。" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    const refresh = () => setJobs(loadJobs().filter((j) => j.status === "completed"));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("adadd:jobs-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("adadd:jobs-updated", refresh);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-6">
      <div className="mb-6 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">历史报告</h1>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
          暂无已完成的计算报告。完成一个计算任务后，报告会自动出现在这里。
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((j) => (
            <ReportCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ job }: { job: Job }) {
  const [openStep, setOpenStep] = useState<number | null>(null);
  const totalArtifacts = job.artifacts.length;
  const completedAt = job.finishedAt
    ? new Date(job.finishedAt).toLocaleString("zh-CN")
    : "—";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <h3 className="truncate text-base font-semibold">{job.name}</h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>靶点：<span className="text-foreground">{job.target}</span></span>
            <span>方法：<span className="text-foreground">{job.method}</span></span>
            <span>完成时间：<span className="text-foreground">{completedAt}</span></span>
            <Link
              to="/c/$threadId"
              params={{ threadId: job.threadId }}
              className="text-primary hover:underline"
            >
              查看对话
            </Link>
          </div>
        </div>
        {totalArtifacts > 0 && (
          <Badge variant="outline" className="shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
            {totalArtifacts} 个产物
          </Badge>
        )}
      </div>

      {/* Steps summary */}
      <ol className="mt-4 space-y-1.5">
        {job.steps.map((s, i) => {
          const stepArtifacts = job.artifacts.filter((a) => a.stepIndex === i);
          const expandable = !!(s.logs || stepArtifacts.length);
          const isOpen = openStep === i;
          return (
            <li key={i} className="rounded-md border border-border bg-background/30 text-xs">
              <button
                type="button"
                disabled={!expandable}
                onClick={() => setOpenStep(isOpen ? null : i)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left disabled:cursor-default"
              >
                <StepIcon status={s.status} />
                <span className="text-muted-foreground">第 {i + 1} 步</span>
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="text-muted-foreground">· {s.tool}</span>
                {stepArtifacts.length > 0 && (
                  <Badge variant="outline" className="ml-1 border-primary/40 bg-primary/10 text-[10px] text-primary">
                    {stepArtifacts.length} 个产物
                  </Badge>
                )}
                {expandable && (
                  <ChevronDown
                    className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>
              {isOpen && <StepDetails step={s} artifacts={stepArtifacts} />}
            </li>
          );
        })}
      </ol>

      {/* All artifacts download section */}
      {totalArtifacts > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">全部产物文件</span>
          </div>
          <div className="grid gap-1.5">
            {job.artifacts.map((a, i) => (
              <ArtifactRow key={i} artifact={a} />
            ))}
          </div>
        </div>
      )}

      {/* Empty artifacts hint */}
      {totalArtifacts === 0 && (
        <div className="mt-3 rounded-md border border-dashed border-border bg-background/20 p-3 text-center text-xs text-muted-foreground">
          <FlaskConical className="mx-auto mb-1 h-4 w-4" />
          该任务未产生可下载产物
        </div>
      )}
    </div>
  );
}

function StepDetails({ step, artifacts }: { step: JobStep; artifacts: JobArtifact[] }) {
  return (
    <div className="border-t border-border/60 px-3 py-3 space-y-3">
      {step.logs && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3 w-3" /> 运行日志
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed text-foreground/90">
            {step.logs}
          </pre>
        </div>
      )}
      {artifacts.length > 0 && (
        <div className="grid gap-1.5">
          {artifacts.map((a) => (
            <ArtifactRow key={a.name} artifact={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function ArtifactRow({ artifact: a }: { artifact: JobArtifact }) {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-background/40 p-2">
      <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground">{a.name}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {formatBytes(a.size)} · {a.mime}
      </span>
      <Button asChild size="sm" variant="outline" className="ml-1 h-7 shrink-0 gap-1 px-2 text-[11px]">
        <a href={a.dataUrl} download={a.name}>
          <Download className="h-3 w-3" /> 下载
        </a>
      </Button>
    </div>
  );
}

function StepIcon({ status }: { status: JobStep["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
