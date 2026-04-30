import { useEffect, useState } from "react";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { canvas, type Assignment } from "@/lib/api";
import { CanvasHtml } from "@/lib/html";
import { formatRelativeDate } from "@/lib/format";

export const Route = createFileRoute("/_app/courses/$courseId/assignments/$assignmentId")({
  component: AssignmentDetail,
});

function AssignmentDetail() {
  const { courseId, assignmentId } = useParams({
    from: "/_app/courses/$courseId/assignments/$assignmentId",
  });
  const [a, setA] = useState<Assignment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    canvas
      .assignment(Number(courseId), Number(assignmentId))
      .then((v) => !cancelled && setA(v))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; };
  }, [courseId, assignmentId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!a) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const sub = a.submission;

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 h-8"
          render={
            <Link to="/courses/$courseId/assignments" params={{ courseId }}>
              <IconArrowLeft className="size-4" /> All assignments
            </Link>
          }
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{a.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {a.due_at ? `Due ${formatRelativeDate(a.due_at)}` : "No due date"}
              {a.points_possible != null && ` · ${a.points_possible} points`}
            </p>
          </div>
          {a.html_url && (
            <Button
              variant="outline"
              size="sm"
              render={
                <a href={a.html_url} target="_blank" rel="noreferrer">
                  <IconExternalLink className="size-4" /> Open in Canvas
                </a>
              }
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            {a.description ? (
              <CanvasHtml html={a.description} />
            ) : (
              <p className="text-sm text-muted-foreground">No description.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Submission</CardTitle>
              <CardDescription>
                {a.submission_types?.length
                  ? a.submission_types.join(", ")
                  : "No submission required"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {sub ? (
                <>
                  <Row label="Status" value={sub.workflow_state} />
                  <Row label="Score" value={sub.score != null ? `${sub.score}` : "—"} />
                  <Row label="Grade" value={sub.grade ?? "—"} />
                  <Row
                    label="Submitted"
                    value={sub.submitted_at ? formatRelativeDate(sub.submitted_at) : "Not submitted"}
                  />
                  {sub.late && <Badge variant="destructive">Late</Badge>}
                  {sub.missing && <Badge variant="destructive">Missing</Badge>}
                  {sub.excused && <Badge>Excused</Badge>}
                </>
              ) : (
                <p className="text-muted-foreground">No submission yet.</p>
              )}
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground">
                File-upload and text-entry submission inside Slayte is not yet implemented — use
                "Open in Canvas" to submit.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
