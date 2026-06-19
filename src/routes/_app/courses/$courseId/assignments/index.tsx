import { useMemo } from "react";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IconAlertCircle, IconCheck, IconClipboardList, IconClock } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { RestrictedTab } from "@/components/ui/restricted-tab";
import { assignmentGroupsQueryOptions } from "@/lib/queries";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/courses/$courseId/assignments/")({
  loader: ({ context, params }) => { void context.queryClient.prefetchQuery(assignmentGroupsQueryOptions(Number(params.courseId))); },
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/assignments/" });
  const id = Number(courseId);
  const { data, isPending, isError } = useQuery(assignmentGroupsQueryOptions(id));
  const groups = data ?? [];

  const sorted = useMemo(
    () => groups?.slice().sort((a, b) => a.position - b.position),
    [groups],
  );

  if (isPending) {
    return <SkeletonList count={3} className="h-24 w-full" wrapperClassName="space-y-3" />;
  }
  if (isError) {
    return <RestrictedTab />;
  }
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No assignments.</p>;
  }

  return (
    <div className="space-y-6">
      {sorted!.map((group) => (
        <section key={group.id}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group.name}
            </h2>
            {group.group_weight > 0 && (
              <span className="text-xs text-muted-foreground">{group.group_weight}%</span>
            )}
          </div>
          <div className="overflow-hidden rounded-md border divide-y">
            {(group.assignments ?? []).length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No items in this group.</p>
            ) : (
              group.assignments!.map((a) => {
                const sub = a.submission;
                const status = sub?.late
                  ? "late"
                  : sub?.missing
                    ? "missing"
                    : sub?.workflow_state === "graded"
                      ? "graded"
                      : sub?.submitted_at
                        ? "submitted"
                        : "open";
                return (
                  <Link
                    key={a.id}
                    to="/courses/$courseId/assignments/$assignmentId"
                    params={{ courseId, assignmentId: String(a.id) }}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent"
                  >
                    <IconClipboardList className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.due_at ? `Due ${formatRelativeDate(a.due_at)}` : "No due date"}
                        {a.points_possible != null && ` · ${a.points_possible} pts`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      {sub?.score != null && a.points_possible != null && (
                        <Badge variant="outline" className="tabular-nums">
                          {sub.score}/{a.points_possible}
                        </Badge>
                      )}
                      <StatusPill status={status} />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cn: string; Icon: typeof IconCheck }> = {
    graded: { label: "Graded", cn: "text-emerald-600", Icon: IconCheck },
    submitted: { label: "Submitted", cn: "text-slate-500", Icon: IconCheck },
    missing: { label: "Missing", cn: "text-destructive", Icon: IconAlertCircle },
    late: { label: "Late", cn: "text-amber-600", Icon: IconClock },
    open: { label: "", cn: "text-muted-foreground", Icon: IconClock },
  };
  const it = map[status];
  if (!it.label) return null;
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", it.cn)}>
      <it.Icon className="size-3.5" />
      {it.label}
    </span>
  );
}
