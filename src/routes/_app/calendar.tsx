import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, addMonths, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { canvas, type CalendarEvent } from "@/lib/api";
import { useCoursesStore } from "@/stores/courses";
import { cn } from "@/lib/utils";
import { parseDate } from "@/lib/format";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const courses = useCoursesStore((s) => s.courses);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [assignments, setAssignments] = useState<CalendarEvent[] | null>(null);

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });

  useEffect(() => {
    if (courses.length === 0) {
      setEvents([]);
      setAssignments([]);
      return;
    }
    let cancelled = false;
    setEvents(null);
    setAssignments(null);
    const codes = courses.map((c) => `course_${c.id}`);
    const start = format(gridStart, "yyyy-MM-dd");
    const end = format(addDays(gridStart, 41), "yyyy-MM-dd");
    canvas
      .calendarEvents(start, end, codes, "event")
      .then((v) => !cancelled && setEvents(v))
      .catch(() => !cancelled && setEvents([]));
    canvas
      .calendarEvents(start, end, codes, "assignment")
      .then((v) => !cancelled && setAssignments(v))
      .catch(() => !cancelled && setAssignments([]));
    return () => { cancelled = true; };
  }, [courses, gridStart.getTime()]);

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

  const loading = events === null || assignments === null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Events and due dates from your active courses.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setCursor(subMonths(cursor, 1))}>
            <IconChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[10ch] text-center text-sm font-medium">{format(cursor, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setCursor(addMonths(cursor, 1))}>
            <IconChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Today
          </Button>
        </div>
      </header>

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
                      {dayEvents.slice(0, 3).map((ev) => (
                        <a
                          key={`${ev.id}`}
                          href={ev.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate rounded bg-accent px-1.5 py-0.5 text-[11px] hover:bg-accent/80"
                        >
                          {ev.title}
                        </a>
                      ))}
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
    </div>
  );
}
