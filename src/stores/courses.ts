import { create } from "zustand";
import type { Course } from "@/lib/api";
import { canvas } from "@/lib/api";

type CoursesState = {
  status: "idle" | "loading" | "ready" | "error";
  courses: Course[];
  error: string | null;
  load: () => Promise<void>;
  byId: (id: number) => Course | undefined;
};

export const useCoursesStore = create<CoursesState>((set, get) => ({
  status: "idle",
  courses: [],
  error: null,
  load: async () => {
    if (get().status === "loading") return;
    set({ status: "loading", error: null });
    try {
      const courses = await canvas.courses();
      set({ courses, status: "ready" });
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  },
  byId: (id) => get().courses.find((c) => c.id === id),
}));
