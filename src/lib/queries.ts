import { queryOptions } from "@tanstack/react-query";
import { api, canvas } from "@/lib/api";
import { contextCode } from "@/lib/context-codes";

type CalendarEventType = "event" | "assignment";
type ConversationScope = "inbox" | "unread" | "starred" | "sent" | "archived";

export const tabsQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: ["tabs", courseId] as const,
    queryFn: () => canvas.tabs(courseId),
    staleTime: 10 * 60 * 1000,
  });

export const frontPageQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: ["frontPage", courseId] as const,
    queryFn: () => canvas.frontPage(courseId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

export const coursesQueryOptions = () =>
  queryOptions({
    queryKey: ["courses"] as const,
    queryFn: () => canvas.courses(),
    staleTime: 5 * 60 * 1000,
  });

export const queryKeys = {
  course: (courseId: number) => ["course", courseId] as const,
  modules: (courseId: number) => ["modules", courseId] as const,
  moduleItems: (courseId: number, moduleId: number) => ["moduleItems", courseId, moduleId] as const,
  announcements: (contextCodes: string[]) => ["announcements", ...contextCodes] as const,
  assignmentGroups: (courseId: number) => ["assignmentGroups", courseId] as const,
  assignment: (courseId: number, assignmentId: number) => ["assignment", courseId, assignmentId] as const,
  discussions: (courseId: number) => ["discussions", courseId] as const,
  enrollments: (courseId: number) => ["enrollments", courseId] as const,
  rootFolder: (courseId: number) => ["rootFolder", courseId] as const,
  folders: (courseId: number, folderId: number) => ["folders", courseId, folderId] as const,
  files: (courseId: number, folderId: number) => ["files", courseId, folderId] as const,
};

export const courseQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: queryKeys.course(courseId),
    queryFn: () => canvas.course(courseId),
    staleTime: 5 * 60 * 1000,
  });

export const modulesQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: queryKeys.modules(courseId),
    queryFn: () => canvas.modules(courseId),
    staleTime: 2 * 60 * 1000,
  });

export const moduleItemsQueryOptions = (courseId: number, moduleId: number) =>
  queryOptions({
    queryKey: queryKeys.moduleItems(courseId, moduleId),
    queryFn: () => canvas.moduleItems(courseId, moduleId),
    staleTime: 2 * 60 * 1000,
  });

export const courseAnnouncementsQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: queryKeys.announcements([contextCode(courseId)]),
    queryFn: () => canvas.announcements([contextCode(courseId)]),
    staleTime: 60 * 1000,
  });

export const assignmentGroupsQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: queryKeys.assignmentGroups(courseId),
    queryFn: () => canvas.assignmentGroups(courseId),
    staleTime: 2 * 60 * 1000,
  });

export const assignmentQueryOptions = (courseId: number, assignmentId: number) =>
  queryOptions({
    queryKey: queryKeys.assignment(courseId, assignmentId),
    queryFn: () => canvas.assignment(courseId, assignmentId),
    staleTime: 2 * 60 * 1000,
  });

export const discussionsQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: queryKeys.discussions(courseId),
    queryFn: () => canvas.discussions(courseId),
    staleTime: 2 * 60 * 1000,
  });

export const enrollmentsQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: queryKeys.enrollments(courseId),
    queryFn: () => canvas.enrollments(courseId),
    staleTime: 5 * 60 * 1000,
  });

export const rootFolderQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: queryKeys.rootFolder(courseId),
    queryFn: () => canvas.rootFolder(courseId),
    staleTime: 10 * 60 * 1000,
  });

export const foldersQueryOptions = (courseId: number, folderId: number) =>
  queryOptions({
    queryKey: queryKeys.folders(courseId, folderId),
    queryFn: () => canvas.folders(courseId, folderId),
    staleTime: 2 * 60 * 1000,
  });

export const filesQueryOptions = (courseId: number, folderId: number) =>
  queryOptions({
    queryKey: queryKeys.files(courseId, folderId),
    queryFn: () => canvas.files(courseId, folderId),
    staleTime: 2 * 60 * 1000,
  });

// --- User / cross-course (dashboard, inbox, calendar, announcements) ---

export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: ["currentUser"] as const,
    queryFn: () => api.currentUser(),
    staleTime: 30 * 60 * 1000,
  });

export const todoQueryOptions = () =>
  queryOptions({
    queryKey: ["todo"] as const,
    queryFn: () => canvas.todo(),
    staleTime: 60 * 1000,
  });

export const upcomingEventsQueryOptions = () =>
  queryOptions({
    queryKey: ["upcomingEvents"] as const,
    queryFn: () => canvas.upcomingEvents(),
    staleTime: 2 * 60 * 1000,
  });

export const courseNicknamesQueryOptions = () =>
  queryOptions({
    queryKey: ["courseNicknames"] as const,
    queryFn: () => canvas.courseNicknames(),
    staleTime: 10 * 60 * 1000,
  });

export const dashboardPositionsQueryOptions = (userId: number) =>
  queryOptions({
    queryKey: ["dashboardPositions", userId] as const,
    queryFn: () => canvas.dashboardPositions(userId),
    staleTime: 10 * 60 * 1000,
  });

export const colorsQueryOptions = (userId: number) =>
  queryOptions({
    queryKey: ["colors", userId] as const,
    queryFn: () => canvas.colors(userId),
    staleTime: 10 * 60 * 1000,
  });

export const conversationsQueryOptions = (scope: ConversationScope) =>
  queryOptions({
    queryKey: ["conversations", scope] as const,
    queryFn: () => canvas.conversations(scope),
    staleTime: 60 * 1000,
  });

export const conversationQueryOptions = (id: number) =>
  queryOptions({
    queryKey: ["conversation", id] as const,
    queryFn: () => canvas.conversation(id),
    staleTime: 60 * 1000,
  });

export const announcementsQueryOptions = (courseIds: number[]) =>
  queryOptions({
    queryKey: queryKeys.announcements(courseIds.map(contextCode)),
    queryFn: () => canvas.announcements(courseIds.map(contextCode)),
    staleTime: 60 * 1000,
    enabled: courseIds.length > 0,
  });

export const calendarEventsQueryOptions = (
  start: string,
  end: string,
  courseIds: number[],
  type: CalendarEventType,
) =>
  queryOptions({
    queryKey: ["calendarEvents", start, end, type, ...courseIds] as const,
    queryFn: () => canvas.calendarEvents(start, end, courseIds.map(contextCode), type),
    staleTime: 2 * 60 * 1000,
    enabled: courseIds.length > 0,
  });
