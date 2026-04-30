import { queryOptions } from "@tanstack/react-query";
import { canvas } from "@/lib/api";

export const queryKeys = {
  course: (courseId: number) => ["course", courseId] as const,
  modules: (courseId: number) => ["modules", courseId] as const,
  announcements: (contextCodes: string[]) => ["announcements", ...contextCodes] as const,
  assignmentGroups: (courseId: number) => ["assignmentGroups", courseId] as const,
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

export const courseAnnouncementsQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: queryKeys.announcements([`course_${courseId}`]),
    queryFn: () => canvas.announcements([`course_${courseId}`]),
    staleTime: 60 * 1000,
  });

export const assignmentGroupsQueryOptions = (courseId: number) =>
  queryOptions({
    queryKey: queryKeys.assignmentGroups(courseId),
    queryFn: () => canvas.assignmentGroups(courseId),
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
