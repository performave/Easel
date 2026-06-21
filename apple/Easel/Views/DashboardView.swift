import SwiftUI

struct DashboardView: View {
    @Environment(AppData.self) private var appData
    @Environment(Navigator.self) private var navigator

    @State private var todos: [ToDoItem] = []
    @State private var upcoming: [CalendarEvent] = []
    @State private var loaded = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Dashboard").font(.largeTitle.bold())
                    Text("Your active courses, upcoming work, and what's new.")
                        .foregroundStyle(.secondary)
                }

                StatsRow(courses: appData.courses)

                HStack(alignment: .top, spacing: 20) {
                    todoCard.frame(maxWidth: .infinity, alignment: .leading)
                    upcomingCard.frame(maxWidth: .infinity, alignment: .leading)
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Active courses").font(.title3.weight(.medium))
                    CourseGrid(courses: appData.courses) { id in
                        navigator.selection = .course(id)
                    }
                }
            }
            .pageContainer()
        }
        .task {
            guard !loaded else { return }
            loaded = true
            await appData.loadCourses()
            async let t = try? await CanvasAPI.todo()
            async let u = try? await CanvasAPI.upcomingEvents()
            todos = await t ?? []
            upcoming = await u ?? []
        }
    }

    private var todoCard: some View {
        CardBox(title: "To-do") {
            if todos.isEmpty {
                EmptyHint(text: "You're all caught up.")
            } else {
                ForEach(todos.prefix(6)) { item in
                    Button {
                        if let cid = item.courseId, let aid = item.assignment?.id {
                            navigator.selection = .course(cid)
                            _ = aid
                        }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "clipboard")
                                .foregroundStyle(.secondary)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(item.assignment?.name ?? "Assignment")
                                    .font(.callout).lineLimit(1)
                                Text(item.assignment?.dueAt.map { "Due \(Format.relativeDate($0))" } ?? "No due date")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var upcomingCard: some View {
        CardBox(title: "Upcoming") {
            if upcoming.isEmpty {
                EmptyHint(text: "Nothing on the calendar.")
            } else {
                ForEach(upcoming.prefix(6)) { event in
                    HStack(spacing: 10) {
                        Image(systemName: "calendar")
                            .foregroundStyle(.secondary)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(event.title ?? "Event").font(.callout).lineLimit(1)
                            Text(Format.relativeDate(event.startAt ?? event.assignment?.dueAt))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                }
            }
        }
    }
}

private struct StatsRow: View {
    let courses: [Course]

    private var gradedScores: [Double] {
        courses.compactMap { $0.enrollments?.first?.computedCurrentScore }
    }
    private var average: Double? {
        guard !gradedScores.isEmpty else { return nil }
        return gradedScores.reduce(0, +) / Double(gradedScores.count)
    }

    var body: some View {
        HStack(spacing: 16) {
            StatTile(label: "Active courses", value: "\(courses.count)", icon: "book")
            StatTile(label: "Tracked grades", value: "\(gradedScores.count)", icon: "chart.bar")
            StatTile(
                label: "Average",
                value: average.map { String(format: "%.1f%%", $0) } ?? "—",
                icon: "percent"
            )
        }
    }
}

private struct StatTile: View {
    let label: String
    let value: String
    let icon: String

    var body: some View {
        GroupBox {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(.tint)
                VStack(alignment: .leading, spacing: 2) {
                    Text(value).font(.title2.weight(.semibold)).monospacedDigit()
                    Text(label).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding(4)
        }
    }
}

struct CourseGrid: View {
    let courses: [Course]
    let onSelect: (Int) -> Void

    private let columns = [GridItem(.adaptive(minimum: 240), spacing: 16)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 16) {
            ForEach(courses) { course in
                Button { onSelect(course.id) } label: {
                    CourseCard(course: course)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct CourseCard: View {
    let course: Course

    var body: some View {
        let enrollment = course.enrollments?.first
        GroupBox {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    Text(course.name)
                        .font(.headline)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Spacer()
                    if let score = enrollment?.computedCurrentScore {
                        GradeRing(value: score)
                    } else if let grade = enrollment?.computedCurrentGrade {
                        Text(grade)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(.secondary.opacity(0.15), in: Capsule())
                    }
                }
                Spacer(minLength: 0)
                Text([course.courseCode, course.term?.name].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(4)
            .frame(height: 96, alignment: .topLeading)
        }
    }
}

/// Native titled container used by cards throughout the app.
struct CardBox<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 8) {
                content
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 2)
        } label: {
            Text(title).font(.headline)
        }
    }
}

struct EmptyHint: View {
    let text: String
    var body: some View {
        Text(text).font(.callout).foregroundStyle(.secondary)
    }
}
