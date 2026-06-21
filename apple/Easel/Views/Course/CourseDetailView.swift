import SwiftUI

/// Routes that can be pushed within a course (e.g. an assignment detail).
enum CourseRoute: Hashable {
    case assignment(Int)
}

/// A course's tabbed workspace. Mirrors the React `$courseId` layout: a title
/// header, a tab bar driven by Canvas's `tabs` endpoint (respecting the user's
/// locally hidden tabs), and the selected tab's content — all inside a
/// `NavigationStack` so assignment details can push.
struct CourseDetailView: View {
    let courseId: Int

    @Environment(AppData.self) private var appData
    @Environment(Prefs.self) private var prefs

    @State private var course: Course?
    @State private var tabs: [CanvasTab] = []
    @State private var selectedTab = "home"
    @State private var path: [CourseRoute] = []

    /// Canvas tab id -> our supported tab; order also defines display order.
    private static let supported = ["home", "modules", "assignments", "grades",
                                    "discussions", "files", "people", "syllabus"]

    private var visibleTabs: [CanvasTab] {
        tabs
            .filter { ($0.hidden != true) && Self.supported.contains($0.id) }
            .filter { $0.id == "home" || !prefs.isTabHidden(courseId: courseId, tabId: $0.id) }
            .sorted { ($0.position ?? 0) < ($1.position ?? 0) }
    }

    var body: some View {
        NavigationStack(path: $path) {
            VStack(alignment: .leading, spacing: 0) {
                header
                tabBar
                Divider()
                ScrollView {
                    content
                        .frame(maxWidth: 980, alignment: .leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(24)
                }
            }
            .navigationDestination(for: CourseRoute.self) { route in
                switch route {
                case .assignment(let id):
                    AssignmentDetailView(courseId: courseId, assignmentId: id)
                }
            }
        }
        .task(id: courseId) { await load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let course {
                if let code = course.courseCode {
                    Text(code.uppercased()).font(.caption.weight(.medium)).foregroundStyle(.secondary)
                }
                Text(course.name).font(.title.bold())
                if let term = course.term?.name {
                    Text(term).font(.callout).foregroundStyle(.secondary)
                }
            } else {
                Text(appData.course(id: courseId)?.name ?? "Course")
                    .font(.title.bold())
            }
        }
        .frame(maxWidth: 980, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 24).padding(.top, 20).padding(.bottom, 12)
    }

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                ForEach(visibleTabs) { tab in
                    let isActive = selectedTab == tab.id
                    Button {
                        selectedTab = tab.id
                        path.removeAll()
                    } label: {
                        Text(tab.label ?? tab.id.capitalized)
                            .font(.callout.weight(.medium))
                            .foregroundStyle(isActive ? Color.primary : Color.secondary)
                            .padding(.horizontal, 10).padding(.vertical, 8)
                            .overlay(alignment: .bottom) {
                                Rectangle()
                                    .fill(isActive ? Color.accentColor : .clear)
                                    .frame(height: 2)
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 24)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch selectedTab {
        case "modules": ModulesTab(courseId: courseId)
        case "assignments": AssignmentsTab(courseId: courseId)
        case "grades": GradesTab(courseId: courseId)
        case "discussions": DiscussionsTab(courseId: courseId)
        case "files": FilesTab(courseId: courseId)
        case "people": PeopleTab(courseId: courseId)
        case "syllabus": SyllabusTab(course: course)
        default: CourseHomeTab(courseId: courseId, course: course)
        }
    }

    private func load() async {
        course = appData.course(id: courseId)
        async let fetchedCourse = try? await CanvasAPI.course(courseId)
        async let fetchedTabs = try? await CanvasAPI.tabs(courseId)
        if let c = await fetchedCourse { course = c }
        tabs = await fetchedTabs ?? []
        if !visibleTabs.contains(where: { $0.id == selectedTab }) {
            selectedTab = visibleTabs.first?.id ?? "home"
        }
    }
}

/// Course landing tab: front page (wiki) if present, otherwise modules, plus a
/// recent-announcements sidebar — matching the React home view's behavior.
struct CourseHomeTab: View {
    let courseId: Int
    let course: Course?

    @State private var frontPage: CoursePage?
    @State private var announcements: [Announcement] = []
    @State private var loaded = false

    var body: some View {
        HStack(alignment: .top, spacing: 24) {
            VStack(alignment: .leading, spacing: 12) {
                if course?.defaultView == "wiki", let body = frontPage?.body {
                    CanvasHTMLView(html: body)
                } else {
                    ModulesTab(courseId: courseId)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 8) {
                Text("Recent announcements").font(.headline)
                if announcements.isEmpty {
                    Text("No announcements yet.").font(.caption).foregroundStyle(.secondary)
                } else {
                    ForEach(announcements.prefix(5)) { announcement in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(announcement.title ?? "").font(.callout).lineLimit(1)
                            Text(Format.relativeDate(announcement.postedAt))
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(.separator))
                    }
                }
            }
            .frame(width: 260, alignment: .leading)
        }
        .task(id: courseId) {
            guard !loaded else { return }
            loaded = true
            async let fp = try? await CanvasAPI.frontPage(courseId)
            async let ann = try? await CanvasAPI.announcements(contextCodes: [ContextCode.course(courseId)])
            frontPage = await fp
            announcements = await ann ?? []
        }
    }
}
