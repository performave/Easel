import Charts
import SwiftUI

// MARK: - Modules

struct ModulesTab: View {
    let courseId: Int
    @State private var modules: [Module] = []
    @State private var state: LoadState = .loading

    var body: some View {
        Group {
            switch state {
            case .loading: LoadingView()
            case .restricted: RestrictedView()
            case .loaded:
                if modules.isEmpty {
                    EmptyHint(text: "No modules in this course.")
                } else {
                    VStack(spacing: 8) {
                        ForEach(modules) { module in
                            ModuleDisclosure(courseId: courseId, module: module)
                        }
                    }
                }
            }
        }
        .task(id: courseId) { await load() }
    }

    private func load() async {
        do {
            modules = try await CanvasAPI.modules(courseId)
            state = .loaded
        } catch {
            state = (error as? CanvasError).map { if case .http = $0 { return .restricted } else { return .loaded } } ?? .loaded
        }
    }
}

private struct ModuleDisclosure: View {
    let courseId: Int
    let module: Module
    @State private var expanded = false

    var body: some View {
        DisclosureGroup(isExpanded: $expanded) {
            VStack(spacing: 0) {
                ForEach(module.items ?? []) { item in
                    ModuleItemRow(courseId: courseId, item: item)
                    Divider()
                }
            }
            .padding(.top, 4)
        } label: {
            HStack {
                Text(module.name).font(.callout.weight(.medium))
                Spacer()
                Text("\(module.itemsCount ?? (module.items?.count ?? 0)) items")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator))
    }
}

private struct ModuleItemRow: View {
    let courseId: Int
    let item: ModuleItem
    @Environment(\.openURL) private var openURL

    private var icon: String {
        switch item.type {
        case "Assignment", "Quiz": return "list.clipboard"
        case "File": return "doc"
        case "Page": return "book"
        case "Discussion": return "bubble.left"
        case "ExternalUrl", "ExternalTool": return "link"
        default: return "circle"
        }
    }

    var body: some View {
        if item.type == "SubHeader" {
            Text(item.title.uppercased())
                .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 6)
        } else if item.type == "Assignment", let contentId = item.contentId {
            NavigationLink(value: CourseRoute.assignment(contentId)) {
                rowLabel
            }
            .buttonStyle(.plain)
        } else {
            Button {
                if let urlString = item.htmlUrl ?? item.externalUrl, let url = URL(string: urlString) {
                    openURL(url)
                }
            } label: { rowLabel }
            .buttonStyle(.plain)
        }
    }

    private var rowLabel: some View {
        HStack(spacing: 8) {
            Image(systemName: icon).foregroundStyle(.secondary).frame(width: 16)
            Text(item.title).font(.callout).lineLimit(1)
            Spacer()
            if item.completionRequirement?.completed == true {
                Text("Done").font(.caption).foregroundStyle(.green)
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }
}

// MARK: - Assignments

struct AssignmentsTab: View {
    let courseId: Int
    @State private var groups: [AssignmentGroup] = []
    @State private var state: LoadState = .loading

    var body: some View {
        Group {
            switch state {
            case .loading: LoadingView()
            case .restricted: RestrictedView()
            case .loaded:
                if groups.isEmpty {
                    EmptyHint(text: "No assignments.")
                } else {
                    VStack(alignment: .leading, spacing: 20) {
                        ForEach(groups.sorted { ($0.position ?? 0) < ($1.position ?? 0) }) { group in
                            section(group)
                        }
                    }
                }
            }
        }
        .task(id: courseId) { await load() }
    }

    private func section(_ group: AssignmentGroup) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                SectionLabel(text: group.name)
                Spacer()
                if let weight = group.groupWeight, weight > 0 {
                    Text("\(Int(weight))%").font(.caption).foregroundStyle(.secondary)
                }
            }
            VStack(spacing: 0) {
                ForEach(group.assignments ?? []) { assignment in
                    NavigationLink(value: CourseRoute.assignment(assignment.id)) {
                        AssignmentRow(assignment: assignment)
                    }
                    .buttonStyle(.plain)
                    Divider()
                }
            }
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator))
        }
    }

    private func load() async {
        do {
            groups = try await CanvasAPI.assignmentGroups(courseId)
            state = .loaded
        } catch {
            state = .restricted
        }
    }
}

struct AssignmentRow: View {
    let assignment: Assignment

    private var status: String {
        let sub = assignment.submission
        if sub?.late == true { return "late" }
        if sub?.missing == true { return "missing" }
        if sub?.workflowState == "graded" { return "graded" }
        if sub?.submittedAt != nil { return "submitted" }
        return "open"
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "list.clipboard").foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 1) {
                Text(assignment.name).font(.callout).lineLimit(1)
                Text(dueText).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                if let score = assignment.submission?.score, let possible = assignment.pointsPossible {
                    Text("\(clean(score))/\(clean(possible))")
                        .font(.caption.monospacedDigit())
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .overlay(Capsule().stroke(.separator))
                }
                StatusPill(status: status)
            }
        }
        .padding(10)
        .contentShape(Rectangle())
    }

    private var dueText: String {
        var parts: [String] = []
        parts.append(assignment.dueAt.map { "Due \(Format.relativeDate($0))" } ?? "No due date")
        if let possible = assignment.pointsPossible { parts.append("\(clean(possible)) pts") }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Assignment detail

struct AssignmentDetailView: View {
    let courseId: Int
    let assignmentId: Int

    @Environment(\.openURL) private var openURL
    @State private var assignment: Assignment?
    @State private var errorText: String?
    @State private var draft = ""
    @State private var submitting = false
    @State private var submitError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let errorText {
                    Text(errorText).foregroundStyle(.red)
                } else if let assignment {
                    detail(assignment)
                } else {
                    LoadingView()
                }
            }
            .frame(maxWidth: 900, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
        .navigationTitle(assignment?.name ?? "Assignment")
        .task { await load() }
    }

    @ViewBuilder
    private func detail(_ a: Assignment) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.name).font(.title2.bold())
                    Text(subtitle(a)).font(.callout).foregroundStyle(.secondary)
                }
                Spacer()
                if let urlString = a.htmlUrl, let url = URL(string: urlString) {
                    Button("Open in Canvas", systemImage: "arrow.up.right.square") { openURL(url) }
                }
            }
        }

        HStack(alignment: .top, spacing: 20) {
            VStack(alignment: .leading, spacing: 16) {
                CardBox(title: "Instructions") {
                    CanvasHTMLView(html: a.description)
                }
                if (a.submissionTypes ?? []).contains("online_text_entry"), a.submission?.submittedAt == nil {
                    textEntryCard
                }
            }
            .frame(maxWidth: .infinity)

            submissionCard(a).frame(width: 260)
        }
    }

    private var textEntryCard: some View {
        CardBox(title: "Your response") {
            TextEditor(text: $draft)
                .frame(height: 140)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(.separator))
            if let submitError { Text(submitError).font(.caption).foregroundStyle(.red) }
            HStack {
                Spacer()
                Button {
                    Task { await submit() }
                } label: {
                    Label(submitting ? "Submitting…" : "Submit", systemImage: "paperplane")
                }
                .disabled(submitting || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private func submissionCard(_ a: Assignment) -> some View {
        CardBox(title: "Submission") {
            if let sub = a.submission {
                infoRow("Status", workflowLabel(sub.workflowState))
                infoRow("Grade", gradeText(sub))
                if let submitted = sub.submittedAt {
                    infoRow("Submitted", Format.relativeDate(submitted))
                }
                HStack(spacing: 6) {
                    if sub.late == true { tag("Late", .red) }
                    if sub.missing == true { tag("Missing", .red) }
                    if sub.excused == true { tag("Excused", .blue) }
                }
            } else {
                Text((a.submissionTypes ?? []).isEmpty ? "No submission required."
                     : (a.submissionTypes ?? []).joined(separator: ", "))
                    .font(.callout).foregroundStyle(.secondary)
            }
        }
    }

    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).fontWeight(.medium)
        }
        .font(.callout)
    }

    private func tag(_ text: String, _ color: Color) -> some View {
        Text(text).font(.caption.weight(.medium)).foregroundStyle(.white)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color, in: Capsule())
    }

    private func subtitle(_ a: Assignment) -> String {
        var parts = [a.dueAt.map { "Due \(Format.relativeDate($0))" } ?? "No due date"]
        if let possible = a.pointsPossible { parts.append("\(clean(possible)) points") }
        return parts.joined(separator: " · ")
    }

    private func gradeText(_ sub: Submission) -> String {
        guard let grade = sub.grade else { return "—" }
        if let score = sub.score { return "\(grade) (\(clean(score)))" }
        return grade
    }

    private func workflowLabel(_ state: String?) -> String {
        switch state {
        case "submitted": return "Submitted"
        case "graded": return "Graded"
        case "pending_review": return "Pending Review"
        case "unsubmitted", .none: return "Not Submitted"
        default: return state!.capitalized
        }
    }

    private func load() async {
        do { assignment = try await CanvasAPI.assignment(courseId, assignmentId) }
        catch { errorText = error.localizedDescription }
    }

    private func submit() async {
        submitting = true
        submitError = nil
        do {
            try await CanvasAPI.submitTextEntry(courseId: courseId, assignmentId: assignmentId, body: draft)
            draft = ""
            await load()
        } catch {
            submitError = error.localizedDescription
        }
        submitting = false
    }
}

// MARK: - Grades

struct GradesTab: View {
    let courseId: Int
    @Environment(AppData.self) private var appData

    @State private var groups: [AssignmentGroup] = []
    @State private var state: LoadState = .loading

    private var isWeighted: Bool { groups.contains { ($0.groupWeight ?? 0) > 0 } }

    private var allAssignments: [Assignment] {
        groups.flatMap { $0.assignments ?? [] }
    }

    private var courseTotal: Double? {
        if let posted = appData.course(id: courseId)?.enrollments?.first?.computedCurrentScore {
            return posted
        }
        return computedTotal
    }

    private var computedTotal: Double? {
        if isWeighted {
            var weightedSum = 0.0, totalWeight = 0.0
            for group in groups {
                let (earned, possible) = groupEarned(group)
                if possible > 0, let weight = group.groupWeight, weight > 0 {
                    weightedSum += (earned / possible) * weight
                    totalWeight += weight
                }
            }
            return totalWeight > 0 ? (weightedSum / totalWeight) * 100 : nil
        } else {
            var earned = 0.0, possible = 0.0
            for assignment in allAssignments {
                if let score = assignment.submission?.score, let p = assignment.pointsPossible {
                    earned += score; possible += p
                }
            }
            return possible > 0 ? (earned / possible) * 100 : nil
        }
    }

    var body: some View {
        Group {
            switch state {
            case .loading: LoadingView()
            case .restricted: RestrictedView()
            case .loaded: loaded
            }
        }
        .task(id: courseId) { await load() }
    }

    private var loaded: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 16) {
                totalCard
                if isWeighted { weightsTable }
            }
            if isWeighted { chart }
            gradesTable
        }
    }

    private var totalCard: some View {
        CardBox(title: "Course total") {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(courseTotal.map { String(format: "%.1f%%", $0) } ?? "—")
                    .font(.system(size: 32, weight: .semibold))
                if let grade = appData.course(id: courseId)?.enrollments?.first?.computedCurrentGrade {
                    Text(grade).font(.title3).foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var weightsTable: some View {
        CardBox(title: "Weighted by group") {
            ForEach(groups) { group in
                let (earned, possible) = groupEarned(group)
                HStack {
                    Text(group.name).font(.caption)
                    Spacer()
                    Text(possible > 0 ? String(format: "%.1f%%", earned / possible * 100) : "—")
                        .font(.caption).foregroundStyle(.secondary)
                    Text("\(Int(group.groupWeight ?? 0))%").font(.caption.weight(.medium)).frame(width: 44, alignment: .trailing)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var chart: some View {
        CardBox(title: "Grade by group") {
            Chart(groups) { group in
                let (earned, possible) = groupEarned(group)
                let pct = possible > 0 ? earned / possible * 100 : 0
                BarMark(x: .value("Group", group.name), y: .value("Percent", pct))
                    .foregroundStyle(Color.accentColor)
            }
            .chartYScale(domain: 0...100)
            .frame(height: 180)
        }
    }

    private var gradesTable: some View {
        VStack(spacing: 0) {
            ForEach(allAssignments) { assignment in
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(assignment.name).font(.callout).lineLimit(1)
                    }
                    Spacer()
                    Text(assignment.dueAt.map(Format.shortDate) ?? "—")
                        .font(.caption).foregroundStyle(.secondary).frame(width: 80, alignment: .leading)
                    Text(scoreText(assignment)).font(.callout.monospacedDigit()).frame(width: 90, alignment: .trailing)
                }
                .padding(.vertical, 8).padding(.horizontal, 12)
                Divider()
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator))
    }

    private func scoreText(_ a: Assignment) -> String {
        if let score = a.submission?.score, let p = a.pointsPossible { return "\(clean(score)) / \(clean(p))" }
        if let p = a.pointsPossible { return "— / \(clean(p))" }
        return "—"
    }

    private func groupEarned(_ group: AssignmentGroup) -> (Double, Double) {
        var earned = 0.0, possible = 0.0
        for assignment in group.assignments ?? [] {
            if let score = assignment.submission?.score, let p = assignment.pointsPossible, p > 0 {
                earned += score; possible += p
            }
        }
        return (earned, possible)
    }

    private func load() async {
        do {
            groups = try await CanvasAPI.assignmentGroups(courseId)
            state = .loaded
        } catch { state = .restricted }
    }
}

// MARK: - Discussions

struct DiscussionsTab: View {
    let courseId: Int
    @Environment(\.openURL) private var openURL
    @State private var discussions: [Discussion] = []
    @State private var state: LoadState = .loading

    var body: some View {
        Group {
            switch state {
            case .loading: LoadingView()
            case .restricted: RestrictedView()
            case .loaded:
                if discussions.isEmpty {
                    EmptyHint(text: "No discussions.")
                } else {
                    VStack(spacing: 0) {
                        ForEach(discussions) { discussion in
                            Button {
                                if let urlString = discussion.htmlUrl, let url = URL(string: urlString) { openURL(url) }
                            } label: {
                                row(discussion)
                            }
                            .buttonStyle(.plain)
                            Divider()
                        }
                    }
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator))
                }
            }
        }
        .task(id: courseId) { await load() }
    }

    private func row(_ d: Discussion) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "bubble.left").foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 1) {
                Text(d.title ?? "Untitled").font(.callout.weight(.medium)).lineLimit(1)
                Text(subtitle(d)).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            if let unread = d.unreadCount, unread > 0 {
                Text("\(unread) new").font(.caption).padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.accentColor, in: Capsule()).foregroundStyle(.white)
            }
        }
        .padding(12)
        .contentShape(Rectangle())
    }

    private func subtitle(_ d: Discussion) -> String {
        var parts = [d.author?.displayName ?? "Unknown"]
        parts.append(d.postedAt.map(Format.relative) ?? "—")
        if let count = d.discussionSubentryCount, count > 0 { parts.append("\(count) replies") }
        return parts.joined(separator: " · ")
    }

    private func load() async {
        do { discussions = try await CanvasAPI.discussions(courseId); state = .loaded }
        catch { state = .restricted }
    }
}

// MARK: - Files

struct FilesTab: View {
    let courseId: Int
    @Environment(\.openURL) private var openURL

    @State private var stack: [Folder] = []
    @State private var folders: [Folder] = []
    @State private var files: [CanvasFile] = []
    @State private var state: LoadState = .loading

    var body: some View {
        Group {
            switch state {
            case .loading: LoadingView()
            case .restricted: RestrictedView()
            case .loaded:
                VStack(alignment: .leading, spacing: 10) {
                    breadcrumbs
                    listing
                }
            }
        }
        .task(id: courseId) { await loadRoot() }
    }

    private var breadcrumbs: some View {
        HStack(spacing: 4) {
            ForEach(Array(stack.enumerated()), id: \.element.id) { index, folder in
                if index > 0 { Image(systemName: "chevron.right").font(.caption2).foregroundStyle(.secondary) }
                Button(index == 0 ? "Files" : folder.name) {
                    stack = Array(stack.prefix(index + 1))
                    Task { await loadCurrent() }
                }
                .buttonStyle(.plain)
                .foregroundStyle(index == stack.count - 1 ? Color.primary : Color.accentColor)
            }
        }
    }

    private var listing: some View {
        VStack(spacing: 0) {
            ForEach(folders) { folder in
                Button {
                    stack.append(folder)
                    Task { await loadCurrent() }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "folder").foregroundStyle(.secondary)
                        Text(folder.name).font(.callout)
                        Spacer()
                        Text("\((folder.filesCount ?? 0) + (folder.foldersCount ?? 0)) items")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(10).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Divider()
            }
            ForEach(files) { file in
                Button {
                    if let urlString = file.url, let url = URL(string: urlString) { openURL(url) }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "doc").foregroundStyle(.secondary)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(file.displayName ?? file.filename ?? "File").font(.callout).lineLimit(1)
                            Text("\(Format.shortDate(file.updatedAt)) · \(Format.bytes(file.size ?? 0))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "arrow.down.circle").foregroundStyle(.secondary)
                    }
                    .padding(10).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Divider()
            }
            if folders.isEmpty && files.isEmpty {
                EmptyHint(text: "Empty folder.").padding(12)
            }
        }
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator))
    }

    private func loadRoot() async {
        do {
            let root = try await CanvasAPI.rootFolder(courseId)
            stack = [root]
            state = .loaded
            await loadCurrent()
        } catch { state = .restricted }
    }

    private func loadCurrent() async {
        guard let current = stack.last else { return }
        async let f = try? await CanvasAPI.folders(current.id)
        async let fi = try? await CanvasAPI.files(current.id)
        folders = await f ?? []
        files = await fi ?? []
    }
}

// MARK: - People

struct PeopleTab: View {
    let courseId: Int
    @State private var enrollments: [Enrollment] = []
    @State private var state: LoadState = .loading

    private var teachers: [Enrollment] {
        enrollments.filter { $0.type == "TeacherEnrollment" || $0.type == "TaEnrollment" }
    }
    private var students: [Enrollment] {
        enrollments.filter { $0.type == "StudentEnrollment" }
    }

    var body: some View {
        Group {
            switch state {
            case .loading: LoadingView()
            case .restricted: RestrictedView()
            case .loaded:
                VStack(alignment: .leading, spacing: 20) {
                    section("Teachers & TAs", teachers)
                    section("Students (\(students.count))", students)
                }
            }
        }
        .task(id: courseId) { await load() }
    }

    @ViewBuilder
    private func section(_ title: String, _ people: [Enrollment]) -> some View {
        if !people.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel(text: title)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 240), spacing: 8)], spacing: 8) {
                    ForEach(people) { person in
                        HStack(spacing: 10) {
                            AvatarView(url: person.user?.avatarUrl, name: person.user?.name, size: 36)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(person.user?.name ?? "Unknown").font(.callout.weight(.medium)).lineLimit(1)
                                Text(person.role ?? "").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                            }
                            Spacer()
                        }
                        .padding(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator))
                    }
                }
            }
        }
    }

    private func load() async {
        do { enrollments = try await CanvasAPI.enrollments(courseId); state = .loaded }
        catch { state = .restricted }
    }
}

// MARK: - Syllabus

struct SyllabusTab: View {
    let course: Course?

    var body: some View {
        if let body = course?.syllabusBody, !body.isEmpty {
            CardBox(title: "Syllabus") {
                CanvasHTMLView(html: body)
            }
        } else {
            EmptyHint(text: "No syllabus posted.")
        }
    }
}

// MARK: - Shared

enum LoadState { case loading, loaded, restricted }

/// Trim trailing ".0" from whole-number doubles for compact score display.
func clean(_ value: Double) -> String {
    value == value.rounded() ? String(Int(value)) : String(format: "%.1f", value)
}
