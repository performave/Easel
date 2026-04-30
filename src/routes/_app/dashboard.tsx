import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { IconCalendarTime, IconChecklist, IconSpeakerphone } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { canvas, type Announcement, type CalendarEvent, type ToDoItem } from "@/lib/api";
import { useCoursesStore } from "@/stores/courses";
import { formatRelativeDate } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const courses = useCoursesStore((s) => s.courses);
  const [todo, setTodo] = useState<ToDoItem[] | null>(null);
  const [upcoming, setUpcoming] = useState<CalendarEvent[] | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    canvas.todo().then((v) => !cancelled && setTodo(v)).catch(() => !cancelled && setTodo([]));
    canvas.upcomingEvents().then((v) => !cancelled && setUpcoming(v)).catch(() => !cancelled && setUpcoming([]));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (courses.length === 0) return;
    let cancelled = false;
    const codes = courses.slice(0, 10).map((c) => `course_${c.id}`);
    canvas
      .announcements(codes)
      .then((v) => !cancelled && setAnnouncements(v.slice(0, 8)))
      .catch(() => !cancelled && setAnnouncements([]));
    return () => { cancelled = true; };
  }, [courses]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your active courses, upcoming work, and what's new.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconChecklist className="size-4" /> To-Do
            </CardTitle>
            <CardDescription>Items needing your attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {todo === null ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : todo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due. Nice.</p>
            ) : (
              todo.map((item, i) => (
                <a
                  key={i}
                  href={item.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-3 rounded-md border p-3 hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.assignment?.name ?? "Untitled"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.assignment?.due_at
                        ? `Due ${formatRelativeDate(item.assignment.due_at)}`
                        : "No due date"}
                    </p>
                  </div>
                  {item.assignment?.points_possible != null && (
                    <Badge variant="secondary" className="shrink-0">
                      {item.assignment.points_possible} pts
                    </Badge>
                  )}
                </a>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconCalendarTime className="size-4" /> Upcoming
            </CardTitle>
            <CardDescription>Next on your calendar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming === null ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              upcoming.slice(0, 6).map((ev) => (
                <div key={ev.id} className="rounded-md border p-2">
                  <p className="truncate text-sm font-medium">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ev.start_at ? formatRelativeDate(ev.start_at) : "No date"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconSpeakerphone className="size-4" /> Recent Announcements
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {announcements === null ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent announcements.</p>
          ) : (
            announcements.map((a) => (
              <div key={a.id} className="rounded-md border p-3">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.author?.display_name ?? "Unknown"} · {a.posted_at ? formatRelativeDate(a.posted_at) : "—"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Active courses</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              to="/courses/$courseId"
              params={{ courseId: String(c.id) }}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
            >
              <p className="text-xs text-muted-foreground">{c.course_code}</p>
              <p className="mt-1 line-clamp-2 font-medium leading-tight">{c.name}</p>
              {c.term?.name && (
                <p className="mt-2 text-xs text-muted-foreground">{c.term.name}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
