export type RequirementItem = { key: string; value: string };

/** Maps to the 8 nodes in the ADADD LangGraph DAG */
export type AgentStage =
  | "input"
  | "structure_prediction"
  | "mutation_generation"
  | "affinity_scoring"
  | "bayesian_optimization"
  | "immunogenicity"
  | "molecular_dynamics"
  | "output";

export type PlanStep = {
  name: string;
  tool: string;
  estimated_minutes: number;
  inputs: string;
  outputs: string;
  /** Inferred from tool name; populated client-side via inferStageFromToolName() */
  agent_stage?: AgentStage;
};

export type ComputationPlan = {
  id: string;
  title: string;
  tools: string[];
  steps: PlanStep[];
  confidence: "low" | "medium" | "high";
  reasoning: string;
  createdAt: number;
};

export type JobArtifact = {
  stepIndex: number;
  name: string;
  mime: string;
  dataUrl: string; // data:<mime>;base64,...  — directly downloadable
  size: number;
};

export type JobStep = {
  name: string;
  tool: string;
  status: "pending" | "running" | "done" | "failed";
  startedAt?: number;
  finishedAt?: number;
  logs?: string;
  error?: string;
};

export type Job = {
  id: string;
  threadId: string;
  name: string;
  target: string;
  method: string;
  status: "queued" | "running" | "completed" | "failed";
  currentStep: number;
  steps: JobStep[];
  artifacts: JobArtifact[];
  startedAt: number;
  finishedAt?: number;
  error?: string;
};

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: unknown[]; // UIMessage[]
  requirements: RequirementItem[];
  plan: ComputationPlan | null;
};

export type WetLabReport = {
  id: string;
  name: string;
  mime: string;
  dataUrl: string; // data:<mime>;base64,...
  size: number;
  uploadedAt: number;
  description: string;
  tags: string[];
};

export type ResearchFileMeta = {
  /** PDB: molecule name from HEADER/TITLE; FASTA: first sequence header */
  moleculeName?: string;
  /** PDB: number of ATOM records; FASTA: total residue count */
  atomOrResidueCount?: number;
  /** PDB: unique chain IDs */
  chains?: string[];
  /** FASTA: number of sequences */
  sequenceCount?: number;
};

export type ResearchFile = {
  id: string;
  name: string;
  format: string; // "PDB" | "FASTA" | "SDF" | "MOL2" | "CIF" | "XYZ" | "CSV" | "JSON" | "OTHER"
  mime: string;
  dataUrl: string;
  size: number;
  uploadedAt: number;
  description: string;
  tags: string[];
  meta: ResearchFileMeta;
};