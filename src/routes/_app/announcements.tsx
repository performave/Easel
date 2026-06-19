import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { IconSpeakerphone } from "@tabler/icons-react";
import { CanvasHtml } from "@/lib/html";
import { parseCourseContextCode } from "@/lib/context-codes";
import { announcementsQueryOptions } from "@/lib/queries";
import { useCourses } from "@/hooks/use-courses";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_app/announcements")({
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { courses, isPending: coursesPending } = useCourses();
  const courseIds = courses.map((c) => c.id);
  const { data, isPending } = useQuery(announcementsQueryOptions(courseIds));
  const announcements = data ?? [];
  const loading = coursesPending || (courseIds.length > 0 && isPending);

  return (
    <PageContainer size="narrow">
      <PageHeader title="Announcements" description="All announcements across your active courses." />
      {loading ? (
        <SkeletonList count={4} className="h-32 w-full" wrapperClassName="space-y-3" />
      ) : announcements.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconSpeakerphone />
            </EmptyMedia>
            <EmptyTitle>Nothing to read</EmptyTitle>
            <EmptyDescription>New announcements from your courses will appear here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const courseId = parseCourseContextCode(a.context_code);
            const course = courseId != null ? courses.find((c) => c.id === courseId) : undefined;
            return (
              <Card key={a.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{a.title}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {course?.course_code ?? course?.name ?? "—"} ·{" "}
                        {a.author?.display_name ?? "Unknown"} ·{" "}
                        {a.posted_at ? formatRelative(a.posted_at) : ""}
                      </p>
                    </div>
                    <Avatar className="size-8">
                      <AvatarImage src={a.author?.avatar_image_url} alt={a.author?.display_name} />
                      <AvatarFallback className="text-xs">
                        {a.author?.display_name?.[0] ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </CardHeader>
                <CardContent>
                  <CanvasHtml html={a.message} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
