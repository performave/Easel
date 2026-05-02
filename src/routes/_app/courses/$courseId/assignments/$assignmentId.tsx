import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconArrowLeft, IconExternalLink, IconSend } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextField } from "@/components/forms/rich-text-field";
import { canvas } from "@/lib/api";
import { assignmentQueryOptions } from "@/lib/queries";
import { CanvasHtml } from "@/lib/html";
import { formatRelativeDate } from "@/lib/format";

export const Route = createFileRoute("/_app/courses/$courseId/assignments/$assignmentId")({
  component: AssignmentDetail,
});

const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  online_text_entry: "Text Entry",
  online_upload: "File Upload",
  online_url: "Website URL",
  media_recording: "Media Recording",
  external_tool: "External Tool",
  discussion_topic: "Discussion",
  none: "No Submission",
  not_graded: "Not Graded",
};

const WORKFLOW_STATE_LABELS: Record<string, string> = {
  unsubmitted: "Not Submitted",
  submitted: "Submitted",
  graded: "Graded",
  pending_review: "Pending Review",
};

function formatSubmissionType(type: string): string {
  return (
    SUBMISSION_TYPE_LABELS[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatWorkflowState(state: string): string {
  return (
    WORKFLOW_STATE_LABELS[state] ??
    state.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function AssignmentDetail() {
  const { courseId, assignmentId } = useParams({
    from: "/_app/courses/$courseId/assignments/$assignmentId",
  });
  const queryClient = useQueryClient();
  const cId = Number(courseId);
  const aId = Number(assignmentId);

  const { data: a, isPending, error } = useQuery(assignmentQueryOptions(cId, aId));

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : String(error)}
      </p>
    );
  }
  if (isPending || !a) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const sub = a.submission;
  const supportsTextEntry = a.submission_types?.includes("online_text_entry");
  const isSubmitted = !!sub?.submitted_at;
  const needsOpenInCanvas =
    !supportsTextEntry &&
    a.submission_types?.some((t) => !["none", "not_graded"].includes(t));

  const handleSubmitSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["assignment", cId, aId] });
  };

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
        {/* Left column: instructions + text entry form */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
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

          {supportsTextEntry && !isSubmitted && (
            <TextEntryCard courseId={cId} assignmentId={aId} onSuccess={handleSubmitSuccess} />
          )}
        </div>

        {/* Right column: submission status */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Submission</CardTitle>
              <CardDescription>
                {a.submission_types?.length
                  ? a.submission_types.map(formatSubmissionType).join(", ")
                  : "No submission required"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {sub && (
                <>
                  <Row label="Status" value={formatWorkflowState(sub.workflow_state)} />
                  <Row
                    label="Grade"
                    value={
                      sub.grade != null
                        ? sub.score != null
                          ? `${sub.grade} (${sub.score})`
                          : sub.grade
                        : "—"
                    }
                  />
                  {sub.submitted_at && (
                    <Row label="Submitted" value={formatRelativeDate(sub.submitted_at)} />
                  )}
                  {(sub.late || sub.missing || sub.excused) && (
                    <div className="flex gap-1 pt-1">
                      {sub.late && <Badge variant="destructive">Late</Badge>}
                      {sub.missing && <Badge variant="destructive">Missing</Badge>}
                      {sub.excused && <Badge>Excused</Badge>}
                    </div>
                  )}
                </>
              )}

              {needsOpenInCanvas && (
                <>
                  {sub && <Separator className="my-2" />}
                  <p className="text-xs text-muted-foreground">
                    Use "Open in Canvas" above to submit.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const submitSchema = z.object({
  body: z.string().min(1, "Submission cannot be empty."),
});
type SubmitValues = z.infer<typeof submitSchema>;

function TextEntryCard({
  courseId,
  assignmentId,
  onSuccess,
}: {
  courseId: number;
  assignmentId: number;
  onSuccess: () => void;
}) {
  const form = useForm<SubmitValues>({
    resolver: zodResolver(submitSchema),
    defaultValues: { body: "" },
  });

  const onSubmit = async (values: SubmitValues) => {
    await canvas.submitTextEntry(courseId, assignmentId, values.body);
    onSuccess();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Your Response</CardTitle>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <RichTextField
              name="body"
              placeholder="Write your submission here..."
            />
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                size="sm"
              >
                <IconSend className="size-4" />
                {form.formState.isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
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
