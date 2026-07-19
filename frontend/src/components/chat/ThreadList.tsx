"use client";

import Link from "next/link";

import type { ConversationThread } from "@/lib/types";

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

type Props = {
  threads: ConversationThread[];
  activeId?: string | null;
  basePath: "/messages" | "/dashboard";
  emptyLabel?: string;
};

export function ThreadList({
  threads,
  activeId,
  basePath,
  emptyLabel = "No conversations yet.",
}: Props) {
  if (!threads.length) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-navy/50">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#edf2f7]">
      {threads.map((t) => {
        const active = t.id === activeId;
        return (
          <li key={t.id}>
            <Link
              href={`${basePath}/${t.id}`}
              className={`block px-4 py-3.5 transition hover:bg-graybg/80 ${
                active ? "bg-pop/5 border-l-4 border-pop" : "border-l-4 border-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold text-navy">{t.peer_name}</p>
                  <p className="truncate text-xs text-navy/45">{t.peer_subtitle}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-navy/40">{formatTime(t.last_message_at)}</p>
                  {t.unread_count > 0 && (
                    <span className="mt-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-pop px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {t.unread_count}
                    </span>
                  )}
                </div>
              </div>
              {t.preview && (
                <p className="mt-1 truncate text-sm text-navy/55">{t.preview}</p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
