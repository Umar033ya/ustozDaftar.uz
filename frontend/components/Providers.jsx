"use client";

import { AuthProvider } from "@/lib/authContext";
import { I18nProvider } from "@/lib/i18nContext";
import { SubscriptionProvider } from "@/lib/subscriptionContext";

export default function Providers({ children }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <SubscriptionProvider>{children}</SubscriptionProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
