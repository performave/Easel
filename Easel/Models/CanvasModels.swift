import Foundation

// Canvas API models. Field names are camelCase; the shared decoder applies
// `.convertFromSnakeCase`, so `course_code` decodes into `courseCode` etc.
// Nearly everything is optional because Canvas omits fields liberally depending
// on the endpoint, the include[] params, and the caller's permissions.

struct Course: Codable, Identifiable, Hashable {
    let id: Int
    var name: String
    var courseCode: String?
    var workflowState: String?
    var term: Term?
    var enrollments: [CourseEnrollment]?
    var startAt: String?
    var endAt: String?
    var defaultView: String?
    var syllabusBody: String?

    static func == (lhs: Course, rhs: Course) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct Term: Codable, Hashable {
    let id: Int
    var name: String?
}

/// Enrollment summary embedded in a Course (grade rollups), distinct from the
/// full `Enrollment` used by the People roster.
struct CourseEnrollment: Codable, Hashable {
    var type: String?
    var role: String?
    var computedCurrentScore: Double?
    var computedCurrentGrade: String?
}

struct CanvasUser: Codable, Identifiable, Hashable {
    let id: Int
    var name: String?
    var shortName: String?
    var primaryEmail: String?
    var avatarUrl: String?
}

struct Module: Codable, Identifiable, Hashable {
    let id: Int
    var name: String
    var position: Int?
    var state: String?
    var unlockAt: String?
    var itemsCount: Int?
    var itemsUrl: String?
    var items: [ModuleItem]?
}

struct ModuleItem: Codable, Identifiable, Hashable {
    let id: Int
    var moduleId: Int?
    var position: Int?
    var title: String
    var indent: Int?
    var type: String
    var htmlUrl: String?
    var url: String?
    var pageUrl: String?
    var externalUrl: String?
    var contentId: Int?
    var completionRequirement: CompletionRequirement?
}

struct CompletionRequirement: Codable, Hashable {
    var type: String?
    var completed: Bool?
}

struct Announcement: Codable, Identifiable, Hashable {
    let id: Int
    var title: String?
    var message: String?
    var postedAt: String?
    var author: Author?
    var contextCode: String?
    var htmlUrl: String?
    var readState: String?
}

struct Author: Codable, Hashable {
    var displayName: String?
    var avatarImageUrl: String?
}

struct Assignment: Codable, Identifiable, Hashable {
    let id: Int
    var courseId: Int?
    var name: String
    var description: String?
    var dueAt: String?
    var unlockAt: String?
    var lockAt: String?
    var pointsPossible: Double?
    var submissionTypes: [String]?
    var hasSubmittedSubmissions: Bool?
    var htmlUrl: String?
    var published: Bool?
    var submission: Submission?
    var assignmentGroupId: Int?
}

struct Submission: Codable, Hashable {
    var id: Int?
    var score: Double?
    var grade: String?
    var submittedAt: String?
    var workflowState: String?
    var late: Bool?
    var missing: Bool?
    var excused: Bool?
}

struct AssignmentGroup: Codable, Identifiable, Hashable {
    let id: Int
    var name: String
    var position: Int?
    var groupWeight: Double?
    var assignments: [Assignment]?
}

struct Discussion: Codable, Identifiable, Hashable {
    let id: Int
    var title: String?
    var message: String?
    var postedAt: String?
    var lastReplyAt: String?
    var discussionSubentryCount: Int?
    var readState: String?
    var unreadCount: Int?
    var author: Author?
    var htmlUrl: String?
}

struct CanvasFile: Codable, Identifiable, Hashable {
    let id: Int
    var displayName: String?
    var filename: String?
    var url: String?
    var size: Int?
    var updatedAt: String?
    var folderId: Int?
}

struct Folder: Codable, Identifiable, Hashable {
    let id: Int
    var name: String
    var fullName: String?
    var parentFolderId: Int?
    var filesCount: Int?
    var foldersCount: Int?
}

struct CalendarEvent: Codable, Identifiable, Hashable {
    let id: String
    var title: String?
    var startAt: String?
    var endAt: String?
    var contextCode: String?
    var contextName: String?
    var description: String?
    var locationName: String?
    var type: String?
    var htmlUrl: String?
    var assignment: Assignment?

    private enum CodingKeys: String, CodingKey {
        case id, title, startAt, endAt, contextCode, contextName
        case description, locationName, type, htmlUrl, assignment
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Canvas sends event ids as numbers but assignment-overlay ids as strings.
        if let intId = try? c.decode(Int.self, forKey: .id) {
            id = String(intId)
        } else {
            id = try c.decode(String.self, forKey: .id)
        }
        title = try? c.decode(String.self, forKey: .title)
        startAt = try? c.decode(String.self, forKey: .startAt)
        endAt = try? c.decode(String.self, forKey: .endAt)
        contextCode = try? c.decode(String.self, forKey: .contextCode)
        contextName = try? c.decode(String.self, forKey: .contextName)
        description = try? c.decode(String.self, forKey: .description)
        locationName = try? c.decode(String.self, forKey: .locationName)
        type = try? c.decode(String.self, forKey: .type)
        htmlUrl = try? c.decode(String.self, forKey: .htmlUrl)
        assignment = try? c.decode(Assignment.self, forKey: .assignment)
    }
}

struct Conversation: Codable, Identifiable, Hashable {
    let id: Int
    var subject: String?
    var workflowState: String?
    var lastMessage: String?
    var lastMessageAt: String?
    var messageCount: Int?
    var participants: [Participant]?
    var contextName: String?
    var messages: [ConversationMessage]?
}

struct Participant: Codable, Identifiable, Hashable {
    let id: Int
    var name: String?
    var avatarUrl: String?
}

struct ConversationMessage: Codable, Identifiable, Hashable {
    let id: Int
    var createdAt: String?
    var body: String?
    var authorId: Int?
}

struct Enrollment: Codable, Identifiable, Hashable {
    let id: Int
    var userId: Int?
    var courseId: Int?
    var type: String?
    var role: String?
    var user: EnrollmentUser?
}

struct EnrollmentUser: Codable, Hashable {
    var id: Int?
    var name: String?
    var shortName: String?
    var sortableName: String?
    var avatarUrl: String?
}

struct ToDoItem: Codable, Identifiable, Hashable {
    var id: String { htmlUrl ?? "\(type)-\(assignment?.id ?? 0)" }
    var type: String
    var assignment: Assignment?
    var contextType: String?
    var courseId: Int?
    var groupId: Int?
    var htmlUrl: String?
}

struct CanvasTab: Codable, Identifiable, Hashable {
    let id: String
    var label: String?
    var type: String?
    var position: Int?
    var hidden: Bool?
    var htmlUrl: String?
}

struct CoursePage: Codable, Hashable {
    var pageId: Int?
    var url: String?
    var title: String?
    var body: String?
    var published: Bool?
    var updatedAt: String?
}
