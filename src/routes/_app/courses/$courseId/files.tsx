import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { IconChevronRight, IconDownload, IconFile, IconFolder } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { canvas, type CanvasFile, type Folder } from "@/lib/api";
import { formatBytes, formatShortDate } from "@/lib/format";

export const Route = createFileRoute("/_app/courses/$courseId/files")({
  component: FilesPage,
});

function FilesPage() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/files" });
  const id = Number(courseId);
  const [stack, setStack] = useState<Folder[]>([]);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [files, setFiles] = useState<CanvasFile[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    canvas.rootFolder(id).then((root) => {
      if (cancelled) return;
      setStack([root]);
    });
    return () => { cancelled = true; };
  }, [id]);

  const current = stack[stack.length - 1];

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setFolders(null);
    setFiles(null);
    canvas.folders(id, current.id).then((v) => !cancelled && setFolders(v)).catch(() => !cancelled && setFolders([]));
    canvas.files(id, current.id).then((v) => !cancelled && setFiles(v)).catch(() => !cancelled && setFiles([]));
    return () => { cancelled = true; };
  }, [id, current?.id]);

  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        {stack.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1">
            {i > 0 && <IconChevronRight className="size-3 text-muted-foreground" />}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setStack(stack.slice(0, i + 1))}
            >
              {i === 0 ? "Files" : f.name}
            </Button>
          </span>
        ))}
      </nav>
      <div className="overflow-hidden rounded-md border divide-y">
        {(folders === null || files === null) && (
          <div className="space-y-1 p-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        )}
        {folders?.map((f) => (
          <button
            key={`d-${f.id}`}
            onClick={() => setStack([...stack, f])}
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
          >
            <IconFolder className="size-4 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">{f.name}</span>
            <span className="text-xs text-muted-foreground">
              {f.files_count + f.folders_count} items
            </span>
          </button>
        ))}
        {files?.map((f) => (
          <a
            key={`f-${f.id}`}
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2 hover:bg-accent"
          >
            <IconFile className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{f.display_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatShortDate(f.updated_at)} · {formatBytes(f.size)}
              </p>
            </div>
            <IconDownload className="size-4 text-muted-foreground" />
          </a>
        ))}
        {folders?.length === 0 && files?.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">Empty folder.</p>
        )}
      </div>
    </div>
  );
}
