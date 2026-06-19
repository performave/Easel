import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { IconInbox, IconMail } from "@tabler/icons-react";
import { conversationsQueryOptions, conversationQueryOptions } from "@/lib/queries";
import { CanvasHtml } from "@/lib/html";
import { formatRelative, initials } from "@/lib/format";
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
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: conversations, isPending } = useQuery(conversationsQueryOptions(scope));
  const { data: detail } = useQuery({
    ...conversationQueryOptions(selectedId ?? 0),
    enabled: selectedId != null,
  });

  // Reset the selection when switching scopes, then auto-select the first item.
  useEffect(() => {
    setSelectedId(null);
  }, [scope]);
  useEffect(() => {
    if (selectedId == null && conversations && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  return (
    <div className="grid h-full grid-cols-[16rem_22rem_1fr] divide-x">
      <aside className="space-y-1 p-3">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mailboxes</p>
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
        {isPending ? (
          <SkeletonList count={6} className="h-16 w-full" wrapperClassName="space-y-2 p-3" />
        ) : !conversations || conversations.length === 0 ? (
          <Empty className="h-full border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconInbox />
              </EmptyMedia>
              <EmptyTitle>No conversations</EmptyTitle>
              <EmptyDescription>Messages in this mailbox will show up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y">
            {conversations.map((c) => {
              const other = c.participants.find((p) => p.name) ?? c.participants[0];
              const unread = c.workflow_state === "unread";
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-accent",
                      selectedId === c.id && "bg-accent",
                    )}
                  >
                    <Avatar className="mt-0.5 size-8 shrink-0">
                      <AvatarImage src={other?.avatar_url} alt={other?.name} />
                      <AvatarFallback className="text-xs">{initials(other?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn("truncate text-sm", unread && "font-semibold")}>{other?.name ?? "—"}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {c.last_message_at ? formatRelative(c.last_message_at) : ""}
                        </span>
                      </div>
                      <p className={cn("truncate text-sm", unread && "font-medium")}>{c.subject ?? "(no subject)"}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.last_message}</p>
                    </div>
                    {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="overflow-auto overscroll-contain p-6">
        {selectedId != null && !detail ? (
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
          <Empty className="h-full border-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconMail />
              </EmptyMedia>
              <EmptyTitle>No conversation selected</EmptyTitle>
              <EmptyDescription>Choose a message from the list to read it here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </div>
  );
}
