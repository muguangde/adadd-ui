import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileText,
  Loader2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { loadJobs } from "@/lib/storage";
import type { Job, JobArtifact, JobStep } from "@/lib/types";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "任务监控 — ADADD" },
      { name: "description", content: "查看正在运行与已完成的药物发现计算任务，实时追踪每个流水线步骤的状态。" },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    const refresh = () => setJobs(loadJobs());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("adadd:jobs-updated", refresh);
    const i = setInterval(refresh, 1000);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("adadd:jobs-updated", refresh);
      clearInterval(i);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-6">
      <div className="mb-6 flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">任务监控</h1>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
          暂无任务。前往对话页确认一个计算方案，即可在这里看到运行进度。
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const done = job.steps.filter((s) => s.status === "done").length;
  const pct = Math.round((done / Math.max(job.steps.length, 1)) * 100);
  const [openStep, setOpenStep] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{job.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>靶点：<span className="text-foreground">{job.target}</span></span>
            <span>方法：<span className="text-foreground">{job.method}</span></span>
            <span>启动：{new Date(job.startedAt).toLocaleString("zh-CN")}</span>
            <Link
              to="/c/$threadId"
              params={{ threadId: job.threadId }}
              className="text-primary hover:underline"
            >
              返回对话
            </Link>
          </div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="mt-4">
        <Progress value={pct} className="h-2" />
        <div className="mt-1 text-right text-[11px] text-muted-foreground">
          {done} / {job.steps.length} 步完成 · {pct}%
        </div>
      </div>

      <ol className="mt-4 space-y-1.5">
        {job.steps.map((s, i) => {
          const stepArtifacts = job.artifacts.filter((a) => a.stepIndex === i);
          const expandable = !!(s.logs || stepArtifacts.length || s.error);
          const isOpen = openStep === i;
          return (
            <li
              key={i}
              className="rounded-md border border-border bg-background/30 text-xs"
            >
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
              {isOpen && (
                <StepDetails step={s} artifacts={stepArtifacts} />
              )}
            </li>
          );
        })}
      </ol>

      {job.status === "failed" && job.error && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {job.error}
        </div>
      )}
    </div>
  );
}

function StepDetails({ step, artifacts }: { step: JobStep; artifacts: JobArtifact[] }) {
  return (
    <div className="border-t border-border/60 px-3 py-3 space-y-3">
      {step.error && (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive">
          {step.error}
        </div>
      )}
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
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">产物文件</div>
          <ul className="space-y-1.5">
            {artifacts.map((a) => (
              <li
                key={a.name}
                className="flex items-center gap-2 rounded border border-border bg-background/40 p-2"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-[11px] text-foreground">{a.name}</span>
                <span className="text-[10px] text-muted-foreground">{formatBytes(a.size)} · {a.mime}</span>
                <Button asChild size="sm" variant="outline" className="ml-auto h-7 gap-1 px-2 text-[11px]">
                  <a href={a.dataUrl} download={a.name}>
                    <Download className="h-3 w-3" /> 下载
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function StatusBadge({ status }: { status: Job["status"] }) {
  const map: Record<Job["status"], { label: string; className: string }> = {
    queued: { label: "排队中", className: "bg-muted text-muted-foreground" },
    running: { label: "运行中", className: "bg-primary/20 text-primary border-primary/40" },
    completed: { label: "已完成", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
    failed: { label: "失败", className: "bg-destructive/20 text-destructive border-destructive/40" },
  };
  const cfg = map[status];
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function StepIcon({ status }: { status: JobStep["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}
