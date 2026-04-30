import { invoke } from "@tauri-apps/api/core";

export type BootstrapInfo = {
  authenticated: boolean;
  domain: string | null;
};

export type Course = {
  id: number;
  name: string;
  course_code: string | null;
  workflow_state: string | null;
};

export type CanvasUser = {
  id: number;
  name: string;
  short_name?: string;
  primary_email?: string;
  avatar_url?: string;
};

export const api = {
  bootstrap: () => invoke<BootstrapInfo>("bootstrap"),
  beginLogin: (domain: string) => invoke<BootstrapInfo>("begin_login", { domain }),
  currentUser: () => invoke<CanvasUser>("current_user"),
  listCourses: () => invoke<Course[]>("list_courses"),
  logout: () => invoke<void>("logout"),
};
