/**
 * ADADD Tool Knowledge Base
 *
 * Ground truth for RAG-augmented tool recommendations.
 * Each entry maps to a node in the ADADD LangGraph DAG.
 * Source: ADADD tool stack v2_20260514 + peer-reviewed literature.
 */

export type AgentStage =
  | "input"
  | "structure_prediction"
  | "mutation_generation"
  | "affinity_scoring"
  | "bayesian_optimization"
  | "immunogenicity"
  | "molecular_dynamics"
  | "output";

export type ToolEntry = {
  id: string;
  name: string;
  stage: AgentStage;
  description: string;
  use_cases: string[];
  inputs: string;
  outputs: string;
  paper_ref: string;
  when_to_recommend: string;
  keywords: string[];
  priority: 1 | 2 | 3; // 1=primary, 2=secondary, 3=fallback
};

export const ADADD_TOOLS: ToolEntry[] = [
  // ── Structure Prediction ──────────────────────────────────────────────────
  {
    id: "chai1",
    name: "Chai-1",
    stage: "structure_prediction",
    description:
      "深度学习共折叠模型，可同时预测抗体-抗原复合物结构（VH/VL/靶点多链），优于 AlphaFold2 复合物预测精度。",
    use_cases: [
      "抗体-抗原复合物结构预测",
      "多链蛋白复合物建模",
      "候选抗体结构打分前处理",
    ],
    inputs: "VH/VL 氨基酸序列 + 靶抗原序列（FASTA 格式）",
    outputs: "CIF/PDB 复合物结构 + pLDDT 置信度评分",
    paper_ref: "Chai Discovery Team, 2024 (preprint, bioRxiv)",
    when_to_recommend: "用户需要预测抗体与靶蛋白的结合模式，或需要复合物结构作为后续打分的输入",
    keywords: [
      "抗体结构", "复合物预测", "共折叠", "chai", "structure prediction",
      "antibody", "antigen", "complex", "folding", "pLDDT",
    ],
    priority: 1,
  },
  {
    id: "igfold",
    name: "IgFold",
    stage: "structure_prediction",
    description:
      "专为抗体序列设计的快速结构预测模型，基于预训练抗体语言模型，推理速度比 AlphaFold2 快 10 倍。",
    use_cases: [
      "大批量候选抗体序列的快速结构预测",
      "CDR loop 构象采样",
      "前处理为 FoldX/EvoEF2 提供底物结构",
    ],
    inputs: "VH（可选 VL）氨基酸序列",
    outputs: "PDB 结构文件 + RMSD 评估",
    paper_ref: "Ruffolo et al., Nature Methods 2023",
    when_to_recommend: "需要快速预测大量候选抗体单链或 Fv 结构，且不需要复合物",
    keywords: [
      "igfold", "抗体结构", "快速预测", "CDR", "loop", "Fv",
      "antibody structure", "fast folding", "VH", "VL",
    ],
    priority: 1,
  },
  {
    id: "abodybuilder3",
    name: "ABodyBuilder3",
    stage: "structure_prediction",
    description: "Oxford 开发的抗体专用结构预测工具，集成多序列比对与深度学习，对 CDR-H3 loop 预测精度高。",
    use_cases: ["CDR-H3 loop 精确建模", "抗体可变区结构优化"],
    inputs: "VH + VL 配对序列",
    outputs: "PDB 结构 + 每个残基的 pLDDT 置信分",
    paper_ref: "Abanades et al., eLife 2024",
    when_to_recommend: "对 CDR-H3 loop 构象精度要求高时优先选用",
    keywords: [
      "abodybuilder", "CDR-H3", "loop modeling", "oxford", "抗体建模",
    ],
    priority: 2,
  },
  {
    id: "boltz2",
    name: "Boltz-2",
    stage: "structure_prediction",
    description: "开源生物分子结构预测模型，支持蛋白-蛋白、蛋白-小分子复合物，性能接近 AlphaFold3。",
    use_cases: ["蛋白-小分子复合物预测", "抗体-多肽结合建模"],
    inputs: "多链序列或 SMILES",
    outputs: "CIF 结构 + 置信度",
    paper_ref: "MIT/Recursion Boltz team, 2024",
    when_to_recommend: "涉及小分子配体或多肽靶点的复合物结构预测",
    keywords: ["boltz", "小分子", "复合物", "蛋白小分子", "ligand", "molecule"],
    priority: 2,
  },
  {
    id: "rfantibody",
    name: "RFantibody / RFdiffusion",
    stage: "structure_prediction",
    description: "基于扩散模型的抗体设计工具，支持 Motif-Scaffolding（固定 CDR 坐标生成新支架）。",
    use_cases: ["Motif-Scaffolding：固定 CDR 构象设计全新抗体骨架", "从头抗体设计"],
    inputs: "CDR 参考坐标（PDB）+ 约束条件",
    outputs: "候选抗体骨架 PDB 集合",
    paper_ref: "Watson et al., Nature 2023; Cao et al., 2024",
    when_to_recommend: "用户需要围绕已知有效 CDR 表位设计全新抗体骨架（motif-scaffolding）",
    keywords: [
      "rfantibody", "rfdiffusion", "diffusion", "motif", "scaffolding",
      "de novo", "从头设计", "骨架设计", "CDR motif",
    ],
    priority: 2,
  },

  // ── Mutation / Sequence Generation ───────────────────────────────────────
  {
    id: "iglm",
    name: "IgLM",
    stage: "mutation_generation",
    description:
      "抗体序列语言模型（CLM），可对指定 CDR 区域生成多样性候选突变序列，支持条件生成（固定框架区）。",
    use_cases: ["CDR 区域受控多样化", "亲和力成熟候选序列生成", "给定约束的序列补全"],
    inputs: "野生型 VH 序列 + 生成区域掩码（CDR-H1/H2/H3）",
    outputs: "多样性候选 VH 序列集合（FASTA）",
    paper_ref: "Shuai et al., PLOS Comp Biol 2023",
    when_to_recommend: "需要对 CDR 区域生成多样化候选时，是主力生成器",
    keywords: [
      "iglm", "序列生成", "CDR多样化", "亲和力成熟", "语言模型",
      "sequence generation", "CDR", "diversification", "affinity maturation",
    ],
    priority: 1,
  },
  {
    id: "proteinmpnn",
    name: "ProteinMPNN / AbMPNN",
    stage: "mutation_generation",
    description:
      "基于结构的逆折叠模型，给定蛋白骨架结构生成序列，AbMPNN 为抗体专用版本，对配体接触残基有特殊处理。",
    use_cases: ["基于结构的序列重新设计", "保留特定相互作用的突变生成"],
    inputs: "抗体 PDB 结构",
    outputs: "与结构兼容的候选序列集",
    paper_ref: "Dauparas et al., Science 2022",
    when_to_recommend: "有参考复合物结构，需要基于结构约束生成序列",
    keywords: [
      "proteinmpnn", "abmpnn", "逆折叠", "inverse folding", "结构设计",
      "structure-based design", "sequence design",
    ],
    priority: 1,
  },
  {
    id: "antifold",
    name: "AntiFold",
    stage: "mutation_generation",
    description: "专为抗体可变区设计的逆折叠模型，在 CDR 区域的序列恢复率优于 ProteinMPNN。",
    use_cases: ["抗体 CDR 区逆折叠设计", "与 IgFold 结构配合的序列优化"],
    inputs: "抗体 VH/VL PDB",
    outputs: "候选序列 + 每位置的概率分布",
    paper_ref: "Høie et al., Nature Comm 2024",
    when_to_recommend: "已有抗体结构，需要对 CDR 残基做精细序列优化",
    keywords: ["antifold", "逆折叠", "CDR", "序列优化", "antibody inverse folding"],
    priority: 2,
  },
  {
    id: "diffab",
    name: "DiffAb",
    stage: "mutation_generation",
    description: "扩散模型驱动的抗体设计框架，可同时在序列空间和结构空间联合采样 CDR 候选。",
    use_cases: ["CDR 协同序列-结构设计", "需要高多样性候选时的补充采样"],
    inputs: "抗体-抗原复合物 PDB",
    outputs: "CDR 设计候选集（序列 + 结构）",
    paper_ref: "Luo et al., ICML 2022",
    when_to_recommend: "需要序列-结构联合设计，或 IgLM/ProteinMPNN 候选多样性不足时",
    keywords: ["diffab", "扩散模型", "diffusion", "联合设计", "CDR design"],
    priority: 2,
  },
  {
    id: "iggm",
    name: "IgGM",
    stage: "mutation_generation",
    description:
      "大规模预训练抗体生成模型，在 OAS 数据库上训练，可生成高质量 VH/VL 配对序列。",
    use_cases: ["全新抗体序列生成", "配对 VH/VL 序列设计"],
    inputs: "条件信号（靶点、CDR 约束）或无条件",
    outputs: "VH/VL 配对候选序列集",
    paper_ref: "IgGM team, 2024",
    when_to_recommend: "需要生成全新配对抗体序列，或现有候选库多样性不足时补充采样",
    keywords: ["iggm", "抗体生成", "配对序列", "VH/VL", "generative model"],
    priority: 2,
  },

  // ── Affinity Scoring ─────────────────────────────────────────────────────
  {
    id: "foldx",
    name: "FoldX",
    stage: "affinity_scoring",
    description:
      "基于物理力场的快速 ΔΔG 计算工具，支持点突变、多点突变对稳定性和结合自由能的影响预测。",
    use_cases: ["突变 ΔΔG 计算", "结合亲和力变化预测", "热稳定性评估"],
    inputs: "蛋白复合物 PDB + 突变列表",
    outputs: "每个突变的 ΔΔG（kcal/mol）",
    paper_ref: "Schymkowitz et al., Nucleic Acids Research 2005",
    when_to_recommend: "对候选突变做亲和力打分时首选，速度快适合大批量筛选",
    keywords: [
      "foldx", "ΔΔG", "ddg", "亲和力打分", "结合自由能", "突变打分",
      "affinity scoring", "binding free energy", "stability",
    ],
    priority: 1,
  },
  {
    id: "evoef2",
    name: "EvoEF2",
    stage: "affinity_scoring",
    description:
      "统计-物理混合力场蛋白稳定性评估工具，与 FoldX 互补，在某些突变类型上精度更优。",
    use_cases: ["蛋白稳定性预测", "作为 FoldX 的第二打分工具进行交叉验证"],
    inputs: "PDB 结构 + 突变",
    outputs: "ΔΔG 值",
    paper_ref: "Huang et al., Bioinformatics 2020",
    when_to_recommend: "与 FoldX 并行打分，通过 TOPSIS 聚合提高预测可靠性",
    keywords: [
      "evoef2", "ΔΔG", "ddg", "稳定性", "打分", "stability", "scoring",
    ],
    priority: 1,
  },
  {
    id: "esmif1",
    name: "ESM-IF1",
    stage: "affinity_scoring",
    description:
      "Meta 开发的结构感知序列似然打分工具，通过计算序列在给定结构下的对数概率评估突变",
    use_cases: ["序列-结构兼容性评分", "与物理力场互补的机器学习打分"],
    inputs: "抗体-抗原复合物 PDB + 候选序列",
    outputs: "序列对数似然分（log-likelihood）",
    paper_ref: "Hsu et al., ICML 2022",
    when_to_recommend: "作为三评分（FoldX + EvoEF2 + ESM-IF1）之一进行多方法聚合",
    keywords: [
      "esmif1", "esm-if1", "序列似然", "log-likelihood", "结构感知",
      "structure-aware", "Meta", "ESM",
    ],
    priority: 1,
  },
  {
    id: "topsis",
    name: "TOPSIS 多目标聚合",
    stage: "affinity_scoring",
    description:
      "多准则决策分析方法，将 FoldX / EvoEF2 / ESM-IF1 三个打分归一化并聚合为统一排名。",
    use_cases: ["多工具打分结果聚合", "候选序列综合排名"],
    inputs: "多维评分矩阵",
    outputs: "综合排序分（0-1）",
    paper_ref: "Hwang & Yoon, 1981（方法论）",
    when_to_recommend: "有多个独立打分工具结果需要合并时自动触发",
    keywords: [
      "topsis", "多目标", "聚合", "排名", "aggregation", "multi-criteria",
    ],
    priority: 1,
  },

  // ── Bayesian Optimization ─────────────────────────────────────────────────
  {
    id: "odbo",
    name: "ODBO（有序离散贝叶斯优化）",
    stage: "bayesian_optimization",
    description:
      "ADADD 独有的迭代优化引擎：用 k-NN 代理模型拟合历史打分数据，UCB 采集函数平衡探索-利用，动态选择下一批最有价值候选，实现有向进化。",
    use_cases: [
      "多轮迭代的亲和力成熟",
      "在大序列空间中智能采样，避免随机搜索",
      "整合湿实验反馈数据优化下一轮设计",
    ],
    inputs: "历史 (序列, 打分) 对",
    outputs: "下一轮推荐候选序列集",
    paper_ref: "ADADD 内部算法（k-NN + UCB，2025）",
    when_to_recommend: "已有至少一轮打分数据，需要迭代优化；是抗体 CDR 亲和力成熟的首选策略",
    keywords: [
      "odbo", "贝叶斯优化", "bayesian", "迭代优化", "ucb", "k-nn",
      "亲和力成熟", "有向进化", "affinity maturation", "directed evolution",
      "surrogate model", "acquisition function",
    ],
    priority: 1,
  },

  // ── Immunogenicity & Developability ──────────────────────────────────────
  {
    id: "netmhcpan",
    name: "NetMHCpan 4.1",
    stage: "immunogenicity",
    description: "预测多肽与 MHC-I 和 MHC-II 分子的结合亲和力，用于评估抗体序列的免疫原性风险（T 细胞表位识别）。",
    use_cases: ["免疫原性表位预测", "低免疫原性候选筛选", "人源化后免疫原性验证"],
    inputs: "候选抗体氨基酸序列",
    outputs: "MHC 结合预测分 + 表位热图",
    paper_ref: "Reynisson et al., Nucleic Acids Research 2020",
    when_to_recommend: "候选进入后期筛选前评估免疫原性风险，或人源化设计后验证",
    keywords: [
      "netmhcpan", "免疫原性", "immunogenicity", "MHC", "T细胞表位",
      "epitope", "T cell", "MHC-I", "MHC-II",
    ],
    priority: 1,
  },
  {
    id: "biphi",
    name: "BioPhi / OASis",
    stage: "immunogenicity",
    description:
      "基于 OAS 抗体序列数据库的人源性（humanness）量化评估工具，输出 OASis 人源化分数，指导人源化改造。",
    use_cases: ["抗体人源化程度量化", "人源化改造方案设计", "人源化后 CDR 移植验证"],
    inputs: "VH + VL 序列",
    outputs: "OASis 人源化分数（0-1）+ 非人源化残基标注",
    paper_ref: "Prihoda et al., mAbs 2022",
    when_to_recommend: "抗体人源化设计、人源化评分或决策是否需要进一步改造",
    keywords: [
      "biphi", "oasis", "人源化", "humanization", "humanness",
      "human antibody", "CDR grafting", "人源性",
    ],
    priority: 1,
  },
  {
    id: "tap",
    name: "TAP Proxy（可开发性评估）",
    stage: "immunogenicity",
    description: "评估抗体的可开发性风险，包括聚集倾向、PTM 热点、化学不稳定性（天冬酰胺脱酰胺、甲硫氨酸氧化等）。",
    use_cases: ["可开发性风险筛查", "CMC 早期评估", "候选优先级排序"],
    inputs: "VH/VL 序列",
    outputs: "可开发性风险评分 + 各维度问题标注",
    paper_ref: "Raybould et al., PNAS 2019",
    when_to_recommend: "候选进入临床前阶段，或需要筛掉 CMC 风险高的序列",
    keywords: [
      "tap", "可开发性", "developability", "聚集", "PTM", "CMC",
      "aggregation", "deamidation", "oxidation", "chemical stability",
    ],
    priority: 2,
  },
  {
    id: "anarci",
    name: "ANARCI",
    stage: "immunogenicity",
    description: "抗体序列编号工具，支持 Kabat/Chothia/IMGT 等编号方案，是 CDR 区域定义的基础工具。",
    use_cases: ["CDR 区域自动标注", "抗体序列规范化", "变异位点 Chothia 编号"],
    inputs: "VH 或 VL 氨基酸序列",
    outputs: "带编号的序列对齐结果 + CDR 定义",
    paper_ref: "Dunbar & Deane, Bioinformatics 2016",
    when_to_recommend: "需要标注 CDR 区域或统一序列编号时",
    keywords: [
      "anarci", "kabat", "chothia", "imgt", "CDR编号", "抗体编号",
      "antibody numbering", "CDR definition",
    ],
    priority: 2,
  },

  // ── Molecular Dynamics ────────────────────────────────────────────────────
  {
    id: "gromacs",
    name: "GROMACS",
    stage: "molecular_dynamics",
    description:
      "主流 MD 模拟引擎，支持 AMBER/CHARMM 力场，用于抗体-抗原复合物结构稳定性验证、结合自由能计算（MM-PBSA/FEP）。",
    use_cases: [
      "Top-N 候选抗体结构稳定性 MD 验证",
      "MM-PBSA 结合自由能计算",
      "复合物界面动力学分析",
    ],
    inputs: "PDB 结构 + 力场参数",
    outputs: "轨迹文件（XTC）+ RMSD / RMSF / 结合自由能",
    paper_ref: "Abraham et al., SoftwareX 2015",
    when_to_recommend: "Top 候选进入最终验证阶段，需要结构稳定性或精确结合自由能评估",
    keywords: [
      "gromacs", "MD", "分子动力学", "molecular dynamics", "结合自由能",
      "MM-PBSA", "FEP", "轨迹", "trajectory", "RMSD", "稳定性",
    ],
    priority: 1,
  },
  {
    id: "openmm",
    name: "OpenMM",
    stage: "molecular_dynamics",
    description: "GPU 加速的 MD 模拟库，适合 RTX 4090 等消费级 GPU，Python 接口友好。",
    use_cases: ["GPU 加速 MD 模拟", "Python 工作流集成的 MD"],
    inputs: "PDB / Amber PRMTOP",
    outputs: "轨迹 + 热力学量",
    paper_ref: "Eastman et al., PLOS Comp Biol 2017",
    when_to_recommend: "本地有 GPU 资源（RTX 4090），需要快速 MD 验证时选 OpenMM 替代 GROMACS",
    keywords: [
      "openmm", "GPU加速", "GPU MD", "python MD", "GPU molecular dynamics",
    ],
    priority: 2,
  },
];

/** 全部工具名称列表（用于系统提示词注入） */
export function getAllToolNames(): string[] {
  return ADADD_TOOLS.map((t) => t.name);
}

/** 按 stage 分组 */
export function getToolsByStage(stage: AgentStage): ToolEntry[] {
  return ADADD_TOOLS.filter((t) => t.stage === stage);
}

/** 工具名 → stage（小写 substring 匹配） */
export function inferStageFromToolName(toolName: string): AgentStage | null {
  const lower = toolName.toLowerCase();
  for (const tool of ADADD_TOOLS) {
    if (
      lower.includes(tool.id) ||
      lower.includes(tool.name.toLowerCase().split(" ")[0])
    ) {
      return tool.stage;
    }
  }
  // Fallback keyword patterns
  if (/fold|structure|chai|igfold|boltz|rfab/.test(lower)) return "structure_prediction";
  if (/iglm|mpnn|diffab|antifold|iggm|adalead|generat/.test(lower)) return "mutation_generation";
  if (/foldx|evoef|esmif|topsis|ddg|scor|affin/.test(lower)) return "affinity_scoring";
  if (/odbo|bayes|ucb|knn|surrogate/.test(lower)) return "bayesian_optimization";
  if (/netmhc|biphi|immunog|humaniz|tap|anarci/.test(lower)) return "immunogenicity";
  if (/gromac|openmm|amber|namd|md\b|dynamics/.test(lower)) return "molecular_dynamics";
  return null;
}
