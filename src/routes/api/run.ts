import { createFileRoute } from "@tanstack/react-router";

import { getExecutor, stepDurationMs } from "@/lib/pipelines.server";
import type { ComputationPlan } from "@/lib/types";

type RunPayload = {
  jobId: string;
  plan: ComputationPlan;
  target: string;
  method: string;
};

function isValidPayload(x: unknown): x is RunPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.jobId === "string" &&
    typeof o.target === "string" &&
    typeof o.method === "string" &&
    !!o.plan &&
    typeof o.plan === "object" &&
    Array.isArray((o.plan as ComputationPlan).steps)
  );
}

export const Route = createFileRoute("/api/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        if (!isValidPayload(body)) {
          return new Response("invalid payload", { status: 400 });
        }
        const payload = body;
        const steps = payload.plan.steps.slice(0, 20); // safety cap

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const enc = new TextEncoder();
            const send = (evt: unknown) => {
              controller.enqueue(enc.encode(JSON.stringify(evt) + "\n"));
            };

            try {
              send({ type: "job_started" });
              for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                send({ type: "step_started", index: i });

                const { executor } = getExecutor(step.tool || step.name);
                const ctx = {
                  jobId: payload.jobId,
                  plan: payload.plan,
                  target: payload.target,
                  method: payload.method,
                  stepIndex: i,
                };

                // Simulate wall time + execute in parallel; await whichever is longer.
                const [result] = await Promise.all([
                  executor(step, ctx),
                  new Promise((r) => setTimeout(r, stepDurationMs(step))),
                ]);

                send({
                  type: "step_completed",
                  index: i,
                  logs: result.logs,
                  artifacts: result.artifacts,
                });
              }
              send({ type: "job_completed" });
            } catch (err) {
              send({
                type: "job_failed",
                error: err instanceof Error ? err.message : String(err),
              });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});