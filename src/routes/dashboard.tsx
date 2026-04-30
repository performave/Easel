import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, type CanvasUser, type Course } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const domain = useAuthStore((s) => s.domain);
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);
  const [user, setUser] = useState<CanvasUser | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.currentUser(), api.listCourses()])
      .then(([u, c]) => {
        if (cancelled) return;
        setUser(u);
        setCourses(c);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        if (message.toLowerCase().includes("session expired") || message.includes("not authenticated")) {
          setUnauthenticated();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setUnauthenticated]);

  const onLogout = async () => {
    try {
      await api.logout();
      setUnauthenticated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Slayte</h1>
            <p className="text-sm text-muted-foreground">
              {user ? `Signed in as ${user.name}` : "Loading user…"}
              {domain ? ` · ${domain}` : ""}
            </p>
          </div>
          <Button variant="outline" onClick={onLogout}>
            Sign out
          </Button>
        </header>

        {error && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Something went wrong</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Active courses</h2>
          {courses === null && !error && (
            <p className="text-sm text-muted-foreground">Loading courses…</p>
          )}
          {courses && courses.length === 0 && (
            <p className="text-sm text-muted-foreground">No active enrollments.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {courses?.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <CardTitle className="text-base">{course.name}</CardTitle>
                  {course.course_code && (
                    <CardDescription>{course.course_code}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {course.workflow_state ?? "—"}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
