"use client";

import { useState } from "react";
import { getSupabaseBrowser, isSupabaseConfigured } from "~/lib/supabase/client";
import { submitPasswordAuth } from "~/lib/supabase/auth";
import { useL } from "~/hooks/use-translate";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import { Alert } from "~/components/ui/alert";
import { Loader2 } from "lucide-react";

// Embeddable sign-in / sign-up panel. Same behaviour as
// /login and the welcome modal, but rendered inline so an onboarding
// or settings flow doesn't have to redirect away. After auth the
// caller's `onAuthed` fires; the surrounding UI is responsible for
// what happens next (refresh hooks, advance step, etc.).
//
// Why pull this out of WelcomeAuthModal? Caregiver onboarding's
// PickPatientStep was hitting a raw `permission denied for function
// list_all_households` error because it called the auth-only RPC
// without checking auth state first. Same UX problem will recur
// anywhere we need an auth boundary mid-flow — a reusable panel
// keeps every surface lit consistently.

export interface InlineSignInProps {
  // Fired when sign-in or sign-up succeeds and a session is active.
  // Sign-up with email-confirmation enabled never fires this — the
  // panel surfaces the "check your inbox" hint and waits.
  onAuthed?: () => void | Promise<void>;
  // Eyebrow + title above the form. Defaults to a generic "Sign in"
  // header; surfaces with their own framing (e.g. caregiver
  // onboarding) can pass tailored copy.
  title?: string;
  subtitle?: string;
}

export function InlineSignIn({
  onAuthed,
  title,
  subtitle,
}: InlineSignInProps) {
  const L = useL();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!isSupabaseConfigured()) {
    return (
      <Alert variant="warn" dense>
        {L(
          "Cloud sync isn't configured on this build. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before signing in.",
          "本版本未配置云同步。请先设置 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY 后再登录。",
        )}
      </Alert>
    );
  }

  const heading =
    title ??
    (mode === "signin"
      ? L("Sign in to Anchor", "登录 Anchor")
      : L("Create an Anchor account", "创建 Anchor 账号"));
  const tagline =
    subtitle ??
    L(
      "Your account is yours — you can use it across devices.",
      "账号属于您本人，可在多设备使用。",
    );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!getSupabaseBrowser()) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const result = await submitPasswordAuth(mode, email, password);
      if (result.status === "signed-in") {
        await onAuthed?.();
        return;
      }
      setInfo(
        L(
          "Account created — check your email to confirm, then sign in.",
          "账号已创建 —— 请查收邮件确认后再登录。",
        ),
      );
      setMode("signin");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <div className="text-[14px] font-semibold text-ink-900">{heading}</div>
        <p className="text-[12px] text-ink-500">{tagline}</p>
      </div>
      <Field label={L("Email", "邮箱")}>
        <TextInput
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />
      </Field>
      <Field label={L("Password", "密码")}>
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
        <Alert variant="warn" dense>
          {error}
        </Alert>
      )}
      {info && (
        <Alert variant="info" dense>
          {info}
        </Alert>
      )}
      <Button type="submit" size="md" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading
          ? L("Please wait…", "请稍候…")
          : mode === "signin"
            ? L("Sign in", "登录")
            : L("Create account", "创建账号")}
      </Button>
      <button
        type="button"
        className="w-full text-[12px] text-ink-500 hover:text-ink-900"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setInfo(null);
        }}
      >
        {mode === "signin"
          ? L("New here? Create an account", "首次使用？创建账号")
          : L("Already have an account? Sign in", "已有账号？登录")}
      </button>
    </form>
  );
}
