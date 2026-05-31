import type { Job, JobArtifact, RequirementItem, ComputationPlan, Thread, WetLabReport, ResearchFile } from "./types";

const THREADS_KEY = "adadd.threads.v1";
const JOBS_KEY = "adadd.jobs.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadThreads(): Thread[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(THREADS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Thread[];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  window.dispatchEvent(new CustomEvent("adadd:threads-updated"));
}

export function getThread(id: string): Thread | null {
  return loadThreads().find((t) => t.id === id) ?? null;
}

export function upsertThread(thread: Thread) {
  const all = loadThreads();
  const idx = all.findIndex((t) => t.id === thread.id);
  if (idx >= 0) all[idx] = thread;
  else all.unshift(thread);
  saveThreads(all);
}

export function deleteThread(id: string) {
  saveThreads(loadThreads().filter((t) => t.id !== id));
}

export function newThreadId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createBlankThread(id?: string): Thread {
  return {
    id: id ?? newThreadId(),
    title: "新的研究任务",
    updatedAt: Date.now(),
    messages: [],
    requirements: [],
    plan: null,
  };
}

export function updateThread(id: string, patch: Partial<Thread>) {
  const existing = getThread(id);
  if (!existing) return;
  upsertThread({ ...existing, ...patch, updatedAt: Date.now() });
}

export function mergeRequirements(
  current: RequirementItem[],
  incoming: RequirementItem[],
): RequirementItem[] {
  const map = new Map<string, string>();
  for (const r of current) map.set(r.key, r.value);
  for (const r of incoming) map.set(r.key, r.value);
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}

// Jobs
export function loadJobs(): Job[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(JOBS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Job[];
  } catch {
    return [];
  }
}

export function saveJobs(jobs: Job[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  window.dispatchEvent(new CustomEvent("adadd:jobs-updated"));
}

export function addJob(job: Job) {
  const all = loadJobs();
  all.unshift(job);
  saveJobs(all);
}

export function updateJob(id: string, patch: Partial<Job>) {
  const all = loadJobs();
  const idx = all.findIndex((j) => j.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  saveJobs(all);
}

export function createJobFromPlan(
  threadId: string,
  plan: ComputationPlan,
  target: string,
  method: string,
): Job {
  const job: Job = {
    id: `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    threadId,
    name: plan.title,
    target,
    method,
    status: "queued",
    currentStep: 0,
    steps: plan.steps.map((s) => ({ name: s.name, tool: s.tool, status: "pending" })),
    artifacts: [],
    startedAt: Date.now(),
  };
  addJob(job);
  return job;
}

/**
 * Start a job and stream real backend progress from /api/run.
 * Backend uses a pluggable pipeline registry; each step yields logs + artifacts.
 */
export async function runJobOnServer(
  threadId: string,
  plan: ComputationPlan,
  target: string,
  method: string,
): Promise<Job> {
  const job = createJobFromPlan(threadId, plan, target, method);

  // Fire-and-forget; updates Job in localStorage as events arrive.
  void streamJobEvents(job.id, plan, target, method).catch((err) => {
    console.error("[adadd] pipeline stream failed", err);
    updateJob(job.id, {
      status: "failed",
      finishedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return job;
}

async function streamJobEvents(
  jobId: string,
  plan: ComputationPlan,
  target: string,
  method: string,
) {
  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, plan, target, method }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`pipeline request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        applyJobEvent(jobId, JSON.parse(line));
      } catch (e) {
        console.warn("[adadd] bad event line", line, e);
      }
    }
  }
}

type JobEvent =
  | { type: "job_started" }
  | { type: "step_started"; index: number }
  | {
      type: "step_completed";
      index: number;
      logs: string;
      artifacts: { name: string; mime: string; dataBase64: string }[];
    }
  | { type: "step_failed"; index: number; error: string }
  | { type: "job_completed" }
  | { type: "job_failed"; error: string };

function applyJobEvent(jobId: string, evt: JobEvent) {
  const all = loadJobs();
  const job = all.find((j) => j.id === jobId);
  if (!job) return;

  switch (evt.type) {
    case "job_started":
      job.status = "running";
      break;
    case "step_started":
      job.currentStep = evt.index;
      if (job.steps[evt.index]) {
        job.steps[evt.index].status = "running";
        job.steps[evt.index].startedAt = Date.now();
      }
      break;
    case "step_completed": {
      const step = job.steps[evt.index];
      if (step) {
        step.status = "done";
        step.finishedAt = Date.now();
        step.logs = evt.logs;
      }
      const newArtifacts: JobArtifact[] = evt.artifacts.map((a) => ({
        stepIndex: evt.index,
        name: a.name,
        mime: a.mime,
        dataUrl: `data:${a.mime};base64,${a.dataBase64}`,
        size: approximateBytesFromBase64(a.dataBase64),
      }));
      job.artifacts = [...job.artifacts, ...newArtifacts];
      break;
    }
    case "step_failed": {
      const step = job.steps[evt.index];
      if (step) {
        step.status = "failed";
        step.error = evt.error;
        step.finishedAt = Date.now();
      }
      break;
    }
    case "job_completed":
      job.status = "completed";
      job.finishedAt = Date.now();
      break;
    case "job_failed":
      job.status = "failed";
      job.error = evt.error;
      job.finishedAt = Date.now();
      break;
  }
  saveJobs(all);
}

function approximateBytesFromBase64(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

// WetLab Reports
const WETLAB_KEY = "adadd.wetlab.v1";

export function loadWetLabReports(): WetLabReport[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(WETLAB_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WetLabReport[];
  } catch {
    return [];
  }
}

export function saveWetLabReports(reports: WetLabReport[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(WETLAB_KEY, JSON.stringify(reports));
  window.dispatchEvent(new CustomEvent("adadd:wetlab-updated"));
}

export function addWetLabReport(report: WetLabReport) {
  const all = loadWetLabReports();
  all.unshift(report);
  saveWetLabReports(all);
}

export function deleteWetLabReport(id: string) {
  saveWetLabReports(loadWetLabReports().filter((r) => r.id !== id));
}

// Research Files (PDB, FASTA, SDF, MOL2, CIF, XYZ, …)
const RESEARCH_FILES_KEY = "adadd.research_files.v1";

export function loadResearchFiles(): ResearchFile[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(RESEARCH_FILES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ResearchFile[];
  } catch {
    return [];
  }
}

export function saveResearchFiles(files: ResearchFile[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(RESEARCH_FILES_KEY, JSON.stringify(files));
  window.dispatchEvent(new CustomEvent("adadd:research-files-updated"));
}

export function addResearchFile(file: ResearchFile) {
  const all = loadResearchFiles();
  all.unshift(file);
  saveResearchFiles(all);
}

export function deleteResearchFile(id: string) {
  saveResearchFiles(loadResearchFiles().filter((f) => f.id !== id));
}