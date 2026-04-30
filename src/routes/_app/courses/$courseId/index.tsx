import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleList } from "@/components/course/module-list";
import { formatRelativeDate } from "@/lib/format";
import { courseAnnouncementsQueryOptions, modulesQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_app/courses/$courseId/")({
  loader: async ({ context, params }) => {
    const id = Number(params.courseId);
    await Promise.all([
      context.queryClient.ensureQueryData(modulesQueryOptions(id)),
      context.queryClient.ensureQueryData(courseAnnouncementsQueryOptions(id)),
    ]);
  },
  component: CourseHome,
});

function CourseHome() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId/" });
  const id = Number(courseId);
  const { data: modulesData, isPending: modulesPending } = useQuery(modulesQueryOptions(id));
  const { data: announcementsData, isPending: announcementsPending } = useQuery(courseAnnouncementsQueryOptions(id));
  const modules = modulesData ?? [];
  const announcements = announcementsData ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Modules
        </h2>
        {modulesPending ? (
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
            {announcementsPending ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            ) : (
              announcements.slice(0, 5).map((a) => (
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
