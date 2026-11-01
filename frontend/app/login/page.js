"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell, { AuthField, AuthError, AuthSubmit, PasswordToggle, AUTH_ICONS } from "@/components/AuthShell";
import { useAuth } from "@/lib/authContext";
import { useTranslation } from "@/lib/useTranslation";

const AUTH_ERRORS = {
  "auth/invalid-email": "login.error.invalidEmail",
  "auth/email-already-in-use": "register.error.emailInUse",
  "auth/operation-not-allowed": "settings.email.error",
  "auth/too-many-requests": "login.error.tooManyRequests",
  "auth/user-mismatch": "settings.email.error",
  "auth/wrong-password": "login.error.invalidCredentials",
  "auth/invalid-credential": "login.error.invalidCredentials",
  "auth/invalid-login-credentials": "login.error.invalidCredentials",
  "auth/weak-password": "register.error.weakPassword",
  "auth/network-request-failed": "login.error.system",
  "auth/user-disabled": "login.error.blocked",
};

function getErrorMessage(err) {
  return AUTH_ERRORS[err?.code] || "login.error.system";
}

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError(t("login.error.allFields"));
      return;
    }

    setSubmitting(true);

    try {
      await login(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      const errorKey = getErrorMessage(err);
      setError(t(errorKey));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={t("login.title")}
      subtitle={t("login.subtitle")}
      switchText={t("login.registerLink")}
      switchHref="/register"
      switchLabel={t("nav.register")}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <AuthError message={error} />

        <AuthField
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          label={t("login.email")}
          icon={AUTH_ICONS.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("login.email.placeholder")}
        />

        <AuthField
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          label={t("login.password")}
          icon={AUTH_ICONS.lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("login.password.placeholder")}
          trailing={
            <PasswordToggle
              shown={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
              showLabel={t("login.showPassword")}
              hideLabel={t("login.hidePassword")}
            />
          }
        />

        <AuthSubmit submitting={submitting} label={t("login.submit")} submittingLabel={t("login.submitting")} />
      </form>
    </AuthShell>
  );
}
