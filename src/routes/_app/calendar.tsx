import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, addMonths, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import type { CalendarEvent } from "@/lib/api";
import { calendarEventsQueryOptions } from "@/lib/queries";
import { parseCourseContextCode } from "@/lib/context-codes";
import { useCourses } from "@/hooks/use-courses";
import { useDashboardPrefsStore } from "@/stores/dashboard-prefs";
import { cn } from "@/lib/utils";
import { parseDate } from "@/lib/format";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { courses, isPending: coursesPending } = useCourses();
  const courseThemes = useDashboardPrefsStore((s) => s.courseThemes);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const courseIds = courses.map((c) => c.id);
  const start = format(gridStart, "yyyy-MM-dd");
  const end = format(addDays(gridStart, 41), "yyyy-MM-dd");

  const eventsQuery = useQuery(calendarEventsQueryOptions(start, end, courseIds, "event"));
  const assignmentsQuery = useQuery(calendarEventsQueryOptions(start, end, courseIds, "assignment"));
  const events = eventsQuery.data;
  const assignments = assignmentsQuery.data;

  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const all = useMemo(() => [...(events ?? []), ...(assignments ?? [])], [events, assignments]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of all) {
      const d = parseDate(ev.start_at);
      if (!d) continue;
      const key = format(d, "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [all]);

  const loading =
    coursesPending || (courseIds.length > 0 && (eventsQuery.isPending || assignmentsQuery.isPending));

  return (
    <PageContainer>
      <PageHeader
        title="Calendar"
        description="Events and due dates from your active courses."
        actions={
          <>
            <span className="min-w-[10ch] text-center text-sm font-medium">{format(cursor, "MMMM yyyy")}</span>
            <ButtonGroup>
              <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setCursor(subMonths(cursor, 1))}>
                <IconChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}>
                <IconChevronRight className="size-4" />
              </Button>
            </ButtonGroup>
          </>
        }
      />

      {loading ? (
        <Skeleton className="h-[28rem] w-full" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="border-r p-2 text-xs font-medium text-muted-foreground last:border-r-0">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6">
              {days.map((day, i) => {
                const inMonth = isSameMonth(day, cursor);
                const today = isSameDay(day, new Date());
                const dayEvents = eventsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[5.5rem] border-b border-r p-1.5 text-xs last:border-r-0",
                      !inMonth && "bg-muted/30 text-muted-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                        today && "bg-primary text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const cid = parseCourseContextCode(ev.context_code);
                        const color = cid != null ? courseThemes[cid]?.bannerColor : undefined;
                        return (
                          <a
                            key={`${ev.id}`}
                            href={ev.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate rounded border-l-2 bg-accent px-1.5 py-0.5 text-[11px] hover:bg-accent/80"
                            style={color ? { borderLeftColor: color, backgroundColor: `${color}1f` } : undefined}
                          >
                            {ev.title}
                          </a>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <p className="px-1.5 text-[10px] text-muted-foreground">
                          +{dayEvents.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
