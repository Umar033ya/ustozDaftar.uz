"use client";

import { AuthProvider } from "@/lib/authContext";

export default function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
