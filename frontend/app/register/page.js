"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell, { AuthField, AuthError, AuthSubmit, PasswordToggle, AUTH_ICONS } from "@/components/AuthShell";
import { useAuth } from "@/lib/authContext";
import { useTranslation } from "@/lib/useTranslation";

const AUTH_ERRORS = {
  "auth/email-already-in-use": "register.error.emailInUse",
  "auth/invalid-email": "register.error.invalidEmail",
  "auth/weak-password": "register.error.weakPassword",
};

function getErrorMessage(err) {
  return AUTH_ERRORS[err?.code] || "register.error.system";
}

const STRENGTH_COLORS = { 1: "bg-red-400", 2: "bg-amber-400", 3: "bg-emerald-500" };

/** 1 = weak, 2 = fair, 3 = good. Purely a visual hint; the 6-char rule is enforced on submit. */
function passwordStrength(password) {
  if (!password) return 0;
  let score = password.length >= 6 ? 1 : 0;
  if (password.length >= 8 && /\d/.test(password) && /[a-zA-Z]/.test(password)) score++;
  if (password.length >= 10 && (/[^a-zA-Z0-9]/.test(password) || /[A-Z]/.test(password))) score++;
  return Math.max(score, 1);
}

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.email.trim() ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError(t("register.error.allFields"));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t("register.error.passwordMismatch"));
      return;
    }

    if (formData.password.length < 6) {
      setError(t("register.error.shortPassword"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError(t("register.error.invalidEmail"));
      return;
    }

    setSubmitting(true);

    try {
      await register(
        formData.email.trim(),
        formData.password,
        formData.firstName.trim(),
        formData.lastName.trim()
      );
      router.push("/dashboard");
    } catch (err) {
      console.error("Register error:", err);
      const errorKey = getErrorMessage(err);
      if (err.message === "PROFILE_CREATE_FAILED") {
        setError(t("register.error.profileFailed"));
      } else {
        setError(t(errorKey));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const strength = passwordStrength(formData.password);

  return (
    <AuthShell
      title={t("register.title")}
      subtitle={t("register.subtitle")}
      switchText={t("register.loginLink")}
      switchHref="/login"
      switchLabel={t("nav.login")}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <AuthError message={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            id="firstName"
            type="text"
            autoComplete="given-name"
            required
            label={t("register.firstName")}
            icon={AUTH_ICONS.user}
            value={formData.firstName}
            onChange={handleChange}
            placeholder={t("register.firstName.placeholder")}
          />
          <AuthField
            id="lastName"
            type="text"
            autoComplete="family-name"
            required
            label={t("register.lastName")}
            value={formData.lastName}
            onChange={handleChange}
            placeholder={t("register.lastName.placeholder")}
          />
        </div>

        <AuthField
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          label={t("register.email")}
          icon={AUTH_ICONS.email}
          value={formData.email}
          onChange={handleChange}
          placeholder={t("register.email.placeholder")}
        />

        <div>
          <AuthField
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            label={t("register.password")}
            icon={AUTH_ICONS.lock}
            value={formData.password}
            onChange={handleChange}
            placeholder={t("register.password.placeholder")}
            trailing={
              <PasswordToggle
                shown={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                showLabel={t("register.showPassword")}
                hideLabel={t("register.hidePassword")}
              />
            }
          />
          {formData.password && (
            <div className="mt-2 flex gap-1.5" aria-hidden>
              {[1, 2, 3].map((level) => (
                <span
                  key={level}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    strength >= level ? STRENGTH_COLORS[strength] : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <AuthField
          id="confirmPassword"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          label={t("register.confirmPassword")}
          icon={AUTH_ICONS.lock}
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder={t("register.confirmPassword.placeholder")}
          trailing={
            <PasswordToggle
              shown={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((v) => !v)}
              showLabel={t("register.showPassword")}
              hideLabel={t("register.hidePassword")}
            />
          }
        />

        <div className="pt-1">
          <AuthSubmit submitting={submitting} label={t("register.submit")} submittingLabel={t("register.submitting")} />
        </div>
      </form>
    </AuthShell>
  );
}
