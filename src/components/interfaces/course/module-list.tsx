import { useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Menu, MenuItem } from "@tauri-apps/api/menu";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "@/lib/api";
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
import { useQuery } from "@tanstack/react-query";
import { type Module, type ModuleItem } from "@/lib/api";
import { moduleItemsQueryOptions } from "@/lib/queries";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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

function storageKey(courseId: number) {
  return `modules-open-${courseId}`;
}

function loadOpenIds(courseId: number): Set<number> {
  try {
    const raw = localStorage.getItem(storageKey(courseId));
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {}
  return new Set();
}

function saveOpenIds(courseId: number, ids: Set<number>) {
  localStorage.setItem(storageKey(courseId), JSON.stringify([...ids]));
}

export function ModuleList({ courseId, modules, title }: { courseId: number; modules: Module[]; title?: string }) {
  const [openIds, setOpenIds] = useState<Set<number>>(() => loadOpenIds(courseId));

  function toggle(id: number, next: boolean) {
    setOpenIds((prev) => {
      const updated = new Set(prev);
      if (next) updated.add(id); else updated.delete(id);
      saveOpenIds(courseId, updated);
      return updated;
    });
  }

  const allOpen = modules.every((m) => openIds.has(m.id));

  function setAll(open: boolean) {
    const updated = open ? new Set(modules.map((m) => m.id)) : new Set<number>();
    setOpenIds(updated);
    saveOpenIds(courseId, updated);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {title ? (
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
        ) : (
          <span />
        )}
        <Button variant="ghost" size="sm" onClick={() => setAll(!allOpen)}>
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>
      {modules.map((m) => (
        <ModuleRow
          key={m.id}
          courseId={courseId}
          module={m}
          open={openIds.has(m.id)}
          onOpenChange={(v) => toggle(m.id, v)}
        />
      ))}
    </div>
  );
}

function ModuleRow({
  courseId,
  module: m,
  open,
  onOpenChange,
}: {
  courseId: number;
  module: Module;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: items } = useQuery({
    ...moduleItemsQueryOptions(courseId, m.id),
    enabled: open,
  });

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="overflow-hidden rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 bg-muted/40 px-3 py-2.5 text-left hover:bg-muted">
        <div className="flex min-w-0 items-center gap-2">
          <IconChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
          <span className="truncate text-sm font-medium">{m.name}</span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{m.items_count} items</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="divide-y border-t">
          {items === undefined ? (
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

type DownloadState = { downloaded: number; total: number | null } | null;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function ItemRow({ courseId, item }: { courseId: number; item: ModuleItem }) {
  const [dlState, setDlState] = useState<DownloadState>(null);

  if (item.type === "SubHeader") {
    return <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.title}</p>;
  }
  const Icon = ICON[item.type] ?? IconBook;
  const indent = Math.min(item.indent ?? 0, 5);
  const style = { paddingLeft: `${0.75 + indent * 0.75}rem` };
  const rowClass = cn("flex items-center gap-2 px-3 py-2 hover:bg-accent");

  if (item.type === "Assignment" && item.content_id) {
    return (
      <Link
        to="/courses/$courseId/assignments/$assignmentId"
        params={{ courseId: String(courseId), assignmentId: String(item.content_id) }}
        className={rowClass}
        style={style}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{item.title}</span>
        {item.completion_requirement?.completed && (
          <span className="ml-auto text-xs text-emerald-600">Done</span>
        )}
      </Link>
    );
  }

  if (item.type === "File" && item.content_id) {
    const pct = dlState?.total ? (dlState.downloaded / dlState.total) * 100 : null;
    return (
      <div className="relative">
        <button
          className={cn(rowClass, "w-full text-left", dlState && "pointer-events-none opacity-70")}
          style={style}
          disabled={!!dlState}
          onClick={() => {
            const fileId = item.content_id!;
            setDlState({ downloaded: 0, total: null });
            const unlistenPromise = listen<{ file_id: number; downloaded: number; total: number | null }>(
              "file-download-progress",
              (event) => {
                if (event.payload.file_id !== fileId) return;
                setDlState({ downloaded: event.payload.downloaded, total: event.payload.total });
              },
            );
            api.downloadAndOpenFile(fileId).finally(() => {
              unlistenPromise.then((unlisten) => unlisten());
              setDlState(null);
            });
          }}
          onContextMenu={async (e) => {
            e.preventDefault();
            const url = item.html_url;
            if (!url) return;
            const menu = await Menu.new({
              items: [
                await MenuItem.new({ text: "Open in browser", action: () => openUrl(url) }),
              ],
            });
            await menu.popup();
          }}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">{item.title}</span>
          {dlState ? (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {formatBytes(dlState.downloaded)}
              {dlState.total ? ` / ${formatBytes(dlState.total)}` : ""}
            </span>
          ) : item.completion_requirement?.completed ? (
            <span className="ml-auto text-xs text-emerald-600">Done</span>
          ) : null}
        </button>
        {dlState && (
          <Progress
            value={pct ?? 0}
            className="absolute bottom-0 left-0 right-0 h-0.5 rounded-none"
          />
        )}
      </div>
    );
  }

  return (
    <a
      href={item.html_url ?? item.external_url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={rowClass}
      style={style}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-sm">{item.title}</span>
      {item.completion_requirement?.completed && (
        <span className="ml-auto text-xs text-emerald-600">Done</span>
      )}
    </a>
  );
}
