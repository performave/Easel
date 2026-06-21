import SwiftUI

/// Top-level navigation destinations.
enum Nav: Hashable {
    case dashboard, courses, calendar, inbox, announcements
    case course(Int)
}

/// Shared navigation state so any screen (sidebar, dashboard cards, command
/// palette) can drive the selected destination.
@MainActor
@Observable
final class Navigator {
    var selection: Nav? = .dashboard
}

/// The authenticated app shell: a `NavigationSplitView` sidebar (global nav +
/// course list) with a detail column. Replaces the React sidebar + router.
struct AppShellView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(AppData.self) private var appData

    @State private var navigator = Navigator()

    var body: some View {
        @Bindable var navigator = navigator
        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 220, ideal: 240, max: 300)
        } detail: {
            detail
        }
        .environment(navigator)
        .task {
            await appData.loadCourses()
            try? await appData.loadCurrentUser()
        }
    }

    @ViewBuilder
    private var detail: some View {
        switch navigator.selection {
        case .dashboard, .none:
            DashboardView()
        case .courses:
            CoursesView()
        case .calendar:
            CalendarView()
        case .inbox:
            InboxView()
        case .announcements:
            AnnouncementsView()
        case .course(let id):
            CourseView(courseId: id)
                .id(id)
        }
    }
}

private struct SidebarView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(AppData.self) private var appData
    @Environment(Navigator.self) private var navigator

    var body: some View {
        @Bindable var navigator = navigator
        List(selection: $navigator.selection) {
            Section {
                Label("Dashboard", systemImage: "house").tag(Nav.dashboard)
                Label("Courses", systemImage: "book").tag(Nav.courses)
                Label("Calendar", systemImage: "calendar").tag(Nav.calendar)
                Label("Inbox", systemImage: "tray").tag(Nav.inbox)
                Label("Announcements", systemImage: "megaphone").tag(Nav.announcements)
            }

            Section("Courses") {
                if appData.courses.isEmpty {
                    Text("No active courses.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                ForEach(appData.courses.prefix(12)) { course in
                    Label {
                        Text(course.courseCode ?? course.name).lineLimit(1)
                    } icon: {
                        CourseGlyph(code: course.courseCode ?? course.name)
                    }
                    .tag(Nav.course(course.id))
                }
            }
        }
        .listStyle(.sidebar)
        .safeAreaInset(edge: .bottom) {
            accountFooter
        }
    }

    private var accountFooter: some View {
        HStack(spacing: 8) {
            AvatarView(url: appData.currentUser?.avatarUrl, name: appData.currentUser?.name, size: 28)
            VStack(alignment: .leading, spacing: 0) {
                Text(appData.currentUser?.name ?? "Loading…")
                    .font(.caption.weight(.medium))
                    .lineLimit(1)
                Text(appData.currentUser?.primaryEmail ?? auth.domain ?? "")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Menu {
                Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right") {
                    Task {
                        appData.reset()
                        await auth.logout()
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
        }
        .padding(8)
        .background(.bar)
    }
}

/// A small rounded badge with the course's initials, colored from a hash of its
/// code. Ported from `course-glyph.tsx`.
struct CourseGlyph: View {
    let code: String

    private var color: Color {
        let palette: [Color] = [.blue, .purple, .pink, .orange, .green, .teal, .indigo, .red]
        let hash = abs(code.hashValue)
        return palette[hash % palette.count]
    }

    var body: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(color.gradient)
            .frame(width: 18, height: 18)
            .overlay(
                Text(Format.initials(code))
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(.white)
            )
    }
}
