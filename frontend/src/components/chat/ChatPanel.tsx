"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { Composer } from "@/components/chat/Composer";
import type { ChatMessage, ConversationDetail, User } from "@/lib/types";

function formatMsgTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function MessageBubble({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
          mine ? "bg-pop text-white" : "bg-white text-navy border border-[#edf2f7]"
        }`}
      >
        {message.content && (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
        {message.media_url && message.media_type === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.media_url}
            alt="Attachment"
            className="mt-2 max-h-56 rounded-lg object-cover"
          />
        )}
        {message.media_url && message.media_type === "video" && (
          <video
            src={message.media_url}
            controls
            className="mt-2 max-h-56 rounded-lg"
          />
        )}
        {message.media_url &&
          message.media_type !== "image" &&
          message.media_type !== "video" && (
            <a
              href={message.media_url}
              target="_blank"
              rel="noreferrer"
              className={`mt-2 block underline ${mine ? "text-white" : "text-pop"}`}
            >
              Download attachment
            </a>
          )}
        <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-navy/40"}`}>
          {formatMsgTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

type Props = {
  detail: ConversationDetail | null;
  user: User | null;
  loading?: boolean;
  onSend: (content: string, file: File | null) => Promise<void>;
  backHref?: string;
};

export function ChatPanel({ detail, user, loading, onSend, backHref }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length, detail?.id]);

  if (loading && !detail) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-navy/50">
        Loading chat…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="font-semibold text-navy">Select a conversation</p>
        <p className="mt-1 text-sm text-navy/50">Choose a thread from the list to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-[#edf2f7] bg-white px-4 py-3">
        {backHref && (
          <Link href={backHref} className="text-sm font-semibold text-navy/60 md:hidden">
            ← Back
          </Link>
        )}
        <div className="min-w-0">
          {detail.peer_profile_url ? (
            <Link
              href={detail.peer_profile_url}
              className="block truncate font-bold text-navy hover:text-pop"
            >
              {detail.peer_name}
            </Link>
          ) : (
            <p className="truncate font-bold text-navy">{detail.peer_name}</p>
          )}
          <p className="truncate text-xs text-navy/45">{detail.peer_subtitle}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f7fafc] px-4 py-4">
        {detail.messages.length === 0 && (
          <p className="text-center text-sm text-navy/45">No messages yet. Say hello.</p>
        )}
        {detail.messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            mine={user ? m.sender_id === user.id : false}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer canSend={detail.can_send} onSend={onSend} />
    </div>
  );
}
