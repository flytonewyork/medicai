"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser, isSupabaseConfigured } from "~/lib/supabase/client";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import { PageHeader } from "~/components/ui/page-header";
import { useT } from "~/hooks/use-translate";

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace(next);
        router.refresh();
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // If Supabase returned an active session, sign-up + sign-in happened in
      // one go (email confirmation off). Skip the re-entry step.
      if (data.session) {
        router.replace(next);
        router.refresh();
        return;
      }
      // Otherwise email confirmation is on; dad needs to check his inbox.
      setInfo(t("welcomeAuth.createdConfirm"));
      setMode("signin");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 p-6 pt-10 md:pt-20">
      <PageHeader
        eyebrow={t("login.eyebrow")}
        title={
          mode === "signin" ? t("login.signinTitle") : t("login.signupTitle")
        }
      />

      <p className="text-sm text-ink-500">{t("login.explainer")}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t("welcomeAuth.email")}>
          <TextInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </Field>
        <Field label={t("welcomeAuth.password")}>
          <TextInput
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="••••••••"
          />
        </Field>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-3 text-sm text-[var(--warn)]"
          >
            {error}
          </div>
        )}
        {info && (
          <div
            role="status"
            className="rounded-md border border-ink-200 bg-paper-2 p-3 text-sm text-ink-700"
          >
            {info}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading
            ? t("login.pleaseWait")
            : mode === "signin"
              ? t("login.signinCta")
              : t("login.signupCta")}
        </Button>

        <button
          type="button"
          className="w-full text-sm text-ink-500 hover:text-ink-700"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "signin"
            ? t("login.toggleToSignup")
            : t("login.toggleToSignin")}
        </button>

        <p className="border-t border-ink-100/60 pt-4 text-center text-xs text-ink-500">
          {t("login.inviteHint")}
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
