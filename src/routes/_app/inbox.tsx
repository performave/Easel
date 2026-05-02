import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canvas, type Conversation, type ConversationDetail } from "@/lib/api";
import { CanvasHtml } from "@/lib/html";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/inbox")({
  component: InboxPage,
});

const SCOPES: { id: "inbox" | "unread" | "starred" | "sent" | "archived"; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "unread", label: "Unread" },
  { id: "starred", label: "Starred" },
  { id: "sent", label: "Sent" },
  { id: "archived", label: "Archived" },
];

function InboxPage() {
  const [scope, setScope] = useState<typeof SCOPES[number]["id"]>("inbox");
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConversations(null);
    canvas.conversations(scope).then((v) => {
      if (cancelled) return;
      setConversations(v);
      setSelectedId(v[0]?.id ?? null);
    }).catch(() => !cancelled && setConversations([]));
    return () => { cancelled = true; };
  }, [scope]);

  useEffect(() => {
    if (selectedId == null) { setDetail(null); return; }
    let cancelled = false;
    setDetail(null);
    canvas.conversation(selectedId).then((v) => !cancelled && setDetail(v)).catch(() => {});
    return () => { cancelled = true; };
  }, [selectedId]);

  return (
    <div className="grid h-full grid-cols-[16rem_22rem_1fr] divide-x">
      <aside className="space-y-1 p-3">
        {SCOPES.map((s) => (
          <Button
            key={s.id}
            variant={scope === s.id ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => setScope(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </aside>
      <section className="overflow-auto overscroll-contain">
        {conversations === null ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : conversations.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No conversations.</p>
        ) : (
          <ul className="divide-y">
            {conversations.map((c) => {
              const other = c.participants.find((p) => p.name) ?? c.participants[0];
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "block w-full px-3 py-2.5 text-left hover:bg-accent",
                      selectedId === c.id && "bg-accent",
                      c.workflow_state === "unread" && "font-medium",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm">{other?.name ?? "—"}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.last_message_at ? formatRelative(c.last_message_at) : ""}
                      </span>
                    </div>
                    <p className="truncate text-sm">{c.subject ?? "(no subject)"}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.last_message}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="overflow-auto overscroll-contain p-6">
        {detail === null && selectedId != null ? (
          <Skeleton className="h-64 w-full" />
        ) : detail ? (
          <div className="mx-auto max-w-3xl space-y-4">
            <header>
              <h2 className="text-lg font-semibold">{detail.subject ?? "(no subject)"}</h2>
              <p className="text-xs text-muted-foreground">
                {detail.participants.map((p) => p.name).join(", ")}
              </p>
            </header>
            <div className="space-y-3">
              {detail.messages.map((m) => {
                const author = detail.participants.find((p) => p.id === m.author_id);
                return (
                  <div key={m.id} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarImage src={author?.avatar_url} alt={author?.name} />
                        <AvatarFallback className="text-xs">{author?.name?.[0] ?? "?"}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium">{author?.name ?? "Unknown"}</p>
                      <p className="ml-auto text-xs text-muted-foreground">{formatRelative(m.created_at)}</p>
                    </div>
                    <CanvasHtml html={m.body} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a conversation.</p>
        )}
      </section>
    </div>
  );
}
