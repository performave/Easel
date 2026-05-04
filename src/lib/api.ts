import { invoke } from "@tauri-apps/api/core";

type RequestArgs = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  form?: Record<string, string>;
  json?: unknown;
};

export type BootstrapInfo = {
  authenticated: boolean;
  domain: string | null;
};

export type Course = {
  id: number;
  name: string;
  course_code: string | null;
  workflow_state: string | null;
  term?: { id: number; name: string };
  enrollments?: { type: string; role: string; computed_current_score?: number; computed_current_grade?: string | null }[];
  start_at?: string | null;
  end_at?: string | null;
  default_view?: string | null;
};

export type CanvasUser = {
  id: number;
  name: string;
  short_name?: string;
  primary_email?: string;
  avatar_url?: string;
};

export type Module = {
  id: number;
  name: string;
  position: number;
  state: string | null;
  unlock_at: string | null;
  items_count: number;
  items_url: string;
  items?: ModuleItem[];
};

export type ModuleItem = {
  id: number;
  module_id: number;
  position: number;
  title: string;
  indent: number;
  type: string; // "Assignment" | "Quiz" | "File" | "Page" | "Discussion" | "SubHeader" | "ExternalUrl" | "ExternalTool"
  html_url?: string;
  url?: string;
  page_url?: string;
  external_url?: string;
  content_id?: number;
  completion_requirement?: { type: string; completed?: boolean };
};

export type Announcement = {
  id: number;
  title: string;
  message: string;
  posted_at: string | null;
  author?: { display_name?: string; avatar_image_url?: string };
  context_code?: string;
  html_url?: string;
  read_state?: string;
};

export type Assignment = {
  id: number;
  course_id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  points_possible: number | null;
  submission_types: string[];
  has_submitted_submissions?: boolean;
  html_url?: string;
  published?: boolean;
  submission?: Submission;
  assignment_group_id?: number;
};

export type Submission = {
  id: number;
  score: number | null;
  grade: string | null;
  submitted_at: string | null;
  workflow_state: string;
  late?: boolean;
  missing?: boolean;
  excused?: boolean;
};

export type AssignmentGroup = {
  id: number;
  name: string;
  position: number;
  group_weight: number;
  assignments?: Assignment[];
};

export type Discussion = {
  id: number;
  title: string;
  message: string;
  posted_at: string | null;
  last_reply_at: string | null;
  discussion_subentry_count: number;
  read_state: string;
  unread_count: number;
  author?: { display_name?: string; avatar_image_url?: string };
  html_url?: string;
};

export type CanvasFile = {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  size: number;
  "content-type"?: string;
  content_type?: string;
  updated_at: string;
  folder_id: number;
};

export type Folder = {
  id: number;
  name: string;
  full_name: string;
  parent_folder_id: number | null;
  files_count: number;
  folders_count: number;
};

export type CalendarEvent = {
  id: number | string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  context_code: string;
  context_name?: string;
  description?: string | null;
  location_name?: string | null;
  type: string;
  html_url?: string;
  assignment?: Assignment;
};

export type Conversation = {
  id: number;
  subject: string | null;
  workflow_state: string;
  last_message: string | null;
  last_message_at: string | null;
  message_count: number;
  participants: { id: number; name: string; avatar_url?: string }[];
  audience?: number[];
  context_name?: string | null;
};

export type ConversationDetail = Conversation & {
  messages: {
    id: number;
    created_at: string;
    body: string;
    author_id: number;
  }[];
};

export type Enrollment = {
  id: number;
  user_id: number;
  course_id: number;
  type: string;
  role: string;
  user: CanvasUser & { sortable_name?: string };
};

export type ToDoItem = {
  type: string;
  assignment?: Assignment;
  context_type: string;
  course_id?: number;
  group_id?: number;
  html_url: string;
  ignore?: string;
  ignore_permanently?: string;
};

export type CanvasTab = {
  id: string;
  label: string;
  type: string;
  position: number;
  hidden?: boolean;
  html_url?: string;
};

export type CoursePage = {
  page_id: number;
  url: string;
  title: string;
  body: string | null;
  published: boolean;
  updated_at: string | null;
};

export const api = {
  bootstrap: () => invoke<BootstrapInfo>("bootstrap"),
  beginLogin: (domain: string) => invoke<BootstrapInfo>("begin_login", { domain }),
  currentUser: () => invoke<CanvasUser>("current_user"),
  listCourses: () => invoke<Course[]>("list_courses"),
  logout: () => invoke<void>("logout"),
  get: <T = unknown>(path: string) => invoke<T>("canvas_get", { path }),
  getAll: <T = unknown>(path: string) => invoke<T[]>("canvas_get_all", { path }),
  request: <T = unknown>(args: RequestArgs) => invoke<T>("canvas_request", args),
  canvasAssetDataUrl: (pathOrUrl: string) =>
    invoke<string>("canvas_asset_data_url", { pathOrUrl }),
  downloadAndOpenFile: (fileId: number) =>
    invoke<void>("download_and_open_file", { fileId }),
  downloadFileTo: (fileId: number) =>
    invoke<void>("download_file_to", { fileId }),
};

export const canvas = {
  course: (id: number) => api.get<Course>(`/api/v1/courses/${id}?include[]=term&include[]=syllabus_body&include[]=total_scores`),
  courses: () => api.getAll<Course>("/api/v1/courses?enrollment_state=active&include[]=term&include[]=total_scores&per_page=100"),
  modules: (courseId: number) =>
    api.getAll<Module>(`/api/v1/courses/${courseId}/modules?include[]=items&per_page=50`),
  moduleItems: (courseId: number, moduleId: number) =>
    api.getAll<ModuleItem>(`/api/v1/courses/${courseId}/modules/${moduleId}/items?per_page=100`),
  announcements: (contextCodes: string[]) => {
    const qs = contextCodes.map((c) => `context_codes[]=${encodeURIComponent(c)}`).join("&");
    return api.getAll<Announcement>(`/api/v1/announcements?${qs}&per_page=50`);
  },
  assignments: (courseId: number) =>
    api.getAll<Assignment>(`/api/v1/courses/${courseId}/assignments?include[]=submission&per_page=100`),
  assignment: (courseId: number, id: number) =>
    api.get<Assignment>(`/api/v1/courses/${courseId}/assignments/${id}?include[]=submission`),
  assignmentGroups: (courseId: number) =>
    api.getAll<AssignmentGroup>(
      `/api/v1/courses/${courseId}/assignment_groups?include[]=assignments&include[]=submission&per_page=50`,
    ),
  discussions: (courseId: number) =>
    api.getAll<Discussion>(`/api/v1/courses/${courseId}/discussion_topics?per_page=50`),
  files: (courseId: number, folderId?: number) =>
    api.getAll<CanvasFile>(
      folderId
        ? `/api/v1/folders/${folderId}/files?per_page=100`
        : `/api/v1/courses/${courseId}/files?per_page=100`,
    ),
  folders: (courseId: number, folderId?: number) =>
    api.getAll<Folder>(
      folderId
        ? `/api/v1/folders/${folderId}/folders?per_page=100`
        : `/api/v1/courses/${courseId}/folders?per_page=100`,
    ),
  rootFolder: (courseId: number) => api.get<Folder>(`/api/v1/courses/${courseId}/folders/root`),
  calendarEvents: (start: string, end: string, contextCodes: string[], type: "event" | "assignment" = "event") => {
    const qs = [
      `start_date=${start}`,
      `end_date=${end}`,
      `type=${type}`,
      ...contextCodes.map((c) => `context_codes[]=${encodeURIComponent(c)}`),
      "per_page=100",
    ].join("&");
    return api.getAll<CalendarEvent>(`/api/v1/calendar_events?${qs}`);
  },
  conversations: (scope: "inbox" | "unread" | "starred" | "sent" | "archived" = "inbox") =>
    api.getAll<Conversation>(`/api/v1/conversations?scope=${scope}&per_page=50`),
  conversation: (id: number) => api.get<ConversationDetail>(`/api/v1/conversations/${id}`),
  enrollments: (courseId: number) =>
    api.getAll<Enrollment>(`/api/v1/courses/${courseId}/enrollments?include[]=avatar_url&per_page=100`),
  tabs: (courseId: number) => api.getAll<CanvasTab>(`/api/v1/courses/${courseId}/tabs`),
  frontPage: (courseId: number) => api.get<CoursePage>(`/api/v1/courses/${courseId}/front_page`),
  todo: () => api.getAll<ToDoItem>("/api/v1/users/self/todo"),
  submitTextEntry: (courseId: number, assignmentId: number, body: string) =>
    api.request<Submission>({
      method: "POST",
      path: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
      form: {
        "submission[submission_type]": "online_text_entry",
        "submission[body]": body,
      },
    }),
  upcomingEvents: () => api.getAll<CalendarEvent>("/api/v1/users/self/upcoming_events"),
  courseNicknames: () => api.get<Record<string, string>>("/api/v1/users/self/course_nicknames"),
  setCourseNickname: (courseId: number, nickname: string) =>
    api.request({
      method: "PUT",
      path: `/api/v1/users/self/course_nicknames/${courseId}`,
      form: { nickname },
    }),
  clearCourseNickname: (courseId: number) =>
    api.request({
      method: "DELETE",
      path: `/api/v1/users/self/course_nicknames/${courseId}`,
    }),
  dashboardPositions: (userId: number) =>
    api.get<{ dashboard_positions: Record<string, number> }>(`/api/v1/users/${userId}/dashboard_positions`),
  setDashboardPositions: (userId: number, positions: Record<string, number>) => {
    const form: Record<string, string> = {};
    for (const [asset, pos] of Object.entries(positions)) {
      form[`dashboard_positions[${asset}]`] = String(pos);
    }
    return api.request<{ dashboard_positions: Record<string, number> }>({
      method: "PUT",
      path: `/api/v1/users/${userId}/dashboard_positions`,
      form,
    });
  },
  colors: (userId: number) => api.get<{ custom_colors: Record<string, string> }>(`/api/v1/users/${userId}/colors`),
  setCourseColor: (userId: number, courseId: number, hexcode: string) =>
    api.request({
      method: "PUT",
      path: `/api/v1/users/${userId}/colors/course_${courseId}`,
      form: { hexcode: hexcode.replace("#", "") },
    }),
};
