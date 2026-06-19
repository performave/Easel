import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IconMessage } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { RestrictedTab } from "@/components/ui/restricted-tab";
import { discussionsQueryOptions } from "@/lib/queries";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_app/courses/$courseId/discussions")({
  loader: ({ context, params }) => { void context.queryClient.prefetchQuery(discussionsQueryOptions(Number(params.courseId))); },
  component: DiscussionsPage,
});

function DiscussionsPage() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/discussions" });
  const { data, isPending, isError } = useQuery(discussionsQueryOptions(Number(courseId)));
  const discussions = data ?? [];

  if (isPending) {
    return <SkeletonList count={3} className="h-16 w-full" />;
  }
  if (isError) {
    return <RestrictedTab />;
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
