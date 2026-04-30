import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { canvas, type Announcement } from "@/lib/api";
import { CanvasHtml } from "@/lib/html";
import { useCoursesStore } from "@/stores/courses";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_app/announcements")({
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const courses = useCoursesStore((s) => s.courses);
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);

  useEffect(() => {
    if (courses.length === 0) {
      setAnnouncements([]);
      return;
    }
    let cancelled = false;
    const codes = courses.map((c) => `course_${c.id}`);
    canvas.announcements(codes).then((v) => !cancelled && setAnnouncements(v)).catch(() => !cancelled && setAnnouncements([]));
    return () => { cancelled = true; };
  }, [courses]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">All announcements across your active courses.</p>
      </header>
      {announcements === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to read.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const courseCode = a.context_code?.replace("course_", "");
            const course = courseCode ? courses.find((c) => String(c.id) === courseCode) : undefined;
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
    </div>
  );
}
