import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IconChevronRight, IconDownload, IconFile, IconFolder } from "@tabler/icons-react";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { RestrictedTab } from "@/components/ui/restricted-tab";
import { Button } from "@/components/ui/button";
import { filesQueryOptions, foldersQueryOptions, rootFolderQueryOptions } from "@/lib/queries";
import type { Folder } from "@/lib/api";
import { formatBytes, formatShortDate } from "@/lib/format";

export const Route = createFileRoute("/_app/courses/$courseId/files")({
  loader: ({ context, params }) => { void context.queryClient.prefetchQuery(rootFolderQueryOptions(Number(params.courseId))); },
  component: FilesPage,
});

function FilesPage() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/files" });
  const id = Number(courseId);
  const [stack, setStack] = useState<Folder[]>([]);
  const queryClient = Route.useRouteContext({ select: (ctx) => ctx.queryClient });
  const { data: rootFolder, isError: isRootError } = useQuery(rootFolderQueryOptions(id));

  useEffect(() => {
    if (!rootFolder) return;
    setStack([rootFolder]);
  }, [id, rootFolder]);

  const current = stack[stack.length - 1];
  const currentFolderId = current?.id;
  const foldersOptions = useMemo(
    () => (currentFolderId == null ? null : foldersQueryOptions(id, currentFolderId)),
    [id, currentFolderId],
  );
  const filesOptions = useMemo(
    () => (currentFolderId == null ? null : filesQueryOptions(id, currentFolderId)),
    [id, currentFolderId],
  );
  const foldersQuery = useQuery({ ...(foldersOptions ?? foldersQueryOptions(id, -1)), enabled: currentFolderId != null });
  const filesQuery = useQuery({ ...(filesOptions ?? filesQueryOptions(id, -1)), enabled: currentFolderId != null });
  const folders = foldersQuery.data ?? [];
  const files = filesQuery.data ?? [];
  const isRestricted = isRootError || foldersQuery.isError || filesQuery.isError;

  useEffect(() => {
    if (currentFolderId == null) return;
    void queryClient.prefetchQuery(foldersQueryOptions(id, currentFolderId));
    void queryClient.prefetchQuery(filesQueryOptions(id, currentFolderId));
  }, [id, currentFolderId, queryClient]);

  if (isRestricted) {
    return <RestrictedTab />;
  }

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
        {(foldersQuery.isPending || filesQuery.isPending) && (
          <SkeletonList count={4} className="h-8 w-full" wrapperClassName="space-y-1 p-3" />
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
