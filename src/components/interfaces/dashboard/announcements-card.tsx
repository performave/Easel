import { useQuery } from "@tanstack/react-query";
import { IconSpeakerphone } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type Course } from "@/lib/api";
import { contextCode } from "@/lib/context-codes";
import { announcementsQueryOptions } from "@/lib/queries";
import { formatRelativeDate } from "@/lib/format";

export function AnnouncementsCard({ courses, coursesPending }: { courses: Course[]; coursesPending: boolean }) {
  const courseIds = courses.slice(0, 10).map((c) => c.id);
  const announcementsQuery = useQuery(announcementsQueryOptions(courseIds));
  const announcements = announcementsQuery.data?.slice(0, 8);
  const loading = coursesPending || (courseIds.length > 0 && announcementsQuery.isPending);

  return (
    <Card className="border-0 bg-card/70 shadow-sm ring-1 ring-foreground/8 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconSpeakerphone className="size-4" /> Recent Announcements
        </CardTitle>
        <CardDescription>Updates pulled from your active courses.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : !announcements || announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent announcements.</p>
        ) : (
          announcements.map((a) => {
            const course = courses.find((c) => a.context_code === contextCode(c.id));
            return (
              <a
                key={a.id}
                href={a.html_url}
                target="_blank"
                rel="noreferrer"
                className="group rounded-xl border bg-background/80 p-3 transition-all hover:-translate-y-0.5 hover:bg-background hover:shadow-sm"
              >
                <p className="truncate text-sm font-semibold group-hover:text-primary">{a.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {course?.course_code ?? course?.name ?? "Unknown course"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.author?.display_name ?? "Unknown"} · {a.posted_at ? formatRelativeDate(a.posted_at) : "—"}
                </p>
              </a>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
