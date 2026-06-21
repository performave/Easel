import SwiftUI

/// The reimagined assignment experience: the task stays center stage while
/// supporting material docks into a native `.inspector` rail beside it. Links in
/// the prompt resolve into references instead of spawning browser tabs — so you
/// never lose the assignment to go look something up.
struct AssignmentWorkspaceView: View {
    let courseId: Int
    let assignmentId: Int

    @Environment(AuthManager.self) private var auth
    @Environment(\.openURL) private var systemOpenURL

    @State private var assignment: Assignment?
    @State private var course: Course?
    @State private var errorText: String?

    @State private var store = ReferenceStore()
    @State private var showInspector = true
    @State private var showFileBrowser = false

    @State private var draft = ""
    @State private var submitting = false
    @State private var submitMessage: String?

    var body: some View {
        center
            .environment(\.openURL, OpenURLAction(handler: handleLink))
            .inspector(isPresented: $showInspector) {
                ReferenceInspector(
                    store: store,
                    onBrowseFiles: { showFileBrowser = true },
                    syllabusBody: course?.syllabusBody
                )
            }
            .toolbar {
                ToolbarItem(placement: .automatic) {
                    Button {
                        showInspector.toggle()
                    } label: {
                        Label("References", systemImage: "sidebar.trailing")
                    }
                }
            }
            .navigationTitle(assignment?.name ?? "Assignment")
            .sheet(isPresented: $showFileBrowser) {
                FilePickerSheet(courseId: courseId) { file in
                    store.add(.file(file))
                    showFileBrowser = false
                }
            }
            .task { await load() }
    }

    @ViewBuilder
    private var center: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let errorText {
                    ContentUnavailableView("Couldn't load assignment", systemImage: "exclamationmark.triangle",
                                           description: Text(errorText))
                } else if let assignment {
                    detail(assignment)
                } else {
                    LoadingView()
                }
            }
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
    }

    @ViewBuilder
    private func detail(_ a: Assignment) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(a.name).font(.largeTitle.bold())
                Spacer()
                if let urlString = a.htmlUrl, let url = URL(string: urlString) {
                    Button("Open in Canvas", systemImage: "arrow.up.right.square") { systemOpenURL(url) }
                        .buttonStyle(.borderless)
                }
            }
            Label(subtitle(a), systemImage: "calendar")
                .font(.callout).foregroundStyle(.secondary)
        }

        GroupBox {
            CanvasHTMLView(html: a.description)
                .frame(maxWidth: .infinity, alignment: .leading)
        } label: {
            Label("Prompt", systemImage: "text.alignleft")
        }

        submissionSection(a)

        if (a.submissionTypes ?? []).contains("online_text_entry"), a.submission?.submittedAt == nil {
            draftSection
        }
    }

    @ViewBuilder
    private func submissionSection(_ a: Assignment) -> some View {
        GroupBox {
            if let sub = a.submission {
                VStack(spacing: 6) {
                    LabeledContent("Status", value: workflowLabel(sub.workflowState))
                    LabeledContent("Grade", value: gradeText(sub, points: a.pointsPossible))
                    if let submitted = sub.submittedAt {
                        LabeledContent("Submitted", value: Format.relativeDate(submitted))
                    }
                }
                if sub.late == true || sub.missing == true || sub.excused == true {
                    HStack(spacing: 6) {
                        if sub.late == true { Tag("Late", .red) }
                        if sub.missing == true { Tag("Missing", .red) }
                        if sub.excused == true { Tag("Excused", .blue) }
                        Spacer()
                    }
                    .padding(.top, 4)
                }
            } else {
                Text((a.submissionTypes ?? []).isEmpty ? "No submission required."
                     : "Accepts: " + (a.submissionTypes ?? []).map(Self.submissionTypeLabel).joined(separator: ", "))
                    .font(.callout).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } label: {
            Label("Submission", systemImage: "checkmark.seal")
        }
    }

    @ViewBuilder
    private var draftSection: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 10) {
                TextEditor(text: $draft)
                    .font(.body)
                    .frame(minHeight: 160)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(.separator))
                if let submitMessage {
                    Text(submitMessage).font(.caption).foregroundStyle(.secondary)
                }
                HStack {
                    Spacer()
                    Button {
                        Task { await submit() }
                    } label: {
                        Label(submitting ? "Submitting…" : "Submit", systemImage: "paperplane")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(submitting || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        } label: {
            Label("Your response", systemImage: "square.and.pencil")
        }
    }

    // MARK: - Link handling

    /// Resolve in-prompt Canvas links into references; fall back to the browser.
    private func handleLink(_ url: URL) -> OpenURLAction.Result {
        guard let domain = auth.domain, url.host == domain else { return .systemAction }
        let segments = url.pathComponents.filter { $0 != "/" }
        // /courses/{cid}/{type}/{slug}
        guard segments.count >= 2, segments[0] == "courses", let cid = Int(segments[1]) else {
            return .systemAction
        }
        let type = segments.count >= 3 ? segments[2] : "home"
        let slug = segments.count >= 4 ? segments[3] : ""

        switch type {
        case "pages" where !slug.isEmpty:
            store.add(.page(courseId: cid, slug: slug, title: slug.replacingOccurrences(of: "-", with: " ").capitalized))
            showInspector = true
            return .handled
        case "files" where Int(slug) != nil:
            let stub = CanvasFile(id: Int(slug)!, displayName: "File \(slug)", filename: nil,
                                  url: nil, size: nil, updatedAt: nil, folderId: nil)
            store.add(.file(stub))
            showInspector = true
            return .handled
        default:
            return .systemAction
        }
    }

    // MARK: - Data

    private func load() async {
        async let a = try? await CanvasAPI.assignment(courseId, assignmentId)
        async let c = try? await CanvasAPI.course(courseId)
        let loaded = await a
        course = await c
        if let loaded { assignment = loaded } else { errorText = "Assignment unavailable." }
    }

    private func submit() async {
        submitting = true
        submitMessage = nil
        do {
            try await CanvasAPI.submitTextEntry(courseId: courseId, assignmentId: assignmentId, body: draft)
            draft = ""
            submitMessage = "Submitted."
            await load()
        } catch {
            submitMessage = error.localizedDescription
        }
        submitting = false
    }

    // MARK: - Formatting

    private func subtitle(_ a: Assignment) -> String {
        var parts = [a.dueAt.map { "Due \(Format.relativeDate($0))" } ?? "No due date"]
        if let possible = a.pointsPossible { parts.append("\(clean(possible)) points") }
        return parts.joined(separator: " · ")
    }

    private func gradeText(_ sub: Submission, points: Double?) -> String {
        guard let grade = sub.grade else { return "—" }
        if let score = sub.score { return "\(grade) (\(clean(score)))" }
        return grade
    }

    private func workflowLabel(_ state: String?) -> String {
        switch state {
        case "submitted": return "Submitted"
        case "graded": return "Graded"
        case "pending_review": return "Pending Review"
        default: return "Not Submitted"
        }
    }

    static func submissionTypeLabel(_ type: String) -> String {
        switch type {
        case "online_text_entry": return "Text Entry"
        case "online_upload": return "File Upload"
        case "online_url": return "Website URL"
        case "media_recording": return "Media"
        case "discussion_topic": return "Discussion"
        case "external_tool": return "External Tool"
        default: return type.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}

/// Small colored capsule tag.
struct Tag: View {
    let text: String
    let color: Color
    init(_ text: String, _ color: Color) { self.text = text; self.color = color }
    var body: some View {
        Text(text).font(.caption.weight(.medium)).foregroundStyle(.white)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color, in: Capsule())
    }
}

/// A modal course file browser that hands the chosen file back to the caller —
/// used to add a file as a reference without leaving the workspace.
struct FilePickerSheet: View {
    let courseId: Int
    let onPick: (CanvasFile) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                FilesTab(courseId: courseId, onPick: onPick)
                    .padding(20)
            }
            .navigationTitle("Add a file")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .frame(width: 560, height: 520)
    }
}
