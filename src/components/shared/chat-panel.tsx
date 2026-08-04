"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SendHorizonal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { RoleBadge } from "@/components/shared/role-badge";
import { staffService } from "@/features/workforce/staff-service";
import { chatKeys } from "@/features/realtime/query-keys";
import { formatTime } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import type { ChatMessage } from "@/lib/types";

export function ChatPanel({
  currentUserId,
  pinnedChannel,
}: {
  currentUserId: string;
  pinnedChannel?: ChatMessage["channel"];
}) {
  const t = useTranslations("shared.chat");
  const queryClient = useQueryClient();
  const CHANNELS: { id: ChatMessage["channel"]; label: string }[] = [
    { id: "floor", label: t("channelFloor") },
    { id: "bar", label: t("channelBar") },
    { id: "security", label: t("channelSecurity") },
  ];
  const [channel, setChannel] = useState<ChatMessage["channel"]>(pinnedChannel ?? "floor");

  useEffect(() => {
    if (pinnedChannel) setChannel(pinnedChannel);
  }, [pinnedChannel]);
  const [draft, setDraft] = useState("");

  // Channel history through TanStack Query — cached per channel, invalidated
  // on send and on live events (the old useEffect re-fetched per mount and
  // re-fetched again by hand after every send).
  const { data: messages = [] as ChatMessage[], isPending } = useQuery({
    queryKey: chatKeys.channel(channel),
    queryFn: () => staffService.listMessages(channel),
  });

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      await staffService.sendMessage({ channel, body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.channel(channel) });
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages?.length ?? 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  useEffect(() => {
    if (messages && messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await sendMutation.mutateAsync(body);
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {isPending ? (
          <ListSkeleton rows={4} rowHeight="h-14" />
        ) : (
          <div
            className="relative"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const message = messages[virtualItem.index];
              const mine = message.authorId === currentUserId;
              return (
                <div
                  key={virtualItem.key}
                  className="absolute left-0 right-0 top-0 flex flex-col px-4"
                  style={{
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                    alignItems: mine ? "flex-end" : "flex-start",
                  }}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {mine ? t("you") : message.authorName}
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
            })}
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Input
          placeholder={t("messagePlaceholder", { channel: CHANNELS.find((c) => c.id === channel)?.label ?? "" })}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-11"
        />
        <Button type="submit" size="icon" className="size-11" disabled={sendMutation.isPending || !draft.trim()} aria-label={t("send")}>
          <SendHorizonal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
