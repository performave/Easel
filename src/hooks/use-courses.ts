import { useQuery } from "@tanstack/react-query";
import type { Course } from "@/lib/api";
import { coursesQueryOptions } from "@/lib/queries";

/** Active enrollments for the current user, backed by React Query. */
export function useCourses() {
  const query = useQuery(coursesQueryOptions());
  return { ...query, courses: query.data ?? ([] as Course[]) };
}

/** A single course pulled from the cached courses list (no extra request). */
export function useCourse(id: number) {
  return useQuery({
    ...coursesQueryOptions(),
    select: (courses) => courses.find((c) => c.id === id),
  });
}
