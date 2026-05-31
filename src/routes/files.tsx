import { createFileRoute } from "@tanstack/react-router";
import {
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addResearchFile, deleteResearchFile, loadResearchFiles } from "@/lib/storage";
import type { ResearchFile, ResearchFileMeta } from "@/lib/types";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "研究文件库 — ADADD" },
      { name: "description", content: "上传并管理 PDB、FASTA、SDF 等计算输入文件，供 ADADD 流水线使用。" },
    ],
  }),
  component: FilesPage,
});

// ── Format detection ──────────────────────────────────────────────────────────

const EXT_FORMAT: Record<string, string> = {
  pdb: "PDB", ent: "PDB",
  fasta: "FASTA", fa: "FASTA", fas: "FASTA", seq: "FASTA",
  sdf: "SDF", mol: "SDF",
  mol2: "MOL2",
  cif: "CIF", mmcif: "CIF",
  xyz: "XYZ",
  csv: "CSV",
  json: "JSON",
  txt: "TXT",
};

const FORMAT_COLOR: Record<string, string> = {
  PDB:   "bg-blue-900/50 text-blue-300 border-blue-700/50",
  FASTA: "bg-violet-900/50 text-violet-300 border-violet-700/50",
  SDF:   "bg-teal-900/50 text-teal-300 border-teal-700/50",
  MOL2:  "bg-teal-900/50 text-teal-300 border-teal-700/50",
  CIF:   "bg-sky-900/50 text-sky-300 border-sky-700/50",
  XYZ:   "bg-cyan-900/50 text-cyan-300 border-cyan-700/50",
  CSV:   "bg-emerald-900/50 text-emerald-300 border-emerald-700/50",
  JSON:  "bg-amber-900/50 text-amber-300 border-amber-700/50",
};

function detectFormat(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_FORMAT[ext] ?? "OTHER";
}

// ── PDB / FASTA metadata extraction ─────────────────────────────────────────

function parsePdbMeta(text: string): ResearchFileMeta {
  const lines = text.split("\n");
  let moleculeName = "";
  const chains = new Set<string>();
  let atomCount = 0;
  for (const line of lines) {
    if (!moleculeName && (line.startsWith("HEADER") || line.startsWith("TITLE "))) {
      moleculeName = line.slice(10).trim().replace(/\s+/g, " ").slice(0, 80);
    }
    if (line.startsWith("ATOM  ") || line.startsWith("HETATM")) {
      atomCount++;
      const chain = line[21];
      if (chain && chain !== " ") chains.add(chain);
    }
  }
  return {
    moleculeName: moleculeName || undefined,
    atomOrResidueCount: atomCount || undefined,
    chains: chains.size ? [...chains].sort() : undefined,
  };
}

function parseFastaMeta(text: string): ResearchFileMeta {
  const lines = text.split("\n");
  let sequenceCount = 0;
  let firstHeader = "";
  let totalResidues = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith(">")) {
      sequenceCount++;
      if (!firstHeader) firstHeader = t.slice(1).trim().split(/\s+/)[0] ?? "";
    } else {
      totalResidues += t.replace(/[^A-Za-z]/g, "").length;
    }
  }
  return {
    moleculeName: firstHeader || undefined,
    sequenceCount: sequenceCount || undefined,
    atomOrResidueCount: totalResidues || undefined,
  };
}

async function extractMeta(file: File, format: string): Promise<ResearchFileMeta> {
  if (format !== "PDB" && format !== "FASTA") return {};
  try {
    const text = await file.text();
    if (format === "PDB") return parsePdbMeta(text);
    if (format === "FASTA") return parseFastaMeta(text);
  } catch { /* ignore */ }
  return {};
}

// ── Accepted file types ───────────────────────────────────────────────────────

const ACCEPTED = ".pdb,.ent,.fasta,.fa,.fas,.seq,.sdf,.mol,.mol2,.cif,.mmcif,.xyz,.csv,.json,.txt";

// ── Page ──────────────────────────────────────────────────────────────────────

function FilesPage() {
  const [files, setFiles] = useState<ResearchFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setFiles(loadResearchFiles());

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("adadd:research-files-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("adadd:research-files-updated", refresh);
    };
  }, []);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setPendingFile(fileList[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const format = detectFormat(pendingFile.name);
      const [dataUrl, meta] = await Promise.all([
        readAsDataURL(pendingFile),
        extractMeta(pendingFile, format),
      ]);
      const rf: ResearchFile = {
        id: `rf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: pendingFile.name,
        format,
        mime: pendingFile.type || "application/octet-stream",
        dataUrl,
        size: pendingFile.size,
        uploadedAt: Date.now(),
        description: description.trim(),
        tags: [...tags],
        meta,
      };
      addResearchFile(rf);
      setPendingFile(null);
      setDescription("");
      setTags([]);
      setTagInput("");
    } finally {
      setUploading(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const handleDelete = (id: string) => {
    if (!confirm("确认删除该文件？")) return;
    deleteResearchFile(id);
    if (previewId === id) setPreviewId(null);
  };

  // Group by format
  const byFormat = files.reduce<Record<string, ResearchFile[]>>((acc, f) => {
    (acc[f.format] ??= []).push(f);
    return acc;
  }, {});
  const formatOrder = ["PDB", "FASTA", "SDF", "MOL2", "CIF", "XYZ", "CSV", "JSON", "TXT", "OTHER"];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-6">
      <div className="mb-6 flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">研究文件库</h1>
        <span className="text-xs text-muted-foreground">PDB · FASTA · SDF · MOL2 · CIF · XYZ</span>
      </div>

      {/* Upload zone */}
      <div className="mb-8 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">上传研究文件</h2>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
            dragging
              ? "border-primary bg-primary/10"
              : "border-border bg-background/30 hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          <Upload className="mb-2 h-7 w-7 text-muted-foreground" />
          {pendingFile ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <FormatBadge format={detectFormat(pendingFile.name)} />
                <p className="text-sm font-medium text-foreground">{pendingFile.name}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(pendingFile.size)}</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">拖拽文件到此处，或点击选择</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                支持 PDB · FASTA · SDF · MOL2 · CIF · XYZ · CSV · JSON · TXT
              </p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {pendingFile && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">描述（可选）</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：曲妥珠单抗 VH 结构，分辨率 2.4 Å，RCSB PDB ID: 1N8Z"
                className="text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">标签（回车添加）</label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="HER2、VH、CDR-H3、参考结构…"
                  className="text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>添加</Button>
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="cursor-pointer gap-1 border-primary/40 bg-primary/10 text-primary hover:bg-destructive/20 hover:text-destructive"
                      onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                    >
                      <Tag className="h-2.5 w-2.5" /> {t} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={uploading} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "解析中…" : "确认上传"}
              </Button>
              <Button variant="ghost" onClick={() => { setPendingFile(null); setDescription(""); setTags([]); setTagInput(""); }}>
                取消
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* File list */}
      {files.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
          暂无研究文件。上传 PDB、FASTA 等文件后，可在这里管理并供流水线调用。
        </div>
      ) : (
        <div className="space-y-6">
          {formatOrder.filter((fmt) => byFormat[fmt]?.length).map((fmt) => (
            <div key={fmt}>
              <div className="mb-2 flex items-center gap-2">
                <FormatBadge format={fmt} />
                <span className="text-xs text-muted-foreground">{byFormat[fmt].length} 个文件</span>
              </div>
              <div className="grid gap-2">
                {byFormat[fmt].map((f) => (
                  <FileRow
                    key={f.id}
                    file={f}
                    previewing={previewId === f.id}
                    onTogglePreview={() => setPreviewId(previewId === f.id ? null : f.id)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── File row ──────────────────────────────────────────────────────────────────

function FileRow({
  file: f,
  previewing,
  onTogglePreview,
  onDelete,
}: {
  file: ResearchFile;
  previewing: boolean;
  onTogglePreview: () => void;
  onDelete: (id: string) => void;
}) {
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isText = ["PDB", "FASTA", "SDF", "MOL2", "XYZ", "CIF", "CSV", "JSON", "TXT"].includes(f.format);

  useEffect(() => {
    if (!previewing || previewText !== null) return;
    // Decode dataUrl to text
    try {
      const b64 = f.dataUrl.split(",")[1];
      if (!b64) return;
      setPreviewText(atob(b64).slice(0, 4000)); // first 4 KB
    } catch {
      setPreviewText("（无法解码文件内容）");
    }
  }, [previewing, f.dataUrl, previewText]);

  const handleCopy = () => {
    if (!previewText) return;
    navigator.clipboard.writeText(previewText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card text-xs">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{f.name}</span>

        {/* Meta chips */}
        {f.meta.moleculeName && (
          <span className="hidden shrink-0 max-w-[180px] truncate text-[10px] text-muted-foreground sm:block">
            {f.meta.moleculeName}
          </span>
        )}
        {f.meta.chains && (
          <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">
            链：{f.meta.chains.join(", ")}
          </span>
        )}
        {f.meta.atomOrResidueCount !== undefined && (
          <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">
            {f.format === "FASTA" ? `${f.meta.atomOrResidueCount} 残基` : `${f.meta.atomOrResidueCount} 原子`}
          </span>
        )}
        {f.meta.sequenceCount !== undefined && (
          <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">
            {f.meta.sequenceCount} 条序列
          </span>
        )}

        <span className="shrink-0 text-[10px] text-muted-foreground">{formatBytes(f.size)}</span>

        {/* Actions */}
        {isText && (
          <button
            onClick={onTogglePreview}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            title={previewing ? "收起预览" : "预览内容"}
          >
            {previewing ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <Button asChild size="sm" variant="outline" className="h-6 shrink-0 gap-1 px-2 text-[10px]">
          <a href={f.dataUrl} download={f.name}>
            <Download className="h-3 w-3" /> 下载
          </a>
        </Button>
        <button
          onClick={() => onDelete(f.id)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tags + description */}
      {(f.tags.length > 0 || f.description) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 px-3 py-1.5">
          {f.description && (
            <span className="text-[10px] text-muted-foreground">{f.description}</span>
          )}
          {f.tags.map((t) => (
            <Badge key={t} variant="outline" className="gap-0.5 border-border px-1.5 py-0 text-[10px]">
              <Tag className="h-2 w-2" /> {t}
            </Badge>
          ))}
        </div>
      )}

      {/* Inline text preview */}
      {previewing && (
        <div className="border-t border-border/60">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              文件内容预览（前 4 KB）
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3 w-3" />
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap px-3 pb-3 font-mono text-[11px] leading-relaxed text-foreground/85">
            {previewText ?? "加载中…"}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function FormatBadge({ format }: { format: string }) {
  const color = FORMAT_COLOR[format] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${color}`}>
      {format}
    </span>
  );
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
