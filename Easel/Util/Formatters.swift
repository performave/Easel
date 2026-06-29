import Foundation

/// Date/number formatting helpers, ported from `src/lib/format.ts` (which used
/// date-fns). Canvas timestamps are ISO-8601 strings.
enum Format {
    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoNoFraction = ISO8601DateFormatter()

    static func parseDate(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        return Self.iso.date(from: iso) ?? isoNoFraction.date(from: iso)
    }

    /// "Today at 4:30 PM", "Tomorrow at …", "Mar 5 at …", or "Mar 5, 2024".
    static func relativeDate(_ iso: String?) -> String {
        guard let date = parseDate(iso) else { return "—" }
        let cal = Calendar.current
        let time = date.formatted(date: .omitted, time: .shortened)
        if cal.isDateInToday(date) { return "Today at \(time)" }
        if cal.isDateInTomorrow(date) { return "Tomorrow at \(time)" }
        if cal.isDateInYesterday(date) { return "Yesterday at \(time)" }
        if cal.isDate(date, equalTo: Date(), toGranularity: .year) {
            return date.formatted(.dateTime.month(.abbreviated).day()) + " at " + time
        }
        return date.formatted(.dateTime.month(.abbreviated).day().year())
    }

    static func shortDate(_ iso: String?) -> String {
        guard let date = parseDate(iso) else { return "—" }
        if Calendar.current.isDate(date, equalTo: Date(), toGranularity: .year) {
            return date.formatted(.dateTime.month(.abbreviated).day())
        }
        return date.formatted(.dateTime.month(.abbreviated).day().year())
    }

    /// "3 days ago", "in 2 hours".
    static func relative(_ iso: String?) -> String {
        guard let date = parseDate(iso) else { return "—" }
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .full
        return f.localizedString(for: date, relativeTo: Date())
    }

    /// Up to `max` uppercase initials from a name/code.
    static func initials(_ value: String?, max: Int = 2) -> String {
        guard let value else { return "?" }
        let cleaned = value.replacingOccurrences(of: "[^A-Za-z0-9 ]", with: "", options: .regularExpression)
        let parts = cleaned.split(separator: " ").prefix(max)
        let result = parts.compactMap { $0.first }.map(String.init).joined().uppercased()
        return result.isEmpty ? "?" : result
    }

    static func bytes(_ n: Int) -> String {
        let n = Double(n)
        if n < 1024 { return "\(Int(n)) B" }
        if n < 1024 * 1024 { return String(format: "%.1f KB", n / 1024) }
        if n < 1024 * 1024 * 1024 { return String(format: "%.1f MB", n / 1024 / 1024) }
        return String(format: "%.2f GB", n / 1024 / 1024 / 1024)
    }
}
