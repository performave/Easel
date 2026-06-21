import SwiftUI

/// Routes pushed within a course.
enum CourseRoute: Hashable {
    case assignment(Int)
    case browse(BrowseSection)
}

/// The Canvas sections, demoted from primary tabs to an on-demand "Browse" menu.
enum BrowseSection: String, CaseIterable, Hashable {
    case modules, grades, discussions, files, people, syllabus

    var title: String { rawValue.capitalized }
    var systemImage: String {
        switch self {
        case .modules: return "square.stack.3d.up"
        case .grades: return "chart.bar"
        case .discussions: return "bubble.left.and.bubble.right"
        case .files: return "folder"
        case .people: return "person.2"
        case .syllabus: return "doc.text"
        }
    }
}

/// A course, reimagined around what you actually came to do: the work. The
/// landing view is a task list (assignments grouped by To do / Submitted /
/// Graded) that opens straight into the assignment workspace. Browsing Canvas's
/// sections is still possible, but it's a deliberate detour, not the front door.
struct CourseView: View {
    let courseId: Int

    @Environment(AppData.self) private var appData

    @State private var course: Course?
    @State private var groups: [AssignmentGroup] = []
    @State private var state: LoadState = .loading
    @State private var path: [CourseRoute] = []

    private var assignments: [Assignment] { groups.flatMap { $0.assignments ?? [] } }
    private var todo: [Assignment] {
        assignments
            .filter { $0.submission?.submittedAt == nil && $0.submission?.workflowState != "graded" }
            .sorted { lhs, rhs in
                switch (Format.parseDate(lhs.dueAt), Format.parseDate(rhs.dueAt)) {
                case let (l?, r?): return l < r
                case (nil, _?): return false
                case (_?, nil): return true
                default: return lhs.name < rhs.name
                }
            }
    }
    private var submitted: [Assignment] {
        assignments.filter { $0.submission?.submittedAt != nil && $0.submission?.workflowState != "graded" }
    }
    private var graded: [Assignment] {
        assignments.filter { $0.submission?.workflowState == "graded" }
    }

    var body: some View {
        NavigationStack(path: $path) {
            overview
                .navigationTitle(course?.name ?? appData.course(id: courseId)?.name ?? "Course")
                .navigationSubtitle(course?.term?.name ?? "")
                .navigationDestination(for: CourseRoute.self) { route in
                    switch route {
                    case .assignment(let id):
                        AssignmentWorkspaceView(courseId: courseId, assignmentId: id)
                    case .browse(let section):
                        BrowseScreen(courseId: courseId, section: section, course: course)
                    }
                }
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Menu {
                            ForEach(BrowseSection.allCases, id: \.self) { section in
                                Button(section.title, systemImage: section.systemImage) {
                                    path.append(.browse(section))
                                }
                            }
                        } label: {
                            Label("Browse", systemImage: "square.grid.2x2")
                        }
                    }
                }
        }
        .task(id: courseId) { await load() }
    }

    @ViewBuilder
    private var overview: some View {
        switch state {
        case .loading:
            LoadingView()
        case .restricted:
            taskList // assignments may still work even if some sections don't
        case .loaded:
            if assignments.isEmpty {
                ContentUnavailableView("No assignments", systemImage: "checklist",
                                       description: Text("This course has no assignments yet."))
            } else {
                taskList
            }
        }
    }

    private var courseEnrollment: CourseEnrollment? {
        (course ?? appData.course(id: courseId))?.enrollments?.first
    }

    private var taskList: some View {
        List {
            if courseEnrollment?.computedCurrentScore != nil {
                Section { gradeSummary }
            }
            bucket("To do", todo, icon: "circle")
            bucket("Submitted", submitted, icon: "checkmark.circle")
            bucket("Graded", graded, icon: "checkmark.seal")
        }
        .listStyle(.inset)
    }

    @ViewBuilder
    private func bucket(_ title: String, _ items: [Assignment], icon: String) -> some View {
        if !items.isEmpty {
            Section(title) {
                ForEach(items) { assignment in
                    NavigationLink(value: CourseRoute.assignment(assignment.id)) {
                        AssignmentRow(assignment: assignment)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var gradeSummary: some View {
        let enrollment = courseEnrollment
        if let score = enrollment?.computedCurrentScore {
            HStack(spacing: 12) {
                GradeRing(value: score, size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Current grade").font(.caption).foregroundStyle(.secondary)
                    HStack(spacing: 6) {
                        Text(String(format: "%.1f%%", score)).font(.title3.weight(.semibold))
                        if let letter = enrollment?.computedCurrentGrade {
                            Text(letter).foregroundStyle(.secondary)
                        }
                    }
                }
                Spacer()
                Button("Grade detail", systemImage: "chart.bar") { path.append(.browse(.grades)) }
                    .buttonStyle(.bordered)
            }
            .padding(.vertical, 4)
        }
    }

    private func load() async {
        course = appData.course(id: courseId)
        async let fetchedCourse = try? await CanvasAPI.course(courseId)
        do {
            groups = try await CanvasAPI.assignmentGroups(courseId)
            state = .loaded
        } catch {
            state = .restricted
        }
        if let c = await fetchedCourse { course = c }
    }
}

/// Wraps a demoted section view with a title and scroll container.
struct BrowseScreen: View {
    let courseId: Int
    let section: BrowseSection
    let course: Course?

    var body: some View {
        ScrollView {
            content
                .frame(maxWidth: 900, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
        }
        .navigationTitle(section.title)
    }

    @ViewBuilder
    private var content: some View {
        switch section {
        case .modules: ModulesTab(courseId: courseId)
        case .grades: GradesTab(courseId: courseId)
        case .discussions: DiscussionsTab(courseId: courseId)
        case .files: FilesTab(courseId: courseId)
        case .people: PeopleTab(courseId: courseId)
        case .syllabus: SyllabusTab(course: course)
        }
    }
}
