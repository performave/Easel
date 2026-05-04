import { useMemo, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assignmentGroupsQueryOptions, modulesQueryOptions } from "@/lib/queries";
import { useCoursesStore } from "@/stores/courses";
import { formatShortDate } from "@/lib/format";
import { type Assignment } from "@/lib/api";
import { cn } from "@/lib/utils";

type SortMode = "group" | "module" | "due_date" | "name";

export const Route = createFileRoute("/_app/courses/$courseId/grades")({
  loader: ({ context, params }) => {
    const id = Number(params.courseId);
    void context.queryClient.prefetchQuery(assignmentGroupsQueryOptions(id));
    void context.queryClient.prefetchQuery(modulesQueryOptions(id));
  },
  component: GradesPage,
});

type EnrichedAssignment = Assignment & { groupName: string; groupWeight: number; groupId: number };

function GradesPage() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/grades" });
  const id = Number(courseId);
  const course = useCoursesStore((s) => s.byId(id));
  const { data, isPending, isError } = useQuery(assignmentGroupsQueryOptions(id));
  const { data: modulesRaw } = useQuery(modulesQueryOptions(id));

  const groups = data ?? [];
  const modules = modulesRaw ?? [];

  const [sortMode, setSortMode] = useState<SortMode>("group");
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [scoreOverrides, setScoreOverrides] = useState<Record<number, string>>({});

  const enrollment = course?.enrollments?.[0];
  const isWeighted = groups.some((g) => g.group_weight > 0);

  const assignmentModuleMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const mod of modules) {
      for (const item of mod.items ?? []) {
        if ((item.type === "Assignment" || item.type === "Quiz") && item.content_id != null) {
          if (!map.has(item.content_id)) map.set(item.content_id, mod.name);
        }
      }
    }
    return map;
  }, [modules]);

  const allAssignments = useMemo<EnrichedAssignment[]>(() => {
    return groups.flatMap((g) =>
      (g.assignments ?? []).map((a) => ({
        ...a,
        groupName: g.name,
        groupWeight: g.group_weight,
        groupId: g.id,
      })),
    );
  }, [groups]);

  const sortedAssignments = useMemo(() => {
    const arr = [...allAssignments];
    if (sortMode === "name") {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "due_date") {
      arr.sort((a, b) => {
        if (!a.due_at && !b.due_at) return 0;
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });
    } else if (sortMode === "module") {
      arr.sort((a, b) => {
        const ma = assignmentModuleMap.get(a.id) ?? "￿";
        const mb = assignmentModuleMap.get(b.id) ?? "￿";
        return ma.localeCompare(mb) || a.name.localeCompare(b.name);
      });
    }
    return arr;
  }, [allAssignments, sortMode, assignmentModuleMap]);

  const getScore = (a: EnrichedAssignment): number | null => {
    if (whatIfMode && scoreOverrides[a.id] !== undefined) {
      const v = parseFloat(scoreOverrides[a.id]);
      if (!isNaN(v)) return v;
    }
    return a.submission?.score ?? null;
  };

  const computedGrade = useMemo(() => {
    if (isWeighted) {
      let weightedSum = 0;
      let totalWeight = 0;
      for (const g of groups) {
        let earned = 0;
        let possible = 0;
        for (const a of g.assignments ?? []) {
          const enriched = { ...a, groupName: g.name, groupWeight: g.group_weight, groupId: g.id };
          const score = getScore(enriched as EnrichedAssignment);
          if (score != null && a.points_possible != null && a.points_possible > 0) {
            earned += score;
            possible += a.points_possible;
          }
        }
        if (possible > 0 && g.group_weight > 0) {
          weightedSum += (earned / possible) * g.group_weight;
          totalWeight += g.group_weight;
        }
      }
      return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : null;
    } else {
      let earned = 0;
      let possible = 0;
      for (const a of allAssignments) {
        const score = getScore(a);
        if (score != null && a.points_possible != null) {
          earned += score;
          possible += a.points_possible;
        }
      }
      return possible > 0 ? (earned / possible) * 100 : null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, allAssignments, isWeighted, whatIfMode, scoreOverrides]);

  const displayScore = whatIfMode
    ? computedGrade
    : (enrollment?.computed_current_score ?? computedGrade);

  const groupStats = useMemo(() => {
    return groups.map((g) => {
      let earned = 0;
      let possible = 0;
      for (const a of g.assignments ?? []) {
        const enriched = { ...a, groupName: g.name, groupWeight: g.group_weight, groupId: g.id };
        const score = getScore(enriched as EnrichedAssignment);
        if (score != null && !isNaN(score) && a.points_possible != null && a.points_possible > 0) {
          earned += score;
          possible += a.points_possible;
        }
      }
      return { ...g, pct: possible > 0 ? (earned / possible) * 100 : null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, whatIfMode, scoreOverrides]);

  const totalWeight = groups.reduce((s, g) => s + g.group_weight, 0);

  if (isError) {
    return <p className="text-sm text-muted-foreground">This tab is restricted for your account.</p>;
  }

  return (
    <div className="space-y-4">
      <div className={cn("grid gap-4", isWeighted && "sm:grid-cols-2")}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Course total</CardTitle>
              <button
                onClick={() => {
                  setWhatIfMode((v) => !v);
                  if (whatIfMode) setScoreOverrides({});
                }}
                className={cn(
                  "text-xs px-2 py-1 rounded-md border font-medium transition-colors",
                  whatIfMode
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-input",
                )}
              >
                {whatIfMode ? "Exit what-if" : "What-if grades"}
              </button>
            </div>
            <CardDescription>
              {whatIfMode
                ? "Hypothetical grade"
                : enrollment?.computed_current_grade
                  ? "Posted grade from Canvas"
                  : "Computed from graded items"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-baseline gap-3">
            <p className="text-3xl font-semibold">
              {displayScore != null ? `${displayScore.toFixed(1)}%` : "—"}
            </p>
            {!whatIfMode && enrollment?.computed_current_grade && (
              <p className="text-lg font-medium text-muted-foreground">
                {enrollment.computed_current_grade}
              </p>
            )}
            {whatIfMode && Object.keys(scoreOverrides).length > 0 && (
              <button
                onClick={() => setScoreOverrides({})}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Reset
              </button>
            )}
          </CardContent>
        </Card>

        {isWeighted && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Assignments are weighted by group</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Group</th>
                    <th className="px-4 py-2 text-right font-medium">Grade</th>
                    <th className="px-4 py-2 text-right font-medium">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {groupStats.map((g) => (
                    <tr key={g.id} className="text-xs">
                      <td className="px-4 py-2">{g.name}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {g.pct != null ? `${g.pct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{g.group_weight}%</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 text-xs font-semibold">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right">
                      {displayScore != null ? `${displayScore.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">{totalWeight}%</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        {(["group", "module", "due_date", "name"] as SortMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              sortMode === mode
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent",
            )}
          >
            {mode === "group" ? "Group" : mode === "module" ? "Module" : mode === "due_date" ? "Due date" : "Name"}
          </button>
        ))}
      </div>

      {isPending ? (
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
              {sortedAssignments.map((a) => {
                const score = getScore(a);
                const isOverridden = whatIfMode && scoreOverrides[a.id] !== undefined;
                const subtitle =
                  sortMode === "module"
                    ? (assignmentModuleMap.get(a.id) ?? "Other")
                    : a.groupName;
                return (
                  <tr
                    key={a.id}
                    className={cn(
                      "hover:bg-accent/50",
                      isOverridden && "bg-amber-50 dark:bg-amber-950/20",
                    )}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{subtitle}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {a.due_at ? formatShortDate(a.due_at) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {whatIfMode && a.points_possible != null ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={0}
                            max={a.points_possible}
                            step="0.1"
                            placeholder={a.submission?.score != null ? String(a.submission.score) : "—"}
                            value={
                              scoreOverrides[a.id] ??
                              (a.submission?.score != null ? String(a.submission.score) : "")
                            }
                            onChange={(e) =>
                              setScoreOverrides((prev) => ({ ...prev, [a.id]: e.target.value }))
                            }
                            className="w-16 rounded border border-input bg-background px-1.5 py-0.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <span className="text-muted-foreground">/ {a.points_possible}</span>
                        </div>
                      ) : (
                        <span className="font-medium">
                          {score != null && a.points_possible != null
                            ? `${score} / ${a.points_possible}`
                            : a.points_possible != null
                              ? `— / ${a.points_possible}`
                              : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
