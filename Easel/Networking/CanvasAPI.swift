import Foundation

/// Typed Canvas endpoint helpers, mirroring the `canvas` object from the
/// original `src/lib/api.ts`. Thin wrappers over `CanvasClient` so views and
/// stores express intent ("modules for this course") rather than URLs.
enum CanvasAPI {
    private static var client: CanvasClient { .shared }

    static func currentUser() async throws -> CanvasUser {
        try await client.get("/api/v1/users/self")
    }

    static func courses() async throws -> [Course] {
        try await client.getAll("/api/v1/courses?enrollment_state=active&include[]=term&include[]=total_scores&per_page=100")
    }

    static func course(_ id: Int) async throws -> Course {
        try await client.get("/api/v1/courses/\(id)?include[]=term&include[]=syllabus_body&include[]=total_scores")
    }

    static func modules(_ courseId: Int) async throws -> [Module] {
        try await client.getAll("/api/v1/courses/\(courseId)/modules?include[]=items&per_page=50")
    }

    static func moduleItems(_ courseId: Int, _ moduleId: Int) async throws -> [ModuleItem] {
        try await client.getAll("/api/v1/courses/\(courseId)/modules/\(moduleId)/items?per_page=100")
    }

    static func announcements(contextCodes: [String]) async throws -> [Announcement] {
        let qs = contextCodes.map { "context_codes[]=\(escape($0))" }.joined(separator: "&")
        return try await client.getAll("/api/v1/announcements?\(qs)&per_page=50")
    }

    static func assignmentGroups(_ courseId: Int) async throws -> [AssignmentGroup] {
        try await client.getAll("/api/v1/courses/\(courseId)/assignment_groups?include[]=assignments&include[]=submission&per_page=50")
    }

    static func assignment(_ courseId: Int, _ id: Int) async throws -> Assignment {
        try await client.get("/api/v1/courses/\(courseId)/assignments/\(id)?include[]=submission")
    }

    static func discussions(_ courseId: Int) async throws -> [Discussion] {
        try await client.getAll("/api/v1/courses/\(courseId)/discussion_topics?per_page=50")
    }

    static func enrollments(_ courseId: Int) async throws -> [Enrollment] {
        try await client.getAll("/api/v1/courses/\(courseId)/enrollments?include[]=avatar_url&per_page=100")
    }

    static func tabs(_ courseId: Int) async throws -> [CanvasTab] {
        try await client.getAll("/api/v1/courses/\(courseId)/tabs")
    }

    static func frontPage(_ courseId: Int) async throws -> CoursePage {
        try await client.get("/api/v1/courses/\(courseId)/front_page")
    }

    static func page(_ courseId: Int, slug: String) async throws -> CoursePage {
        try await client.get("/api/v1/courses/\(courseId)/pages/\(escape(slug))")
    }

    static func rootFolder(_ courseId: Int) async throws -> Folder {
        try await client.get("/api/v1/courses/\(courseId)/folders/root")
    }

    static func folders(_ folderId: Int) async throws -> [Folder] {
        try await client.getAll("/api/v1/folders/\(folderId)/folders?per_page=100")
    }

    static func files(_ folderId: Int) async throws -> [CanvasFile] {
        try await client.getAll("/api/v1/folders/\(folderId)/files?per_page=100")
    }

    static func todo() async throws -> [ToDoItem] {
        try await client.getAll("/api/v1/users/self/todo")
    }

    static func upcomingEvents() async throws -> [CalendarEvent] {
        try await client.getAll("/api/v1/users/self/upcoming_events")
    }

    static func calendarEvents(start: String, end: String, contextCodes: [String], type: String) async throws -> [CalendarEvent] {
        var parts = ["start_date=\(start)", "end_date=\(end)", "type=\(type)", "per_page=100"]
        parts.append(contentsOf: contextCodes.map { "context_codes[]=\(escape($0))" })
        return try await client.getAll("/api/v1/calendar_events?\(parts.joined(separator: "&"))")
    }

    static func conversations(scope: String) async throws -> [Conversation] {
        try await client.getAll("/api/v1/conversations?scope=\(scope)&per_page=50")
    }

    static func conversation(_ id: Int) async throws -> Conversation {
        try await client.get("/api/v1/conversations/\(id)")
    }

    static func submitTextEntry(courseId: Int, assignmentId: Int, body: String) async throws {
        let _: EmptyResponse = try await client.request(
            method: "POST",
            path: "/api/v1/courses/\(courseId)/assignments/\(assignmentId)/submissions",
            form: [
                "submission[submission_type]": "online_text_entry",
                "submission[body]": body,
            ]
        )
    }

    private static func escape(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }
}

/// Placeholder for endpoints that return no meaningful body.
struct EmptyResponse: Decodable {}
