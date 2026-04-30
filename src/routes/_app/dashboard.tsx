import { useEffect, useMemo, useRef, useState, type ChangeEventHandler } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconCalendarTime,
  IconChecklist,
  IconGripVertical,
  IconPalette,
  IconRestore,
  IconSpeakerphone,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, canvas, type Announcement, type CalendarEvent, type Course, type ToDoItem } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCoursesStore } from "@/stores/courses";
import { todoItemKey, useDashboardPrefsStore } from "@/stores/dashboard-prefs";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const maybeMessage = Reflect.get(error, "message");
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
    const maybeError = Reflect.get(error, "error");
    if (typeof maybeError === "string" && maybeError.trim()) return maybeError;
    const maybeRaw = Reflect.get(error, "raw");
    if (typeof maybeRaw === "string" && maybeRaw.trim()) return maybeRaw;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function isNoNicknameToClearError(message: string) {
  return message.includes("canvas error 404") && message.includes("no nickname exists for course");
}

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const courses = useCoursesStore((s) => s.courses);
  const [todo, setTodo] = useState<ToDoItem[] | null>(null);
  const [upcoming, setUpcoming] = useState<CalendarEvent[] | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  const dismissedTodoKeys = useDashboardPrefsStore((s) => s.dismissedTodoKeys);
  const dismissTodo = useDashboardPrefsStore((s) => s.dismissTodo);
  const undismissTodo = useDashboardPrefsStore((s) => s.undismissTodo);
  const courseOrder = useDashboardPrefsStore((s) => s.courseOrder);
  const setCourseOrder = useDashboardPrefsStore((s) => s.setCourseOrder);
  const hydrateRemote = useDashboardPrefsStore((s) => s.hydrateRemote);

  useEffect(() => {
    let cancelled = false;
    api.currentUser().then((u) => !cancelled && setUserId(u.id)).catch(() => !cancelled && setUserId(null));
    canvas.todo().then((v) => !cancelled && setTodo(v)).catch(() => !cancelled && setTodo([]));
    canvas.upcomingEvents().then((v) => !cancelled && setUpcoming(v)).catch(() => !cancelled && setUpcoming([]));
    if (userId == null) {
      return () => {
        cancelled = true;
      };
    }
    void Promise.allSettled([canvas.courseNicknames(), canvas.dashboardPositions(userId), canvas.colors(userId)]).then((results) => {
      if (cancelled) return;
      const nicknamesResult = results[0].status === "fulfilled" ? results[0].value : {};
      const positionsResult =
        results[1].status === "fulfilled" ? results[1].value.dashboard_positions : ({} as Record<string, number>);
      const colorsResult = results[2].status === "fulfilled" ? results[2].value.custom_colors : {};
      const nicknames: Record<number, string> = {};
      for (const [courseId, nickname] of Object.entries(nicknamesResult)) {
        const parsed = Number(courseId);
        if (!Number.isNaN(parsed) && nickname) nicknames[parsed] = nickname;
      }
      const order = Object.entries(positionsResult)
        .filter(([asset]) => asset.startsWith("course_"))
        .sort((a, b) => a[1] - b[1])
        .map(([asset]) => Number(asset.replace("course_", "")))
        .filter((id) => !Number.isNaN(id));
      const colors: Record<number, string> = {};
      for (const [asset, color] of Object.entries(colorsResult)) {
        if (!asset.startsWith("course_")) continue;
        const id = Number(asset.replace("course_", ""));
        if (!Number.isNaN(id) && color) colors[id] = color.startsWith("#") ? color : `#${color}`;
      }
      hydrateRemote({ order, nicknames, colors });
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateRemote, userId]);

  useEffect(() => {
    if (courses.length === 0) return;
    let cancelled = false;
    const codes = courses.slice(0, 10).map((c) => `course_${c.id}`);
    canvas
      .announcements(codes)
      .then((v) => !cancelled && setAnnouncements(v.slice(0, 8)))
      .catch(() => !cancelled && setAnnouncements([]));
    return () => {
      cancelled = true;
    };
  }, [courses]);

  const orderedCourses = useMemo(() => {
    if (courses.length === 0) return [];
    const map = new Map(courses.map((c) => [c.id, c]));
    const ordered = courseOrder.map((id) => map.get(id)).filter(Boolean) as Course[];
    const seen = new Set(ordered.map((c) => c.id));
    const extras = courses.filter((c) => !seen.has(c.id));
    return [...ordered, ...extras];
  }, [courses, courseOrder]);

  useEffect(() => {
    if (orderedCourses.length === 0) return;
    const ids = orderedCourses.map((c) => c.id);
    const same = ids.length === courseOrder.length && ids.every((id, idx) => id === courseOrder[idx]);
    if (!same) setCourseOrder(ids);
  }, [orderedCourses, setCourseOrder, courseOrder]);

  const todoWithKeys = useMemo(
    () =>
      (todo ?? []).map((item) => ({
        item,
        key: todoItemKey({
          courseId: item.course_id,
          assignmentId: item.assignment?.id,
          htmlUrl: item.html_url,
        }),
      })),
    [todo],
  );

  const activeTodo = todoWithKeys.filter((v) => !dismissedTodoKeys[v.key]);
  const dismissedTodo = todoWithKeys.filter((v) => dismissedTodoKeys[v.key]);

  return (
    <div className="dashboard-shell mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your active courses, upcoming work, and what&apos;s new.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="border-0 bg-card/70 shadow-sm ring-1 ring-foreground/8 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconChecklist className="size-4" /> To-Do
            </CardTitle>
            <CardDescription>Items needing your attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {todo === null ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
            ) : activeTodo.length === 0 && dismissedTodo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due. Nice.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {activeTodo.map(({ item, key }) => (
                    <div key={key} className="flex items-start gap-3 rounded-xl border bg-background/80 p-3">
                      <a href={item.html_url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.assignment?.name ?? "Untitled"}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.assignment?.due_at ? `Due ${formatRelativeDate(item.assignment.due_at)}` : "No due date"}
                        </p>
                      </a>
                      {item.assignment?.points_possible != null && (
                        <Badge variant="secondary" className="shrink-0">{item.assignment.points_possible} pts</Badge>
                      )}
                      <Button size="icon-sm" variant="ghost" onClick={() => dismissTodo(key)} aria-label="Dismiss item">
                        <IconX className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {dismissedTodo.length > 0 && (
                  <Collapsible className="rounded-xl border bg-muted/20">
                    <CollapsibleTrigger render={<button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium" />}>
                      Dismissed ({dismissedTodo.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 px-3 pb-3">
                      {dismissedTodo.map(({ item, key }) => (
                        <div key={key} className="flex items-start gap-3 rounded-lg border bg-background/80 p-3">
                          <a href={item.html_url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                            <p className="truncate text-sm text-muted-foreground line-through">{item.assignment?.name ?? "Untitled"}</p>
                            <p className="text-xs text-muted-foreground">{item.assignment?.due_at ? `Due ${formatRelativeDate(item.assignment.due_at)}` : "No due date"}</p>
                          </a>
                          <Button size="icon-sm" variant="ghost" onClick={() => undismissTodo(key)} aria-label="Restore item">
                            <IconRestore className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-card/70 shadow-sm ring-1 ring-foreground/8 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IconCalendarTime className="size-4" /> Upcoming
            </CardTitle>
            <CardDescription>Next on your calendar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming === null ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              upcoming.slice(0, 6).map((ev) => (
                <div key={ev.id} className="rounded-lg border bg-background/80 p-2.5">
                  <p className="truncate text-sm font-medium">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">{ev.start_at ? formatRelativeDate(ev.start_at) : "No date"}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-card/70 shadow-sm ring-1 ring-foreground/8 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconSpeakerphone className="size-4" /> Recent Announcements
          </CardTitle>
          <CardDescription>Updates pulled from your active courses.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {announcements === null ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
          ) : announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent announcements.</p>
          ) : (
            announcements.map((a) => {
              const course = courses.find((c) => a.context_code === `course_${c.id}`);
              return (
                <a
                  key={a.id}
                  href={a.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-xl border bg-background/80 p-3 transition-all hover:-translate-y-0.5 hover:bg-background hover:shadow-sm"
                >
                  <p className="truncate text-sm font-semibold group-hover:text-primary">{a.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {course?.course_code ?? course?.name ?? "Unknown course"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.author?.display_name ?? "Unknown"} · {a.posted_at ? formatRelativeDate(a.posted_at) : "—"}
                  </p>
                </a>
              );
            })
          )}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-medium">Active courses</h2>
        <CourseGrid courses={orderedCourses} onReorder={setCourseOrder} userId={userId} />
      </section>
    </div>
  );
}

function CourseGrid({
  courses,
  onReorder,
  userId,
}: {
  courses: Course[];
  onReorder: (order: number[]) => void;
  userId: number | null;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = courses.findIndex((c) => c.id === active.id);
    const newIndex = courses.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(courses, oldIndex, newIndex);
    onReorder(reordered.map((c) => c.id));
    const payload: Record<string, number> = {};
    reordered.forEach((course, idx) => {
      payload[`course_${course.id}`] = idx + 1;
    });
    if (userId == null) return;
    try {
      await canvas.setDashboardPositions(userId, payload);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Canvas dashboard_positions sync failed:", message);
      toast.error(`Unable to sync order to Canvas: ${message}`);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={courses.map((c) => c.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-3 [grid-auto-rows:1fr] sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <SortableCourseCard key={course.id} course={course} userId={userId} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
function SortableCourseCard({ course, userId }: { course: Course; userId: number | null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const nickname = useDashboardPrefsStore((s) => s.courseNicknames[course.id]);
  const theme = useDashboardPrefsStore((s) => s.courseThemes[course.id]);

  return (
    <div ref={setNodeRef} style={style} className={cn("h-full", isDragging && "z-30 opacity-70")}> 
      <article className="flex h-full min-h-[17.5rem] flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div
          className="relative h-24 border-b"
          style={{
            background: theme?.bannerImageDataUrl
              ? `center / cover no-repeat url(${theme.bannerImageDataUrl})`
              : `linear-gradient(145deg, ${theme?.bannerColor ?? "#6ea8a2"}, #1f2937)`,
          }}
        >
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
            <button
              type="button"
              className="cursor-grab touch-none rounded bg-black/35 p-1 text-white active:cursor-grabbing"
              {...attributes}
              {...listeners}
              aria-label="Drag course"
            >
              <IconGripVertical className="size-4" />
            </button>
            <CourseCustomizeButton course={course} userId={userId} />
          </div>
        </div>
        <Link to="/courses/$courseId" params={{ courseId: String(course.id) }} className="flex min-h-0 flex-1">
          <div className="flex w-full flex-col gap-1 p-4">
            <p className="text-xs text-muted-foreground">{course.course_code}</p>
            <p className="line-clamp-3 text-base font-semibold leading-tight">{nickname || course.name}</p>
            <p className="mt-auto text-xs text-muted-foreground">{course.term?.name ?? " "}</p>
          </div>
        </Link>
      </article>
    </div>
  );
}

function CourseCustomizeButton({ course, userId }: { course: Course; userId: number | null }) {
  const setNickname = useDashboardPrefsStore((s) => s.setCourseNickname);
  const clearNickname = useDashboardPrefsStore((s) => s.clearCourseNickname);
  const setCourseTheme = useDashboardPrefsStore((s) => s.setCourseTheme);
  const clearCourseBannerImage = useDashboardPrefsStore((s) => s.clearCourseBannerImage);
  const nickname = useDashboardPrefsStore((s) => s.courseNicknames[course.id] ?? "");
  const color = useDashboardPrefsStore((s) => s.courseThemes[course.id]?.bannerColor ?? "#6ea8a2");
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(nickname);
  const [draftColor, setDraftColor] = useState(color);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraftName(nickname);
    setDraftColor(color);
  }, [open, nickname, color]);

  const save = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 59) {
      toast.error("Nickname must be shorter than 60 characters.");
      return;
    }
    let canvasSyncFailed = false;
    const syncErrors: string[] = [];
    const priorNickname = nickname.trim();
    const nicknameChanged = trimmed !== priorNickname;

    if (nicknameChanged) {
      try {
        if (!trimmed) {
          clearNickname(course.id);
          await canvas.clearCourseNickname(course.id);
        } else {
          setNickname(course.id, trimmed);
          await canvas.setCourseNickname(course.id, trimmed);
        }
      } catch (error) {
        const message = getErrorMessage(error);
        if (!isNoNicknameToClearError(message)) {
          console.error("Canvas nickname sync failed:", message);
          canvasSyncFailed = true;
          syncErrors.push(`nickname: ${message}`);
        }
      }
    }
    setCourseTheme(course.id, { bannerColor: draftColor });
    try {
      if (userId == null) throw new Error("current user unavailable");
      await canvas.setCourseColor(userId, course.id, draftColor);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Canvas color sync failed:", message);
      canvasSyncFailed = true;
      syncErrors.push(`color: ${message}`);
    }
    if (canvasSyncFailed) {
      toast.error(`Saved locally. Canvas sync failed (${syncErrors.join(" | ")}).`);
    } else {
      toast.success("Course customization saved.");
    }
    setOpen(false);
  };

  const onFileSelect: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : undefined;
      if (!dataUrl) return;
      setCourseTheme(course.id, { bannerImageDataUrl: dataUrl });
    };
    reader.onerror = () => toast.error("Failed to load image.");
    reader.readAsDataURL(file);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="rounded bg-black/35 p-1 text-white"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.preventDefault()}
              aria-label="Customize course"
            >
              <IconPalette className="size-4" />
            </button>
          }
        />
        <DropdownMenuContent side="bottom" align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setOpen(true)}>Customize</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              clearCourseBannerImage(course.id);
            }}
          >
            Remove banner image
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Customize {course.course_code ?? "course"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Nickname</p>
              <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder={course.name} maxLength={59} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Banner color</p>
              <Input type="color" value={draftColor} onChange={(e) => setDraftColor(e.target.value)} className="h-10 p-1" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Banner image</p>
              <Input ref={fileRef} type="file" accept="image/*" onChange={onFileSelect} className="cursor-pointer" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
