import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { canvas, type Announcement, type Module } from "@/lib/api";
import { ModuleList } from "@/components/course/module-list";
import { formatRelativeDate } from "@/lib/format";

export const Route = createFileRoute("/_app/courses/$courseId/")({
  component: CourseHome,
});

function CourseHome() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/" });
  const id = Number(courseId);
  const [modules, setModules] = useState<Module[] | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    canvas.modules(id).then((v) => !cancelled && setModules(v)).catch(() => !cancelled && setModules([]));
    canvas
      .announcements([`course_${id}`])
      .then((v) => !cancelled && setAnnouncements(v.slice(0, 5)))
      .catch(() => !cancelled && setAnnouncements([]));
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Modules
        </h2>
        {modules === null ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : modules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No modules in this course.</p>
        ) : (
          <ModuleList courseId={id} modules={modules} />
        )}
      </section>
      <aside className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent announcements</CardTitle>
            <CardDescription>Latest from the course.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {announcements === null ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="rounded-md border p-2">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.posted_at ? formatRelativeDate(a.posted_at) : "—"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
