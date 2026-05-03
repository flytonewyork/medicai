"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { getSupabaseBrowser, isSupabaseConfigured } from "~/lib/supabase/client";
import { submitPasswordAuth } from "~/lib/supabase/auth";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import { useT } from "~/hooks/use-translate";
import { nowISO } from "~/lib/utils/date";

const SEEN_KEY = "anchor.welcomeSeenAt";

// Soft, closeable sign-in/register pop-up that greets every first-time
// visitor. The app is local-first; this is an invitation, not a gate.
export function WelcomeAuthModal() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (pathname === "/login" || pathname === "/auth/callback") return;
    if (localStorage.getItem(SEEN_KEY)) return;

    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) setOpen(true);
    });
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    localStorage.setItem(SEEN_KEY, nowISO());
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!getSupabaseBrowser()) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const result = await submitPasswordAuth(mode, email, password);
      if (result.status === "signed-in") {
        localStorage.setItem(SEEN_KEY, nowISO());
        setOpen(false);
        router.refresh();
        return;
      }
      setInfo(t("welcomeAuth.createdConfirm"));
      setMode("signin");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-auth-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm rounded-[var(--r-lg)] border border-ink-100 bg-paper-2 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("welcomeAuth.close")}
          className="absolute right-3 top-3 rounded p-1 text-ink-400 hover:text-ink-700"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="mb-4 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
            Anchor
          </p>
          <h2
            id="welcome-auth-title"
            className="serif text-xl text-ink-900"
          >
            {mode === "signin"
              ? t("welcomeAuth.signinTitle")
              : t("welcomeAuth.signupTitle")}
          </h2>
          <p className="text-sm text-ink-500">{t("welcomeAuth.body")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
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
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
            />
          </Field>

          {error && (
            <div className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-2.5 text-sm text-[var(--warn)]">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-md border border-ink-200 bg-paper-2 p-2.5 text-sm text-ink-700">
              {info}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading
              ? t("welcomeAuth.pleaseWait")
              : mode === "signin"
                ? t("welcomeAuth.signinCta")
                : t("welcomeAuth.signupCta")}
          </Button>

          <button
            type="button"
            className="w-full text-xs text-ink-500 hover:text-ink-700"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
          >
            {mode === "signin"
              ? t("welcomeAuth.toggleToSignup")
              : t("welcomeAuth.toggleToSignin")}
          </button>
        </form>

        <button
          type="button"
          onClick={close}
          className="mt-4 block w-full text-center text-xs text-ink-400 hover:text-ink-600"
        >
          {t("welcomeAuth.continueWithout")}
        </button>
      </div>
    </div>
  );
}
