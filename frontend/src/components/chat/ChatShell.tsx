"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { ThreadList } from "@/components/chat/ThreadList";
import { ApiRequestError, apiFetch } from "@/lib/api";
import type {
  ConversationDetail,
  ConversationThread,
  User,
} from "@/lib/types";

type Props = {
  mode: "renter" | "agent";
  selectedId?: string | null;
};

export function ChatShell({ mode, selectedId }: Props) {
  const router = useRouter();
  const basePath = mode === "agent" ? "/dashboard" : "/messages";
  const [user, setUser] = useState<User | null>(null);
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const data = await apiFetch<{
        mode: "renter" | "agent";
        conversations: ConversationThread[];
      }>("/conversations/");
      if (mode === "renter" && data.mode === "agent") {
        router.replace(selectedId ? `/dashboard/${selectedId}` : "/dashboard");
        return;
      }
      if (mode === "agent" && data.mode === "renter") {
        router.replace(selectedId ? `/messages/${selectedId}` : "/messages");
        return;
      }
      setThreads(data.conversations);
      setError("");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(basePath)}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Could not load conversations.");
    } finally {
      setLoadingList(false);
    }
  }, [basePath, mode, router, selectedId]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingChat(true);
    try {
      const data = await apiFetch<ConversationDetail>(
        `/conversations/${selectedId}/`
      );
      setDetail(data);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`${basePath}/${selectedId}`)}`);
        return;
      }
      setDetail(null);
      setError(err instanceof Error ? err.message : "Could not load chat.");
    } finally {
      setLoadingChat(false);
    }
  }, [basePath, router, selectedId]);

  useEffect(() => {
    apiFetch<User>("/me/")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    loadThreads();
    const id = window.setInterval(loadThreads, 5000);
    return () => window.clearInterval(id);
  }, [loadThreads]);

  useEffect(() => {
    loadDetail();
    if (!selectedId) return;
    const id = window.setInterval(loadDetail, 5000);
    return () => window.clearInterval(id);
  }, [loadDetail, selectedId]);

  async function handleSend(content: string, file: File | null) {
    if (!selectedId) return;
    if (file) {
      const form = new FormData();
      if (content) form.append("content", content);
      form.append("media_file", file);
      const msg = await apiFetch(`/conversations/${selectedId}/messages/`, {
        method: "POST",
        body: form,
      });
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, msg as ConversationDetail["messages"][0]],
            }
          : prev
      );
    } else {
      const msg = await apiFetch<ConversationDetail["messages"][0]>(
        `/conversations/${selectedId}/messages/`,
        {
          method: "POST",
          body: JSON.stringify({ content }),
        }
      );
      setDetail((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev
      );
    }
    await loadThreads();
  }

  const showListOnMobile = !selectedId;
  const showChatOnMobile = Boolean(selectedId);

  return (
    <div className="container-app py-4 md:py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-navy">
          {mode === "agent" ? "Agent dashboard" : "Messages"}
        </h1>
        <p className="text-sm text-navy/55">
          {mode === "agent"
            ? "Reply to renter inquiries. New messages refresh every few seconds."
            : "Chat with agents. New messages refresh every few seconds."}
        </p>
      </div>

      {error && (
        <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>
      )}

      <div className="grid h-[calc(100vh-11rem)] overflow-hidden rounded-2xl border border-[#d8e0ea] bg-white shadow-card md:grid-cols-[320px_1fr]">
        <aside
          className={`min-h-0 overflow-y-auto border-r border-[#edf2f7] ${
            showListOnMobile ? "block" : "hidden md:block"
          }`}
        >
          {loadingList && !threads.length ? (
            <p className="p-6 text-center text-sm text-navy/50">Loading…</p>
          ) : (
            <ThreadList
              threads={threads}
              activeId={selectedId}
              basePath={basePath}
              emptyLabel={
                mode === "agent"
                  ? "No renter inquiries yet."
                  : "No conversations yet. Contact an agent from their profile."
              }
            />
          )}
        </aside>

        <section
          className={`min-h-0 ${showChatOnMobile ? "block" : "hidden md:block"}`}
        >
          <ChatPanel
            detail={detail}
            user={user}
            loading={loadingChat}
            onSend={handleSend}
            backHref={basePath}
          />
        </section>
      </div>
    </div>
  );
}
