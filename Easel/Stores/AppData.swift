import Foundation
import Observation

/// Lightweight cross-screen cache for data that many views need (the course
/// list, the current user). Replaces React Query's global cache for these
/// hot paths with simple stale-time semantics; per-course detail data is loaded
/// locally by each screen.
@MainActor
@Observable
final class AppData {
    private(set) var courses: [Course] = []
    private(set) var currentUser: CanvasUser?
    private(set) var coursesLoaded = false

    private var coursesFetchedAt: Date?
    private let staleInterval: TimeInterval = 5 * 60

    /// Course id -> nickname, sourced from each course's name fallback. Canvas
    /// nicknames live on the course objects we already fetch, so no extra call.
    func displayName(for course: Course) -> String {
        course.name
    }

    func course(id: Int) -> Course? {
        courses.first { $0.id == id }
    }

    func loadCourses(force: Bool = false) async {
        if !force, let at = coursesFetchedAt, Date().timeIntervalSince(at) < staleInterval, coursesLoaded {
            return
        }
        do {
            courses = try await CanvasAPI.courses()
            coursesFetchedAt = Date()
            coursesLoaded = true
        } catch {
            // Leave any previously loaded courses in place on failure.
            coursesLoaded = true
        }
    }

    func loadCurrentUser() async throws {
        currentUser = try await CanvasAPI.currentUser()
    }

    func reset() {
        courses = []
        currentUser = nil
        coursesLoaded = false
        coursesFetchedAt = nil
    }
}
