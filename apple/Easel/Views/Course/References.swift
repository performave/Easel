import AppKit
import SwiftUI

/// A piece of supporting material the user has pulled alongside their work in
/// the assignment workspace. This is the core idea of the reimagined UI: instead
/// of tab-hopping across Canvas sections, you dock what you need next to the task.
struct ReferenceItem: Identifiable, Hashable {
    let id: String
    let title: String
    let kind: Kind

    enum Kind: Hashable {
        case html(String)
        case page(courseId: Int, slug: String)
        case file(CanvasFile)
    }

    static func html(title: String, _ body: String) -> ReferenceItem {
        ReferenceItem(id: "html:\(title)", title: title, kind: .html(body))
    }
    static func page(courseId: Int, slug: String, title: String) -> ReferenceItem {
        ReferenceItem(id: "page:\(courseId):\(slug)", title: title, kind: .page(courseId: courseId, slug: slug))
    }
    static func file(_ file: CanvasFile) -> ReferenceItem {
        ReferenceItem(id: "file:\(file.id)", title: file.displayName ?? file.filename ?? "File", kind: .file(file))
    }
}

@MainActor
@Observable
final class ReferenceStore {
    private(set) var items: [ReferenceItem] = []

    /// Add a reference, bringing an existing one to the top instead of duplicating.
    func add(_ item: ReferenceItem) {
        items.removeAll { $0.id == item.id }
        items.insert(item, at: 0)
    }

    func remove(_ id: ReferenceItem.ID) {
        items.removeAll { $0.id == id }
    }
}

/// The trailing `.inspector` panel: a stack of open references, each collapsible
/// so several can stay open at once. Empty state nudges the user to add material.
struct ReferenceInspector: View {
    @Bindable var store: ReferenceStore
    let onBrowseFiles: () -> Void
    let syllabusBody: String?

    var body: some View {
        Group {
            if store.items.isEmpty {
                ContentUnavailableView {
                    Label("No references", systemImage: "sidebar.squares.right")
                } description: {
                    Text("Pin the syllabus, a file, or a page here to keep it beside your work.")
                } actions: {
                    addMenu
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(store.items) { item in
                            ReferenceCard(item: item) { store.remove(item.id) }
                        }
                    }
                    .padding(12)
                }
            }
        }
        .inspectorColumnWidth(min: 280, ideal: 360, max: 520)
        .toolbar {
            ToolbarItem(placement: .automatic) { addMenu }
        }
    }

    private var addMenu: some View {
        Menu {
            if let syllabusBody, !syllabusBody.isEmpty {
                Button("Syllabus", systemImage: "doc.text") {
                    store.add(.html(title: "Syllabus", syllabusBody))
                }
            }
            Button("Browse files…", systemImage: "folder") { onBrowseFiles() }
        } label: {
            Label("Add reference", systemImage: "plus")
        }
    }
}

/// One collapsible reference, rendered by kind.
private struct ReferenceCard: View {
    let item: ReferenceItem
    let onRemove: () -> Void
    @State private var expanded = true

    var body: some View {
        GroupBox {
            DisclosureGroup(isExpanded: $expanded) {
                ReferenceContent(item: item)
                    .padding(.top, 6)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: icon).foregroundStyle(.secondary)
                    Text(item.title).font(.callout.weight(.medium)).lineLimit(1)
                    Spacer()
                    Button(action: onRemove) {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var icon: String {
        switch item.kind {
        case .html: return "doc.text"
        case .page: return "book"
        case .file: return "doc"
        }
    }
}

private struct ReferenceContent: View {
    let item: ReferenceItem

    var body: some View {
        switch item.kind {
        case .html(let body):
            CanvasHTMLView(html: body)
        case .page(let courseId, let slug):
            PageReference(courseId: courseId, slug: slug)
        case .file(let file):
            VStack(alignment: .leading, spacing: 8) {
                if let updated = file.updatedAt {
                    Text("\(Format.shortDate(updated)) · \(Format.bytes(file.size ?? 0))")
                        .font(.caption).foregroundStyle(.secondary)
                }
                FileDownloadControl(file: file)
            }
        }
    }
}

private struct PageReference: View {
    let courseId: Int
    let slug: String
    @State private var page: CoursePage?
    @State private var loaded = false

    var body: some View {
        Group {
            if let body = page?.body, !body.isEmpty {
                CanvasHTMLView(html: body)
            } else if loaded {
                Text("No content.").font(.callout).foregroundStyle(.secondary)
            } else {
                ProgressView().controlSize(.small)
            }
        }
        .task {
            page = try? await CanvasAPI.page(courseId, slug: slug)
            loaded = true
        }
    }
}

/// Download button + live progress + open/reveal, reused by the file browser and
/// file references.
struct FileDownloadControl: View {
    let file: CanvasFile
    @Environment(FileDownloader.self) private var downloader

    var body: some View {
        let state = downloader.task(for: file.id)
        HStack(spacing: 8) {
            if let state, state.finishedURL != nil {
                Button("Open", systemImage: "arrow.up.forward.app") {
                    if let url = state.finishedURL { NSWorkspace.shared.open(url) }
                }
                Button("Reveal", systemImage: "folder") {
                    if let url = state.finishedURL { downloader.reveal(url) }
                }
            } else if let state, downloader.isActive(file.id) {
                if let fraction = state.fraction {
                    ProgressView(value: fraction).frame(maxWidth: 160)
                    Text("\(Int(fraction * 100))%").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                } else {
                    ProgressView().controlSize(.small)
                }
            } else {
                Button("Download", systemImage: "arrow.down.circle") {
                    Task { await downloader.downloadAndOpen(fileId: file.id) }
                }
                Button("Save As…", systemImage: "square.and.arrow.down") {
                    Task { await downloader.downloadAs(fileId: file.id) }
                }
                .labelStyle(.iconOnly)
            }
        }
        .font(.callout)
        .buttonStyle(.bordered)
        .controlSize(.small)
    }
}
