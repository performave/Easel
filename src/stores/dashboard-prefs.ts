import { create } from "zustand";
import { persist } from "zustand/middleware";

type CourseTheme = {
  bannerColor?: string;
  bannerImageDataUrl?: string;
};

type DashboardPrefsState = {
  courseOrder: number[];
  courseNicknames: Record<number, string>;
  courseThemes: Record<number, CourseTheme>;
  dismissedTodoKeys: Record<string, { dismissedAt: string }>;
  setCourseOrder: (order: number[]) => void;
  setCourseNickname: (courseId: number, nickname: string) => void;
  clearCourseNickname: (courseId: number) => void;
  setCourseTheme: (courseId: number, patch: CourseTheme) => void;
  clearCourseBannerImage: (courseId: number) => void;
  dismissTodo: (key: string) => void;
  undismissTodo: (key: string) => void;
  hydrateRemote: (payload: {
    order?: number[];
    nicknames?: Record<number, string>;
    colors?: Record<number, string>;
  }) => void;
};

export const useDashboardPrefsStore = create<DashboardPrefsState>()(
  persist(
    (set) => ({
      courseOrder: [],
      courseNicknames: {},
      courseThemes: {},
      dismissedTodoKeys: {},
      setCourseOrder: (courseOrder) => set({ courseOrder }),
      setCourseNickname: (courseId, nickname) =>
        set((state) => ({
          courseNicknames: { ...state.courseNicknames, [courseId]: nickname },
        })),
      clearCourseNickname: (courseId) =>
        set((state) => {
          const next = { ...state.courseNicknames };
          delete next[courseId];
          return { courseNicknames: next };
        }),
      setCourseTheme: (courseId, patch) =>
        set((state) => ({
          courseThemes: {
            ...state.courseThemes,
            [courseId]: {
              ...state.courseThemes[courseId],
              ...patch,
            },
          },
        })),
      clearCourseBannerImage: (courseId) =>
        set((state) => ({
          courseThemes: {
            ...state.courseThemes,
            [courseId]: {
              ...state.courseThemes[courseId],
              bannerImageDataUrl: undefined,
            },
          },
        })),
      dismissTodo: (key) =>
        set((state) => ({
          dismissedTodoKeys: {
            ...state.dismissedTodoKeys,
            [key]: { dismissedAt: new Date().toISOString() },
          },
        })),
      undismissTodo: (key) =>
        set((state) => {
          const next = { ...state.dismissedTodoKeys };
          delete next[key];
          return { dismissedTodoKeys: next };
        }),
      hydrateRemote: ({ order, nicknames, colors }) =>
        set((state) => ({
          courseOrder: order && state.courseOrder.length === 0 ? order : state.courseOrder,
          courseNicknames: {
            ...nicknames,
            ...state.courseNicknames,
          },
          courseThemes: {
            ...Object.fromEntries(
              Object.entries(colors ?? {}).map(([courseId, color]) => [Number(courseId), { bannerColor: color }]),
            ),
            ...state.courseThemes,
          },
        })),
    }),
    {
      name: "dashboard-prefs-v1",
    },
  ),
);

export function todoItemKey(input: { courseId?: number; assignmentId?: number; htmlUrl?: string }) {
  if (input.assignmentId != null && input.courseId != null) {
    return `assignment:${input.courseId}:${input.assignmentId}`;
  }
  return `url:${input.htmlUrl ?? "unknown"}`;
}
