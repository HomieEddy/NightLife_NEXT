"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { RoleBadge } from "@/components/shared/role-badge";
import { staffService } from "@/lib/services/staff-service";
import { formatTime } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import type { ChatMessage } from "@/lib/types";

const CHANNELS: { id: ChatMessage["channel"]; label: string }[] = [
  { id: "floor", label: "# floor" },
  { id: "bar", label: "# bar" },
  { id: "security", label: "# security" },
];

export function ChatPanel({
  currentUserId,
  pinnedChannel,
}: {
  currentUserId: string;
  /** When set, the channel picker is hidden and this channel is always active. */
  pinnedChannel?: ChatMessage["channel"];
}) {
  const [channel, setChannel] = useState<ChatMessage["channel"]>(pinnedChannel ?? "floor");
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);

  useEffect(() => {
    if (pinnedChannel) setChannel(pinnedChannel);
  }, [pinnedChannel]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages(null);
    staffService.listMessages(channel).then((msgs) => {
      if (!cancelled) setMessages(msgs);
    });
    return () => { cancelled = true; };
  }, [channel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setDraft("");
    await staffService.sendMessage({ channel, body });
    setMessages(await staffService.listMessages(channel));
    setSending(false);
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col">
      {!pinnedChannel && (
        <div className="flex gap-1.5 border-b p-3">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(c.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 font-mono text-sm transition-colors",
                channel === c.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages === null ? (
          <ListSkeleton rows={4} rowHeight="h-14" />
        ) : (
          messages.map((message) => {
            const mine = message.authorId === currentUserId;
            return (
              <div key={message.id} className={cn("flex flex-col gap-1", mine && "items-end")}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {mine ? "You" : message.authorName}
                  </span>
                  <RoleBadge role={message.authorRole} className="px-1.5 py-0 text-[10px]" />
                  <span>{formatTime(message.sentAt)}</span>
                </div>
                <p
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-secondary",
                  )}
                >
                  {message.body}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Input
          placeholder={`Message ${CHANNELS.find((c) => c.id === channel)?.label}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-11"
        />
        <Button type="submit" size="icon" className="size-11" disabled={sending || !draft.trim()} aria-label="Send">
          <SendHorizonal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
