import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { IconMessage } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { canvas, type Discussion } from "@/lib/api";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_app/courses/$courseId/discussions")({
  component: DiscussionsPage,
});

function DiscussionsPage() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/discussions" });
  const [discussions, setDiscussions] = useState<Discussion[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    canvas
      .discussions(Number(courseId))
      .then((v) => !cancelled && setDiscussions(v))
      .catch(() => !cancelled && setDiscussions([]));
    return () => { cancelled = true; };
  }, [courseId]);

  if (discussions === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }
  if (discussions.length === 0) {
    return <p className="text-sm text-muted-foreground">No discussions.</p>;
  }
  return (
    <div className="overflow-hidden rounded-md border divide-y">
      {discussions.map((d) => (
        <a
          key={d.id}
          href={d.html_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-3 p-3 hover:bg-accent"
        >
          <IconMessage className="mt-0.5 size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{d.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {d.author?.display_name ?? "Unknown"} · {d.posted_at ? formatRelative(d.posted_at) : "—"}
              {d.discussion_subentry_count > 0 && ` · ${d.discussion_subentry_count} replies`}
            </p>
          </div>
          {d.unread_count > 0 && <Badge>{d.unread_count} new</Badge>}
        </a>
      ))}
    </div>
  );
}
