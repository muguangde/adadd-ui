import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { ragSearch } from "@/lib/rag.server";

// ── System prompt ─────────────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `你是 ADADD 平台的抗体科研助手。

## 行为规则（严格遵守）

**规则1（最重要）：用户提供任何参数时，立即输出一个 <ACTION> 块记录它，然后再继续回复。**
**规则2：已记录的参数绝对不再要求用户重复提供。**
**规则3：每次只问一个新的缺失参数，不要列出多个问题。**
**规则4：靶蛋白、VH序列、CDR掩码三项都记录后，立即输出 propose_plan <ACTION> 块。**
**规则5：不要生成"请提供以下信息"列表，直接问单个问题。**

## <ACTION> 块格式（严格遵守，不能省略）

记录参数时输出：
<ACTION>{"type":"update_requirements","items":[{"key":"靶蛋白","value":"HER2"}]}</ACTION>

提出方案时输出：
<ACTION>{"type":"propose_plan","title":"方案名称","tools":["IgFold","FoldX"],"steps":[{"name":"结构预测","tool":"IgFold","estimated_minutes":10,"inputs":"VH序列","outputs":"PDB文件"},{"name":"亲和力打分","tool":"FoldX","estimated_minutes":5,"inputs":"PDB文件","outputs":"ΔΔG"}],"confidence":"high","reasoning":"一句话说明方案理由"}</ACTION>

**重要：**
**① <ACTION> 块必须是单行合法 JSON，整个块从 { 到 } 不得出现真实换行符。**
**② 字符串值内如需换行请用 \\n，绝不能用真实回车。**
**③ confidence 只能是 "low"、"medium"、"high" 三选一，不得用其他词。**
**④ reasoning 只写一句话，不要写多句。**

## ADADD 可用工具
- 结构预测：IgFold、Chai-1、ABodyBuilder3
- 突变生成：IgLM、ProteinMPNN、AntiFold、DiffAb
- 亲和力打分：FoldX、EvoEF2、ESM-IF1（三者并行 + TOPSIS 聚合）
- 迭代优化：ODBO（k-NN代理 + UCB采集函数）
- 免疫原性：NetMHCpan、BioPhi
- 分子动力学：GROMACS

## 参数收集顺序
1. 研究目标（亲和力成熟 / 结构预测 / 免疫原性评估）
2. 靶蛋白名称
3. VH 氨基酸序列
4. CDR 掩码区域（哪些 CDR 需要优化）
5. 候选数量（默认50）

用中文回复，简洁专业。`;

/** Extract last user message text for RAG */
function extractRagQuery(messages: UIMessage[]): string {
  return messages
    .filter((m) => m.role === "user")
    .slice(-2)
    .flatMap((m) =>
      ((m.parts ?? []) as { type: string; text?: string }[])
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? ""),
    )
    .join(" ")
    .trim();
}

/** Build a short RAG context (max 3 tools to save token budget) */
function buildShortRagContext(tools: Array<{ name: string; description: string; when_to_recommend: string }>): string {
  if (tools.length === 0) return "";
  const lines = ["【本次相关工具参考】"];
  for (const t of tools.slice(0, 3)) {
    lines.push(`• ${t.name}：${t.when_to_recommend}`);
  }
  return lines.join("\n");
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("缺少 messages 参数", { status: 400 });
        }

        const messages = body.messages as UIMessage[];

        // RAG: short context, max 3 tools to keep prompt compact
        const ragQuery = extractRagQuery(messages);
        const ragCtx = await ragSearch(ragQuery || "抗体亲和力优化", { topK: 3 });
        const ragSection = buildShortRagContext(ragCtx.tools);

        const systemPrompt = ragSection
          ? `${BASE_SYSTEM_PROMPT}\n\n${ragSection}`
          : BASE_SYSTEM_PROMPT;

        const gateway = createLovableAiGatewayProvider();
        const modelName = process.env.LOCAL_LLM_MODEL ?? "qwen2.5:7b";
        const model = gateway(modelName);

        const result = streamText({
          model,
          system: systemPrompt,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
        });
      },
    },
  },
});
