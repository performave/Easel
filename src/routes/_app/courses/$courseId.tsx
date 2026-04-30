import { useEffect, useState } from "react";
import { Link, Outlet, createFileRoute, useLocation, useParams } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { canvas, type Course } from "@/lib/api";
import { useCoursesStore } from "@/stores/courses";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/courses/$courseId")({
  component: CourseLayout,
});

const TABS = [
  { to: "", label: "Home" },
  { to: "/modules", label: "Modules" },
  { to: "/assignments", label: "Assignments" },
  { to: "/grades", label: "Grades" },
  { to: "/discussions", label: "Discussions" },
  { to: "/files", label: "Files" },
  { to: "/people", label: "People" },
  { to: "/syllabus", label: "Syllabus" },
] as const;

function CourseLayout() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId" });
  const id = Number(courseId);
  const fromStore = useCoursesStore((s) => s.byId(id));
  const [course, setCourse] = useState<Course | null>(fromStore ?? null);
  const location = useLocation();

  useEffect(() => {
    if (fromStore) setCourse(fromStore);
  }, [fromStore]);

  useEffect(() => {
    let cancelled = false;
    canvas.course(id).then((c) => !cancelled && setCourse(c)).catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  const base = `/courses/${courseId}`;
  const activeTab = (() => {
    const rest = location.pathname.slice(base.length);
    for (const t of TABS) {
      if (t.to === "" && (rest === "" || rest === "/")) return t.to;
      if (t.to !== "" && rest.startsWith(t.to)) return t.to;
    }
    return "";
  })();

  return (
    <div className="flex flex-col">
      <div className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-6 pb-0 pt-6">
          {course ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {course.course_code}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">{course.name}</h1>
              {course.term?.name && (
                <p className="text-sm text-muted-foreground">{course.term.name}</p>
              )}
            </>
          ) : (
            <Skeleton className="h-9 w-2/3" />
          )}
          <nav className="mt-4 flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={`${base}${tab.to}`}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  activeTab === tab.to
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
}
