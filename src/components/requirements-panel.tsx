import { Beaker } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { RequirementItem } from "@/lib/types";

export function RequirementsPanel({ items }: { items: RequirementItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Beaker className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">需求摘要</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          开始描述你的研究任务，AI 会在这里实时汇总确认过的参数。
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <Badge
              key={it.key}
              variant="outline"
              className="border-primary/40 bg-primary/10 text-foreground"
            >
              <span className="text-muted-foreground">{it.key}:</span>
              <span className="ml-1 font-medium">{it.value}</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}