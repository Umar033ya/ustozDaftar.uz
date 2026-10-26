import { Card, ErrorBanner, PageHeader } from "@/components/ui";
import { ChatInbox } from "@/components/chat-inbox";
import { listThreads } from "@/lib/chat";
import { getUserDetail } from "@/lib/data";
import type { ChatThread } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>;
}) {
  const { uid } = await searchParams;
  let threads: ChatThread[] = [];
  let error: string | null = null;

  try {
    threads = await listThreads();
    // "Xabar yozish" from a user's page: open a new conversation with them.
    if (uid && !threads.some((t) => t.uid === uid)) {
      const user = await getUserDetail(uid);
      if (user) {
        threads = [
          {
            uid: user.uid,
            userName: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
            userEmail: user.email,
            plan: user.plan,
            planExpiry: user.planExpiry,
            lastMessage: "",
            lastMessageAt: 0,
            lastSender: "admin",
            unreadByAdmin: 0,
          },
          ...threads,
        ];
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Server xatosi";
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Xabarlar"
        subtitle="Foydalanuvchilar administratorga yozgan xabarlar — kim yozgani va tarifi bilan"
      />
      {error ? (
        <ErrorBanner message={`Ma'lumotlarni yuklab bo'lmadi: ${error}`} />
      ) : (
        <Card className="overflow-hidden">
          <ChatInbox initialThreads={threads} initialUid={uid ?? null} />
        </Card>
      )}
    </div>
  );
}
