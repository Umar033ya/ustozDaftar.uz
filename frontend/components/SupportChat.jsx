"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authorizedFetch } from "@/lib/apiClient";
import { useTranslation } from "@/lib/useTranslation";

// Polling instead of a Firestore listener: the thread is server-only (Admin
// SDK), so no client security rule ever exposes it.
const OPEN_POLL_MS = 4000;
const CLOSED_POLL_MS = 30000;
const MAX_LENGTH = 2000;

function mergeMessages(current, incoming) {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

function timeLabel(ts) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameDay ? hm : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${hm}`;
}

function errorKey(error) {
  if (error?.code === "rate_limited") return "support.error.rateLimited";
  if (error?.code === "not_configured" || error?.status === 503) return "support.error.unavailable";
  if (error?.code === "too_long") return "support.error.tooLong";
  return null;
}

export default function SupportChat() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const lastTsRef = useRef(0);
  const listRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await authorizedFetch(`/api/support/messages?since=${lastTsRef.current}`);
      const incoming = Array.isArray(data?.messages) ? data.messages : [];
      if (incoming.length > 0) lastTsRef.current = incoming[incoming.length - 1].createdAt;
      setMessages((current) => mergeMessages(current, incoming));
      setUnread(0);
      setError("");
    } catch (e) {
      setError(t(errorKey(e) || "support.error.load"));
    } finally {
      setLoaded(true);
    }
  }, [t]);

  const peek = useCallback(async () => {
    try {
      const data = await authorizedFetch("/api/support/messages?peek=1");
      setUnread(Number(data?.unread) || 0);
    } catch {
      /* the badge is best effort */
    }
  }, []);

  // Poll faster while the panel is open; pause while the tab is hidden.
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      if (open) loadMessages();
      else peek();
    };
    tick();
    const id = setInterval(tick, open ? OPEN_POLL_MS : CLOSED_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [open, loadMessages, peek]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError("");
    try {
      const data = await authorizedFetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      if (data?.message) {
        setMessages((current) => mergeMessages(current, [data.message]));
        lastTsRef.current = Math.max(lastTsRef.current, data.message.createdAt);
      }
      setText("");
    } catch (err) {
      setError(t(errorKey(err) || "support.error.send"));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) send(e);
  };

  return (
    <div className="print:hidden">
      {open && (
        <div className="fixed inset-x-3 bottom-20 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:left-auto sm:right-6 sm:w-96">
          <div className="flex items-start justify-between gap-3 bg-blue-600 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t("support.title")}</p>
              <p className="mt-0.5 text-xs text-blue-100">{t("support.subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("support.close")}
              className="rounded-lg p-1 text-blue-100 hover:bg-blue-500 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div ref={listRef} className="min-h-[220px] flex-1 space-y-2 overflow-y-auto bg-gray-50 px-3 py-3">
            {loaded && messages.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-gray-500">{t("support.empty")}</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-xs ${
                    m.sender === "user"
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "rounded-bl-sm border border-gray-200 bg-white text-gray-900"
                  }`}
                >
                  {m.sender === "admin" && (
                    <p className="mb-0.5 text-[11px] font-semibold text-blue-600">{t("support.admin")}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`mt-1 text-right text-[10px] ${m.sender === "user" ? "text-blue-100" : "text-gray-400"}`}>
                    {timeLabel(m.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <form onSubmit={send} className="flex items-end gap-2 border-t border-gray-200 bg-white p-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={t("support.placeholder")}
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? t("support.sending") : t("support.send")}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 sm:right-6"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span className="hidden sm:inline">{t("support.button")}</span>
        {unread > 0 && !open && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
