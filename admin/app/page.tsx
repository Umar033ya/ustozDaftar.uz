import { redirect } from "next/navigation";
import { getSessionAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const admin = await getSessionAdmin();
  redirect(admin ? "/dashboard" : "/login");
  return null;
}