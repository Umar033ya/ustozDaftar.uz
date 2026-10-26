"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorBanner, Input, PlanBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { ChatMessage, ChatThread } from "@/lib/types";

const THREAD_POLL_MS = 15_000;
const MESSAGE_POLL_MS = 4_000;
const MAX_LENGTH = 2000;

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

function displayName(t: ChatThread): string {
  return t.userName || t.userEmail || "Noma'lum foydalanuvchi";
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || "Serverda xatolik yuz berdi.";
}

export function ChatInbox({
  initialThreads,
  initialUid,
}: {
  initialThreads: ChatThread[];
  initialUid: string | null;
}) {
  const [threads, setThreads] = useState<ChatThread[]>(initialThreads);
  const [selected, setSelected] = useState<string | null>(
    initialUid ?? (initialThreads[0]?.uid || null)
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(initialUid));
  const lastTsRef = useRef(0);
  const selectedRef = useRef<string | null>(selected);
  const listRef = useRef<HTMLDivElement>(null);

  const refreshThreads = useCallback(async () => {
    const res = await fetch("/api/admin/chats", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { threads: ChatThread[] };
    setThreads((current) => {
      // Keep a just-opened conversation that has no message yet.
      const extra = current.filter((t) => t.lastMessageAt === 0 && !data.threads.some((n) => n.uid === t.uid));
      return [...extra, ...data.threads];
    });
  }, []);

  const loadMessages = useCallback(async (uid: string) => {
    const res = await fetch(`/api/admin/chats/${encodeURIComponent(uid)}?since=${lastTsRef.current}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    const data = (await res.json()) as { messages: ChatMessage[] };
    // Ignore a late answer for a conversation that is no longer open.
    if (selectedRef.current !== uid) return;
    if (data.messages.length > 0) {
      lastTsRef.current = data.messages[data.messages.length - 1].createdAt;
    }
    setMessages((current) => mergeMessages(current, data.messages));
    setThreads((current) => current.map((t) => (t.uid === uid ? { ...t, unreadByAdmin: 0 } : t)));
    setError("");
  }, []);

  // Thread list: refresh periodically while the tab is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) refreshThreads().catch(() => {});
    }, THREAD_POLL_MS);
    return () => clearInterval(id);
  }, [refreshThreads]);

  // Selected conversation: reload from scratch, then poll for new messages.
  useEffect(() => {
    selectedRef.current = selected;
    if (!selected) return;
    lastTsRef.current = 0;
    setMessages([]);
    setError("");
    loadMessages(selected).catch(() => setError("Xabarlarni yuklab bo'lmadi."));
    const id = setInterval(() => {
      if (!document.hidden) loadMessages(selected).catch(() => {});
    }, MESSAGE_POLL_MS);
    return () => clearInterval(id);
  }, [selected, loadMessages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, selected]);

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (onlyUnread && t.unreadByAdmin === 0) return false;
      if (!q) return true;
      return [t.userName, t.userEmail, t.lastMessage].some((v) => v?.toLowerCase().includes(q));
    });
  }, [threads, query, onlyUnread]);

  const current = threads.find((t) => t.uid === selected) ?? null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!selected || !value || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/chats/${encodeURIComponent(selected)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json()) as { message: ChatMessage };
      setMessages((list) => mergeMessages(list, [data.message]));
      lastTsRef.current = Math.max(lastTsRef.current, data.message.createdAt);
      setThreads((list) => {
        const updated = list.map((t) =>
          t.uid === selected
            ? { ...t, lastMessage: value.slice(0, 200), lastMessageAt: data.message.createdAt, lastSender: "admin" as const }
            : t
        );
        return updated.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      });
      setText("");
    } catch {
      setError("Xabar yuborilmadi. Internet aloqasini tekshiring.");
    } finally {
      setSending(false);
    }
  };

  const select = (uid: string) => {
    setSelected(uid);
    setMobileShowChat(true);
  };

  return (
    <div className="grid h-[calc(100vh-12rem)] min-h-[480px] grid-cols-1 md:grid-cols-[320px_1fr]">
      {/* Thread list */}
      <div
        className={`flex min-h-0 flex-col border-gray-200 dark:border-gray-800 md:border-r ${
          mobileShowChat ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="space-y-2 border-b border-gray-100 p-3 dark:border-gray-800">
          <Input placeholder="Ism, email yoki matn bo'yicha qidirish" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
            Faqat o&apos;qilmaganlar
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleThreads.length === 0 ? (
            <EmptyState title="Xabarlar yo'q" description="Foydalanuvchi yozganda bu yerda ko'rinadi." />
          ) : (
            visibleThreads.map((t) => (
              <button
                key={t.uid}
                type="button"
                onClick={() => select(t.uid)}
                className={`flex w-full flex-col gap-1 border-b border-gray-50 px-4 py-3 text-left transition-colors dark:border-gray-800/60 ${
                  t.uid === selected
                    ? "bg-blue-50 dark:bg-blue-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{displayName(t)}</span>
                  {t.unreadByAdmin > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                      {t.unreadByAdmin > 99 ? "99+" : t.unreadByAdmin}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <PlanBadge plan={t.plan} />
                  {t.userEmail && t.userName && (
                    <span className="truncate text-xs text-gray-500 dark:text-gray-400">{t.userEmail}</span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {t.lastMessageAt === 0
                    ? "Yangi suhbat"
                    : `${t.lastSender === "admin" ? "Siz: " : ""}${t.lastMessage}`}
                </p>
                {t.lastMessageAt > 0 && (
                  <p className="text-[11px] text-gray-400">{formatDateTime(t.lastMessageAt)}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className={`min-h-0 flex-col ${mobileShowChat ? "flex" : "hidden md:flex"}`}>
        {!current ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState title="Suhbatni tanlang" description="Chap tomondagi ro'yxatdan foydalanuvchini tanlang." />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileShowChat(false)}
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
                  aria-label="Orqaga"
                >
                  ←
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{displayName(current)}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <PlanBadge plan={current.plan} />
                    {current.userEmail && (
                      <span className="truncate text-xs text-gray-500 dark:text-gray-400">{current.userEmail}</span>
                    )}
                  </div>
                </div>
              </div>
              <Link
                href={`/dashboard/users/${encodeURIComponent(current.uid)}`}
                className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Profil →
              </Link>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-gray-50 px-4 py-4 dark:bg-gray-950/40">
              {messages.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  Hali xabar yo&apos;q. Birinchi bo&apos;lib yozishingiz mumkin.
                </p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "admin" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      m.sender === "admin"
                        ? "rounded-br-sm bg-blue-600 text-white"
                        : "rounded-bl-sm border border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`mt-1 text-right text-[10px] ${m.sender === "admin" ? "text-blue-100" : "text-gray-400"}`}>
                      {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="px-4 pt-3">
                <ErrorBanner message={error} />
              </div>
            )}

            <form onSubmit={send} className="flex items-end gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) send(e);
                }}
                rows={2}
                placeholder="Javob yozing... (Enter — yuborish, Shift+Enter — yangi qator)"
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "..." : "Yuborish"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
