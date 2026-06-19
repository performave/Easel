import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, createFileRoute, useLocation, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { courseQueryOptions, modulesQueryOptions, assignmentGroupsQueryOptions, discussionsQueryOptions, enrollmentsQueryOptions, rootFolderQueryOptions, tabsQueryOptions } from "@/lib/queries";
import { useCourse } from "@/hooks/use-courses";
import { useDashboardPrefsStore } from "@/stores/dashboard-prefs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/courses/$courseId")({
  loader: ({ context, params }) => {
    const id = Number(params.courseId);
    void context.queryClient.prefetchQuery(courseQueryOptions(id));
    void context.queryClient.prefetchQuery(modulesQueryOptions(id));
    void context.queryClient.prefetchQuery(assignmentGroupsQueryOptions(id));
    void context.queryClient.prefetchQuery(discussionsQueryOptions(id));
    void context.queryClient.prefetchQuery(enrollmentsQueryOptions(id));
    void context.queryClient.prefetchQuery(rootFolderQueryOptions(id));
    void context.queryClient.prefetchQuery(tabsQueryOptions(id));
  },
  component: CourseLayout,
});

const TAB_ROUTE_MAP: Record<string, string> = {
  home: "",
  modules: "/modules",
  assignments: "/assignments",
  grades: "/grades",
  discussions: "/discussions",
  files: "/files",
  people: "/people",
  syllabus: "/syllabus",
};

function CourseLayout() {
  const { courseId } = useParams({ from: "/_app/courses/$courseId" });
  const id = Number(courseId);
  const { data: fromList } = useCourse(id);
  const { data: course } = useQuery({
    ...courseQueryOptions(id),
    placeholderData: fromList,
  });
  const { data: canvasTabs } = useQuery(tabsQueryOptions(id));
  const location = useLocation();
  const courseNicknames = useDashboardPrefsStore((s) => s.courseNicknames);
  const hiddenCourseTabs = useDashboardPrefsStore((s) => s.hiddenCourseTabs);
  const toggleCourseTab = useDashboardPrefsStore((s) => s.toggleCourseTab);
  const queryClient = Route.useRouteContext({ select: (ctx) => ctx.queryClient });

  // Collapse the title section when the user scrolls down so only the tab bar
  // remains visible — keeping the tab bar outside the scroll container avoids
  // the WebKit overlay-scrollbar clipping issue entirely.
  const titleRef = useRef<HTMLDivElement>(null);
  const [titleCollapsed, setTitleCollapsed] = useState(false);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const titleH = titleRef.current?.offsetHeight ?? 80;
    setTitleCollapsed(e.currentTarget.scrollTop > titleH * 0.4);
  }, []);

  // Reset collapse when navigating to a different course.
  useEffect(() => {
    setTitleCollapsed(false);
  }, [id]);

  useEffect(() => {
    void queryClient.prefetchQuery(modulesQueryOptions(id));
    void queryClient.prefetchQuery(assignmentGroupsQueryOptions(id));
    void queryClient.prefetchQuery(discussionsQueryOptions(id));
    void queryClient.prefetchQuery(enrollmentsQueryOptions(id));
    void queryClient.prefetchQuery(rootFolderQueryOptions(id));
    void queryClient.prefetchQuery(tabsQueryOptions(id));
  }, [id, queryClient]);

  const userHidden = hiddenCourseTabs[id] ?? [];
  const tabs = (canvasTabs ?? [])
    .filter((t) => !t.hidden && t.id in TAB_ROUTE_MAP)
    .sort((a, b) => a.position - b.position)
    .map((t) => ({ id: t.id, label: t.label, to: TAB_ROUTE_MAP[t.id] }));

  const visibleTabs = tabs.filter((t) => t.id === "home" || !userHidden.includes(t.id));

  const allSupportedTabs = (canvasTabs ?? [])
    .filter((t) => !t.hidden && t.id in TAB_ROUTE_MAP)
    .sort((a, b) => a.position - b.position);

  const base = `/courses/${courseId}`;
  const activeTab = (() => {
    const rest = location.pathname.slice(base.length);
    for (const t of visibleTabs) {
      if (t.to === "" && (rest === "" || rest === "/")) return t.to;
      if (t.to !== "" && rest.startsWith(t.to)) return t.to;
    }
    return "";
  })();

  return (
    <div className="flex flex-col h-full w-full min-w-0">
      {/* Title — collapses as you scroll, outside the scroll container so
          the scrollbar never clips the tab bar below it. */}
      <div
        ref={titleRef}
        className={cn(
          "shrink-0 overflow-hidden bg-background transition-[max-height,opacity,padding] duration-200 ease-in-out",
          titleCollapsed ? "max-h-0 opacity-0 pt-0 pb-0" : "max-h-40 opacity-100 pt-6 pb-4",
        )}
      >
        <div className="mx-auto max-w-6xl px-6">
          {course ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {course.course_code}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">{courseNicknames[course.id] ?? course.name}</h1>
              {course.term?.name && (
                <p className="text-sm text-muted-foreground">{course.term.name}</p>
              )}
            </>
          ) : (
            <Skeleton className="h-9 w-2/3" />
          )}
        </div>
      </div>

      {/* Tab bar — always visible, outside scroll, never clipped by scrollbar */}
      <div className="shrink-0 border-b bg-background">
        <div className="mx-auto max-w-6xl px-6 flex items-center gap-1">
          <nav className="flex gap-1 overflow-x-auto flex-1 min-w-0">
            {(canvasTabs ? visibleTabs : []).map((tab) => (
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
            {!canvasTabs && (
              <div className="flex gap-1 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-20" />
                ))}
              </div>
            )}
          </nav>
          {canvasTabs && allSupportedTabs.length > 1 && (
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                    title="Customize tabs"
                  >
                    <IconAdjustmentsHorizontal className="h-4 w-4" />
                  </Button>
                }
              />
              <PopoverContent className="w-56 p-2" align="end">
                <p className="text-xs font-semibold text-muted-foreground px-3 py-1.5">Customize tabs</p>
                <div className="space-y-0.5">
                  {allSupportedTabs.map((tab) => {
                    const isHome = tab.id === "home";
                    const isHidden = !isHome && userHidden.includes(tab.id);
                    return (
                      <label
                        key={tab.id}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 cursor-pointer select-none",
                          isHome ? "opacity-50 cursor-not-allowed" : "hover:bg-muted",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          disabled={isHome}
                          onChange={() => !isHome && toggleCourseTab(id, tab.id)}
                          className="accent-primary"
                        />
                        <span className="text-sm font-medium">{tab.label}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Scrollable content — scrollbar lives entirely here, below the tab bar */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        onScroll={handleScroll}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-6">
          <Outlet />
        </div>
      </div>


    </div>
  );
}
