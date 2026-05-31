/**
 * /api/rag — Standalone RAG query endpoint
 *
 * Designed for future LangGraph integration: each LangGraph node can call
 * this endpoint to retrieve tool recommendations before executing its subtask.
 *
 * LangGraph wiring stub (Python side):
 *   from langgraph.graph import StateGraph
 *   async def structure_prediction_node(state):
 *       tools = requests.post("http://localhost:8080/api/rag",
 *           json={"query": state["task"], "stage": "structure_prediction"}).json()
 *       selected = tools["tools"][0]["name"]   # e.g. "Chai-1"
 *       return await run_tool(selected, state)
 */

import { createFileRoute } from "@tanstack/react-router";

import type { AgentStage } from "@/lib/types";
import { ragSearch } from "@/lib/rag.server";
import { getToolsByStage } from "@/lib/knowledge-base";

type RagRequest = {
  query: string;
  /** Optional: restrict results to a specific pipeline stage */
  stage?: AgentStage;
  topK?: number;
};

export const Route = createFileRoute("/api/rag")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const { query, stage, topK = 5 } = body as RagRequest;
        if (!query || typeof query !== "string") {
          return new Response(
            JSON.stringify({ error: "query is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // If stage is specified, return all tools for that stage directly
        if (stage) {
          const stageTools = getToolsByStage(stage);
          return Response.json({
            tools: stageTools,
            stages: [stage],
            source: "stage_filter",
          });
        }

        // Otherwise do BM25 retrieval
        const result = await ragSearch(query, { topK });
        return Response.json({
          tools: result.tools.map((t) => ({
            id: t.id,
            name: t.name,
            stage: t.stage,
            description: t.description,
            use_cases: t.use_cases,
            inputs: t.inputs,
            outputs: t.outputs,
            paper_ref: t.paper_ref,
            when_to_recommend: t.when_to_recommend,
            priority: t.priority,
          })),
          stages: result.stages,
          source: "bm25",
        });
      },

      /** List all available stages and tool counts */
      GET: async () => {
        const { ADADD_TOOLS } = await import("@/lib/knowledge-base");
        const summary: Record<string, number> = {};
        for (const t of ADADD_TOOLS) {
          summary[t.stage] = (summary[t.stage] ?? 0) + 1;
        }
        return Response.json({
          total_tools: ADADD_TOOLS.length,
          by_stage: summary,
          retrieval_method: "bm25",
          semantic_search_available: false,
          // Set to true after: ollama pull nomic-embed-text
        });
      },
    },
  },
});
