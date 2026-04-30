import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { canvas, type AssignmentGroup } from "@/lib/api";
import { useCoursesStore } from "@/stores/courses";
import { formatShortDate } from "@/lib/format";

export const Route = createFileRoute("/_app/courses/$courseId/grades")({
  component: GradesPage,
});

function GradesPage() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/grades" });
  const id = Number(courseId);
  const course = useCoursesStore((s) => s.byId(id));
  const [groups, setGroups] = useState<AssignmentGroup[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    canvas.assignmentGroups(id).then((v) => !cancelled && setGroups(v)).catch(() => !cancelled && setGroups([]));
    return () => { cancelled = true; };
  }, [id]);

  const enrollment = course?.enrollments?.[0];

  const totals = useMemo(() => {
    if (!groups) return null;
    let earned = 0;
    let possible = 0;
    for (const g of groups) {
      for (const a of g.assignments ?? []) {
        if (a.submission?.score != null && a.points_possible != null) {
          earned += a.submission.score;
          possible += a.points_possible;
        }
      }
    }
    return { earned, possible };
  }, [groups]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Course total</CardTitle>
          <CardDescription>
            {enrollment?.computed_current_grade ? "Posted grade from Canvas" : "Computed from graded items"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-baseline gap-4">
          <p className="text-3xl font-semibold">
            {enrollment?.computed_current_score != null
              ? `${enrollment.computed_current_score}%`
              : totals && totals.possible > 0
                ? `${((totals.earned / totals.possible) * 100).toFixed(1)}%`
                : "—"}
          </p>
          {enrollment?.computed_current_grade && (
            <p className="text-lg font-medium text-muted-foreground">
              {enrollment.computed_current_grade}
            </p>
          )}
        </CardContent>
      </Card>

      {groups === null ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.flatMap((g) =>
                (g.assignments ?? []).map((a) => (
                  <tr key={a.id} className="hover:bg-accent/50">
                    <td className="px-3 py-2">
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{g.name}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {a.due_at ? formatShortDate(a.due_at) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {a.submission?.score != null && a.points_possible != null
                        ? `${a.submission.score} / ${a.points_possible}`
                        : a.points_possible != null
                          ? `— / ${a.points_possible}`
                          : "—"}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
