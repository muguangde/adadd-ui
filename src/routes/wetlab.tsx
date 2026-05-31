import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  FileText,
  FlaskConical,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addWetLabReport, deleteWetLabReport, loadWetLabReports } from "@/lib/storage";
import type { WetLabReport } from "@/lib/types";

export const Route = createFileRoute("/wetlab")({
  head: () => ({
    meta: [
      { title: "湿实验报告 — ADADD" },
      { name: "description", content: "上传并管理湿实验报告文件，与计算方案结果对照分析。" },
    ],
  }),
  component: WetLabPage,
});

const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg";
const ACCEPTED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
]);

function WetLabPage() {
  const [reports, setReports] = useState<WetLabReport[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setReports(loadWetLabReports());

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("adadd:wetlab-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("adadd:wetlab-updated", refresh);
    };
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!ACCEPTED_MIMES.has(file.type) && file.type !== "") {
      alert(`不支持的文件类型：${file.type || file.name}`);
      return;
    }
    setPendingFile(file);
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
      const dataUrl = await readAsDataURL(pendingFile);
      const report: WetLabReport = {
        id: `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: pendingFile.name,
        mime: pendingFile.type || "application/octet-stream",
        dataUrl,
        size: pendingFile.size,
        uploadedAt: Date.now(),
        description: description.trim(),
        tags: [...tags],
      };
      addWetLabReport(report);
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

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handleDelete = (id: string) => {
    if (!confirm("确认删除该报告？")) return;
    deleteWetLabReport(id);
  };

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-6">
      <div className="mb-6 flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">湿实验报告</h1>
      </div>

      {/* Upload zone */}
      <div className="mb-8 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">上传报告文件</h2>

        {/* Drop zone */}
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
              <p className="text-sm font-medium text-foreground">{pendingFile.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(pendingFile.size)}</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">拖拽文件到此处，或点击选择文件</p>
              <p className="mt-0.5 text-xs text-muted-foreground">支持 PDF、Word、Excel、CSV、TXT、图片</p>
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

        {/* Metadata */}
        {pendingFile && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">描述（可选）</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：第三轮 ELISA 检测结果，样品批次 B-231"
                className="text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">标签（回车添加）</label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); }}}
                  placeholder="ELISA、亲和力、CDR-H3…"
                  className="text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                  添加
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="cursor-pointer gap-1 border-primary/40 bg-primary/10 text-primary hover:bg-destructive/20 hover:text-destructive"
                      onClick={() => removeTag(t)}
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
                {uploading ? "上传中…" : "确认上传"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setPendingFile(null); setDescription(""); setTags([]); setTagInput(""); }}
              >
                取消
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reports list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          已上传报告
          {reports.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">共 {reports.length} 份</span>
          )}
        </h2>

        {reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
            暂无已上传的湿实验报告。
          </div>
        ) : (
          <div className="grid gap-3">
            {reports.map((r) => (
              <ReportItem key={r.id} report={r} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportItem({ report: r, onDelete }: { report: WetLabReport; onDelete: (id: string) => void }) {
  const ext = r.name.split(".").pop()?.toUpperCase() ?? "FILE";
  const isImage = r.mime.startsWith("image/");

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background/60 text-xs font-bold text-primary">
          {ext}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
            <div className="flex shrink-0 gap-1.5">
              <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]">
                <a href={r.dataUrl} download={r.name}>
                  <Download className="h-3 w-3" /> 下载
                </a>
              </Button>
              <button
                onClick={() => onDelete(r.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                aria-label="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{formatBytes(r.size)}</span>
            <span>{new Date(r.uploadedAt).toLocaleString("zh-CN")}</span>
            {r.description && <span className="text-foreground/70">{r.description}</span>}
          </div>

          {r.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {r.tags.map((t) => (
                <Badge key={t} variant="outline" className="gap-0.5 border-border px-1.5 py-0 text-[10px]">
                  <Tag className="h-2 w-2" /> {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image preview */}
      {isImage && (
        <div className="mt-3">
          <img
            src={r.dataUrl}
            alt={r.name}
            className="max-h-48 w-auto rounded-md border border-border object-contain"
          />
        </div>
      )}

      {/* PDF inline view hint */}
      {r.mime === "application/pdf" && (
        <div className="mt-3">
          <a
            href={r.dataUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
          >
            <FileText className="h-3.5 w-3.5" /> 在新标签页中打开 PDF
          </a>
        </div>
      )}
    </div>
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
