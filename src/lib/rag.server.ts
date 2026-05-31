/**
 * ADADD RAG Engine (server-only)
 *
 * Two-tier retrieval:
 *   Tier 1 (active): BM25-style keyword scoring against ADADD_TOOLS knowledge base.
 *   Tier 2 (stub):   Ollama nomic-embed-text semantic search — ready to enable.
 *
 * Usage in chat handler:
 *   const context = await ragSearch(userQuery, { topK: 5 });
 *   // inject context.prompt into system message
 */

import { ADADD_TOOLS, type AgentStage, type ToolEntry } from "./knowledge-base";

// ── BM25 constants ────────────────────────────────────────────────────────────
const K1 = 1.5;
const B = 0.75;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[（）()【】\[\]、，。：:""'']/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function buildCorpus(tools: ToolEntry[]): string[] {
  return tools.map((t) =>
    [
      t.name,
      t.description,
      t.use_cases.join(" "),
      t.when_to_recommend,
      t.keywords.join(" "),
    ].join(" "),
  );
}

const CORPUS = buildCorpus(ADADD_TOOLS);
const AVG_DOC_LEN =
  CORPUS.reduce((s, d) => s + tokenize(d).length, 0) / CORPUS.length;

function idf(term: string): number {
  const df = CORPUS.filter((d) => d.toLowerCase().includes(term)).length;
  return Math.log((CORPUS.length - df + 0.5) / (df + 0.5) + 1);
}

function bm25(query: string, docIndex: number): number {
  const qTerms = tokenize(query);
  const docTokens = tokenize(CORPUS[docIndex]);
  const docLen = docTokens.length;

  let score = 0;
  for (const term of qTerms) {
    const tf = docTokens.filter((t) => t === term).length;
    if (tf === 0) continue;
    const idfVal = idf(term);
    score +=
      idfVal * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (docLen / AVG_DOC_LEN))));
  }
  return score;
}

// ── Priority bonus ────────────────────────────────────────────────────────────
// Primary tools (priority=1) get a small score boost so they surface first
// when BM25 scores are similar.
function priorityBonus(tool: ToolEntry): number {
  return tool.priority === 1 ? 0.5 : tool.priority === 2 ? 0.2 : 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type RagResult = {
  tools: ToolEntry[];
  stages: AgentStage[];
  prompt: string; // ready-to-inject system prompt section
};

/**
 * Search the ADADD tool knowledge base for tools relevant to a user query.
 * Returns a formatted prompt section to inject into the LLM system message.
 */
export async function ragSearch(
  query: string,
  opts: { topK?: number; minScore?: number } = {},
): Promise<RagResult> {
  const { topK = 6, minScore = 0.1 } = opts;

  const scored = ADADD_TOOLS.map((tool, i) => ({
    tool,
    score: bm25(query, i) + priorityBonus(tool),
  }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // If BM25 returns nothing (very short / generic query), fall back to priority=1
  const results =
    scored.length > 0
      ? scored.map((x) => x.tool)
      : ADADD_TOOLS.filter((t) => t.priority === 1);

  const stages = [...new Set(results.map((t) => t.stage))] as AgentStage[];

  const prompt = formatRagContext(results);
  return { tools: results, stages, prompt };
}

function formatRagContext(tools: ToolEntry[]): string {
  if (tools.length === 0) return "";

  const lines = [
    "【ADADD 工具库参考（来自同行评审数据，请优先基于以下工具推荐，不要凭空创造工具名称）】",
  ];

  // Group by stage for readability
  const byStage = new Map<string, ToolEntry[]>();
  for (const t of tools) {
    const list = byStage.get(t.stage) ?? [];
    list.push(t);
    byStage.set(t.stage, list);
  }

  const stageLabels: Record<string, string> = {
    structure_prediction: "结构预测",
    mutation_generation: "突变/序列生成",
    affinity_scoring: "亲和力打分",
    bayesian_optimization: "贝叶斯迭代优化",
    immunogenicity: "免疫原性/可开发性",
    molecular_dynamics: "分子动力学",
    input: "输入处理",
    output: "输出报告",
  };

  for (const [stage, stageTools] of byStage) {
    lines.push(`\n▶ ${stageLabels[stage] ?? stage}`);
    for (const t of stageTools) {
      lines.push(`  • ${t.name}：${t.description}`);
      lines.push(`    适用场景：${t.when_to_recommend}`);
      lines.push(`    输入→输出：${t.inputs} → ${t.outputs}`);
    }
  }

  lines.push(
    "\n以上工具均来自 ADADD 工具库，有同行评审论文支撑。请严格从上述工具中选择，不要推荐未列出的工具（如商业黑箱工具 Schrödinger/WeMol 等）。",
  );

  return lines.join("\n");
}

// ── Tier 2: Ollama semantic search stub ──────────────────────────────────────
// Uncomment and call `semanticRagSearch` once nomic-embed-text is pulled:
//   ollama pull nomic-embed-text
//
// export async function semanticRagSearch(
//   query: string,
//   opts: { topK?: number } = {},
// ): Promise<RagResult> {
//   const { topK = 6 } = opts;
//
//   // 1. Embed the query
//   const embResp = await fetch("http://localhost:11434/api/embeddings", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ model: "nomic-embed-text", prompt: query }),
//   });
//   const { embedding: queryVec } = (await embResp.json()) as { embedding: number[] };
//
//   // 2. Pre-computed tool embeddings (run once and cache)
//   //    Replace with actual pre-computed vectors from scripts/embed-tools.ts
//   const toolEmbeddings: number[][] = await loadCachedToolEmbeddings();
//
//   // 3. Cosine similarity ranking
//   const scored = ADADD_TOOLS.map((tool, i) => ({
//     tool,
//     score: cosineSim(queryVec, toolEmbeddings[i]) + priorityBonus(tool),
//   }))
//     .sort((a, b) => b.score - a.score)
//     .slice(0, topK);
//
//   const results = scored.map((x) => x.tool);
//   return { tools: results, stages: [...new Set(results.map((t) => t.stage))], prompt: formatRagContext(results) };
// }
//
// function cosineSim(a: number[], b: number[]): number {
//   let dot = 0, normA = 0, normB = 0;
//   for (let i = 0; i < a.length; i++) {
//     dot += a[i] * b[i]; normA += a[i] ** 2; normB += b[i] ** 2;
//   }
//   return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
// }
