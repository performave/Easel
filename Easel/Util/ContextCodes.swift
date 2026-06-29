import Foundation

/// Helpers for Canvas "context codes" like `course_123`. Ported from
/// `src/lib/context-codes.ts`.
enum ContextCode {
    static func course(_ courseId: Int) -> String { "course_\(courseId)" }

    static func parseCourseId(_ code: String?) -> Int? {
        guard let code, code.hasPrefix("course_") else { return nil }
        return Int(code.dropFirst("course_".count))
    }
}
