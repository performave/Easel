import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCoursesStore } from "@/stores/courses";

export const Route = createFileRoute("/_app/courses/")({
  component: CoursesPage,
});

function CoursesPage() {
  const courses = useCoursesStore((s) => s.courses);
  const status = useCoursesStore((s) => s.status);
  const load = useCoursesStore((s) => s.load);

  useEffect(() => { if (status === "idle") load(); }, [status, load]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        <p className="text-sm text-muted-foreground">All your active enrollments.</p>
      </header>
      {status === "loading" && courses.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const enrollment = course.enrollments?.[0];
            return (
              <Link
                key={course.id}
                to="/courses/$courseId"
                params={{ courseId: String(course.id) }}
              >
                <Card className="h-full transition-colors hover:bg-accent">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{course.name}</CardTitle>
                      {enrollment?.computed_current_grade && (
                        <Badge variant="secondary">{enrollment.computed_current_grade}</Badge>
                      )}
                    </div>
                    <CardDescription>
                      {course.course_code}
                      {course.term?.name ? ` · ${course.term.name}` : ""}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
