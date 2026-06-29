import SwiftUI

struct InboxView: View {
    private let scopes = ["inbox", "unread", "starred", "sent", "archived"]

    @State private var scope = "inbox"
    @State private var conversations: [Conversation] = []
    @State private var selectedId: Int?
    @State private var detail: Conversation?
    @State private var loading = true

    var body: some View {
        HSplitView {
            scopeList
                .frame(minWidth: 140, maxWidth: 180)

            conversationList
                .frame(minWidth: 260, idealWidth: 320)

            conversationDetail
                .frame(minWidth: 320, maxWidth: .infinity)
        }
        .task(id: scope) { await loadConversations() }
        .task(id: selectedId) { await loadDetail() }
    }

    private var scopeList: some View {
        List(scopes, id: \.self, selection: Binding(get: { scope }, set: { if let v = $0 { scope = v } })) { item in
            Text(item.capitalized).tag(item)
        }
        .listStyle(.sidebar)
    }

    private var conversationList: some View {
        Group {
            if loading {
                LoadingView()
            } else if conversations.isEmpty {
                ContentUnavailableView("No conversations", systemImage: "tray",
                                       description: Text("Messages in this mailbox will show up here."))
            } else {
                List(conversations, selection: $selectedId) { conversation in
                    row(conversation).tag(conversation.id)
                }
            }
        }
    }

    private func row(_ c: Conversation) -> some View {
        let other = c.participants?.first { $0.name != nil } ?? c.participants?.first
        let unread = c.workflowState == "unread"
        return HStack(alignment: .top, spacing: 10) {
            AvatarView(url: other?.avatarUrl, name: other?.name, size: 32)
            VStack(alignment: .leading, spacing: 1) {
                HStack {
                    Text(other?.name ?? "—")
                        .font(.callout.weight(unread ? .semibold : .regular))
                        .lineLimit(1)
                    Spacer()
                    Text(c.lastMessageAt.map(Format.relative) ?? "")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                Text(c.subject ?? "(no subject)")
                    .font(.callout.weight(unread ? .medium : .regular))
                    .lineLimit(1)
                Text(c.lastMessage ?? "")
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private var conversationDetail: some View {
        if let detail {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(detail.subject ?? "(no subject)").font(.title3.bold())
                        Text((detail.participants ?? []).compactMap { $0.name }.joined(separator: ", "))
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    ForEach(detail.messages ?? []) { message in
                        let author = detail.participants?.first { $0.id == message.authorId }
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 8) {
                                AvatarView(url: author?.avatarUrl, name: author?.name, size: 26)
                                Text(author?.name ?? "Unknown").font(.callout.weight(.medium))
                                Spacer()
                                Text(Format.relative(message.createdAt)).font(.caption2).foregroundStyle(.secondary)
                            }
                            CanvasHTMLView(html: message.body)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.background, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator))
                    }
                }
                .padding(24)
            }
        } else {
            ContentUnavailableView("No conversation selected", systemImage: "envelope",
                                   description: Text("Choose a message from the list to read it here."))
        }
    }

    private func loadConversations() async {
        loading = true
        selectedId = nil
        detail = nil
        conversations = (try? await CanvasAPI.conversations(scope: scope)) ?? []
        loading = false
        if selectedId == nil { selectedId = conversations.first?.id }
    }

    private func loadDetail() async {
        guard let selectedId else { detail = nil; return }
        detail = try? await CanvasAPI.conversation(selectedId)
    }
}
