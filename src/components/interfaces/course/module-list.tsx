import { useEffect, useState } from "react";
import {
  IconBook,
  IconChevronRight,
  IconClipboardList,
  IconExternalLink,
  IconFileText,
  IconLink,
  IconMessage,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { canvas, type Module, type ModuleItem } from "@/lib/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ICON: Record<string, typeof IconBook> = {
  Assignment: IconClipboardList,
  Quiz: IconClipboardList,
  File: IconFileText,
  Page: IconBook,
  Discussion: IconMessage,
  ExternalUrl: IconExternalLink,
  ExternalTool: IconLink,
  SubHeader: IconBook,
};

export function ModuleList({ courseId, modules }: { courseId: number; modules: Module[] }) {
  return (
    <div className="space-y-2">
      {modules.map((m) => <ModuleRow key={m.id} courseId={courseId} module={m} />)}
    </div>
  );
}

function ModuleRow({ courseId, module: m }: { courseId: number; module: Module }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ModuleItem[] | null>(null);

  useEffect(() => {
    if (!open || items !== null) return;
    let cancelled = false;
    canvas.moduleItems(courseId, m.id).then((v) => !cancelled && setItems(v)).catch(() => !cancelled && setItems([]));
    return () => { cancelled = true; };
  }, [open, items, courseId, m.id]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 bg-muted/40 px-3 py-2.5 text-left hover:bg-muted">
        <div className="flex min-w-0 items-center gap-2">
          <IconChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
          <span className="truncate text-sm font-medium">{m.name}</span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{m.items_count} items</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="divide-y border-t">
          {items === null ? (
            <div className="space-y-1 p-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Empty module.</p>
          ) : (
            items.map((item) => <ItemRow key={item.id} courseId={courseId} item={item} />)
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ItemRow({ courseId, item }: { courseId: number; item: ModuleItem }) {
  if (item.type === "SubHeader") {
    return <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.title}</p>;
  }
  const Icon = ICON[item.type] ?? IconBook;
  const indent = Math.min(item.indent ?? 0, 5);
  const inner = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-sm">{item.title}</span>
      {item.completion_requirement?.completed && (
        <span className="ml-auto text-xs text-emerald-600">Done</span>
      )}
    </>
  );
  const className = cn(
    "flex items-center gap-2 px-3 py-2 hover:bg-accent",
  );
  const style = { paddingLeft: `${0.75 + indent * 0.75}rem` };

  if (item.type === "Assignment" && item.content_id) {
    return (
      <Link
        to="/courses/$courseId/assignments/$assignmentId"
        params={{ courseId: String(courseId), assignmentId: String(item.content_id) }}
        className={className}
        style={style}
      >
        {inner}
      </Link>
    );
  }
  return (
    <a
      href={item.html_url ?? item.external_url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={className}
      style={style}
    >
      {inner}
    </a>
  );
}
