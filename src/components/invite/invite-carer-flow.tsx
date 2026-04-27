"use client";

import { useState } from "react";
import {
  createInvite,
  inviteUrl,
  friendlyInviteError,
} from "~/lib/supabase/households";
import {
  ROLE_LABEL,
  ROLE_DESCRIPTION,
} from "~/lib/auth/permissions";
import type { HouseholdRole, HouseholdInvite } from "~/types/household";
import { useLocale, useL } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Field, TextInput } from "~/components/ui/field";
import {
  ChevronLeft,
  Check,
  Copy,
  Loader2,
  Share2,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "~/lib/utils/cn";

// Focused, three-step issuance wizard for the primary carer:
//
//   1. pick a role  → with one-line description so Thomas can pick by
//      meaning, not by jargon
//   2. add an optional name + email hint  → email isn't required since
//      a generated link is the actual delivery mechanism, but stashing
//      a hint helps Thomas remember which link he sent to whom
//   3. share the generated link  → native share sheet on phones,
//      copy-to-clipboard everywhere, and a "send via SMS / WhatsApp /
//      email" deep-link bar so non-technical relatives don't have to
//      think about how to forward a URL
//
// Designed to live inline on `/household` and as a modal on the
// dashboard — pass `onCancel` to render a "back" affordance, or omit
// it for a self-contained card.

type Step = "pick_role" | "details" | "share";

interface Props {
  householdId: string;
  // Roles the primary carer is allowed to assign on this surface. Defaults
  // to the four "non-self" roles — patient is intentionally excluded
  // because in practice the patient signs themselves up first, then Thomas
  // accepts them as primary_carer is already set up.
  allowedRoles?: HouseholdRole[];
  defaultRole?: HouseholdRole;
  onIssued?: (invite: HouseholdInvite) => void;
  onClose?: () => void;
}

const DEFAULT_ROLES: HouseholdRole[] = [
  "family",
  "clinician",
  "observer",
  "patient",
];

export function InviteCarerFlow({
  householdId,
  allowedRoles = DEFAULT_ROLES,
  defaultRole = "family",
  onIssued,
  onClose,
}: Props) {
  const locale = useLocale();
  const L = useL();

  const [step, setStep] = useState<Step>("pick_role");
  const [role, setRole] = useState<HouseholdRole>(defaultRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<HouseholdInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const url =
    issued && typeof window !== "undefined"
      ? inviteUrl(issued.token, window.location.origin)
      : null;

  async function issue() {
    setIssuing(true);
    setError(null);
    try {
      const inv = await createInvite({
        household_id: householdId,
        email_hint: email.trim() || undefined,
        role,
      });
      setIssued(inv);
      setStep("share");
      onIssued?.(inv);
    } catch (err) {
      setError(friendlyInviteError(err));
    } finally {
      setIssuing(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers block clipboard outside HTTPS or on unfocused
      // documents. Fall through silently — the link is still visible
      // and selectable in the textbox below.
    }
  }

  async function nativeShare() {
    if (!url || typeof navigator === "undefined" || !navigator.share) return;
    const recipientName = name.trim();
    const shareText = recipientName
      ? L(
          `${recipientName}, you've been invited to the family's Anchor care plan. Tap the link to join.`,
          `${recipientName}，您被邀请加入家人的 Anchor 护理计划。点击链接即可加入。`,
        )
      : L(
          "You've been invited to the family's Anchor care plan. Tap the link to join.",
          "您被邀请加入家人的 Anchor 护理计划。点击链接即可加入。",
        );
    try {
      await navigator.share({
        title: L("Join the care plan", "加入护理计划"),
        text: shareText,
        url,
      });
    } catch {
      // User dismissed the share sheet — non-fatal.
    }
  }

  function reset() {
    setStep("pick_role");
    setRole(defaultRole);
    setName("");
    setEmail("");
    setIssued(null);
    setError(null);
    setCopied(false);
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="eyebrow">{L("Invite", "邀请")}</div>
            <div className="serif mt-1 text-[18px] text-ink-900">
              {step === "pick_role"
                ? L("Add someone to the care team", "添加护理团队成员")
                : step === "details"
                  ? L("A few details", "再填几项")
                  : L("Share the link", "分享链接")}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100/40 hover:text-ink-900"
              aria-label={L("Close", "关闭")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[var(--warn)]/40 bg-[var(--warn-soft)] p-2.5 text-[12px] text-[var(--warn)]"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "pick_role" && (
          <RolePicker
            value={role}
            onChange={setRole}
            options={allowedRoles}
            locale={locale}
          />
        )}

        {step === "details" && (
          <DetailsStep
            role={role}
            name={name}
            email={email}
            onName={setName}
            onEmail={setEmail}
            locale={locale}
          />
        )}

        {step === "share" && url && issued && (
          <ShareStep
            url={url}
            name={name}
            role={role}
            copied={copied}
            onCopy={copy}
            onNativeShare={nativeShare}
            onAnother={reset}
            locale={locale}
          />
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {step === "details" && (
            <Button variant="ghost" onClick={() => setStep("pick_role")}>
              <ChevronLeft className="h-4 w-4" />
              {L("Back", "上一步")}
            </Button>
          )}
          {step === "pick_role" && <span />}
          {step === "share" && <span />}

          {step === "pick_role" && (
            <Button onClick={() => setStep("details")} size="md">
              {L("Continue", "继续")}
            </Button>
          )}
          {step === "details" && (
            <Button
              onClick={() => void issue()}
              disabled={issuing}
              size="md"
            >
              {issuing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {issuing
                ? L("Generating link…", "正在生成链接…")
                : L("Generate invite link", "生成邀请链接")}
            </Button>
          )}
          {step === "share" && (
            <Button variant="secondary" onClick={() => onClose?.() ?? reset()}>
              {L("Done", "完成")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RolePicker({
  value,
  onChange,
  options,
  locale,
}: {
  value: HouseholdRole;
  onChange: (r: HouseholdRole) => void;
  options: HouseholdRole[];
  locale: "en" | "zh";
}) {
  const L = useL();
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-ink-500">
        {L(
          "Roles control what the new member sees and can edit. You can change this later.",
          "角色决定新成员能看到和编辑的内容。日后可随时调整。",
        )}
      </p>
      <ul className="space-y-2">
        {options.map((r) => {
          const active = value === r;
          return (
            <li key={r}>
              <button
                type="button"
                onClick={() => onChange(r)}
                aria-pressed={active}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-ink-900 bg-ink-900 text-paper"
                    : "border-ink-200 bg-paper-2 hover:border-ink-400",
                )}
              >
                <div className="text-[14px] font-semibold">
                  {ROLE_LABEL[r][locale]}
                </div>
                <div
                  className={cn(
                    "mt-1 text-[12px] leading-relaxed",
                    active ? "text-paper/80" : "text-ink-500",
                  )}
                >
                  {ROLE_DESCRIPTION[r][locale]}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DetailsStep({
  role,
  name,
  email,
  onName,
  onEmail,
  locale,
}: {
  role: HouseholdRole;
  name: string;
  email: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
  locale: "en" | "zh";
}) {
  const L = useL();
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-ink-100 bg-paper-2 p-2.5 text-[12px] text-ink-700">
        <span className="font-medium">{L("Inviting as: ", "邀请角色：")}</span>
        {ROLE_LABEL[role][locale]}
      </div>
      <Field
        label={L("Their name (optional)", "对方姓名（可选）")}
        hint={L(
          "Helps you remember who this link was for. They'll set their own display name on first sign-in.",
          "便于您记住此链接发给了谁。对方首次登录时会自行设置显示名称。",
        )}
      >
        <TextInput
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={L("e.g. Catherine", "例如：王女士")}
          autoFocus
        />
      </Field>
      <Field
        label={L("Their email (optional)", "对方邮箱（可选）")}
        hint={L(
          "Stored as a hint on the invite — not auto-emailed. The link itself is the delivery channel.",
          "仅作为邀请的备注，系统不会自动发送邮件。请通过其他渠道分享链接。",
        )}
      >
        <TextInput
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          placeholder="catherine@example.com"
        />
      </Field>
    </div>
  );
}

function ShareStep({
  url,
  name,
  role,
  copied,
  onCopy,
  onNativeShare,
  onAnother,
  locale,
}: {
  url: string;
  name: string;
  role: HouseholdRole;
  copied: boolean;
  onCopy: () => void;
  onNativeShare: () => void;
  onAnother: () => void;
  locale: "en" | "zh";
}) {
  const L = useL();
  const recipientName = name.trim();
  const subject = L(
    "Join the family's Anchor care plan",
    "加入家人的 Anchor 护理计划",
  );
  const body = recipientName
    ? L(
        `Hi ${recipientName} — I've added you to dad's Anchor care plan as ${ROLE_LABEL[role].en}. Tap this link to join: ${url}`,
        `${recipientName}，我已把您加入到爸爸的 Anchor 护理计划，角色是${ROLE_LABEL[role].zh}。点击此链接加入：${url}`,
      )
    : L(
        `I've added you to the family's Anchor care plan. Tap this link to join: ${url}`,
        `我已把您加入到家人的 Anchor 护理计划。点击此链接加入：${url}`,
      );

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const sms = `sms:?&body=${encodeURIComponent(body)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(body)}`;

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-[var(--ok)]/40 bg-[var(--ok-soft)] p-3 text-[12.5px] text-ink-900">
        <div className="flex items-center gap-2 font-semibold">
          <Check className="h-4 w-4 text-[var(--ok)]" />
          {L("Link is ready", "链接已就绪")}
        </div>
        <p className="mt-1 text-ink-700">
          {L(
            "Valid for 14 days, single use. The new member will sign in (or create an account) and land on the family view.",
            "14 天内有效，仅可使用一次。对方登录（或注册）后会直接进入家庭视图。",
          )}
        </p>
      </div>

      <div className="rounded-md border border-ink-200 bg-paper-2 p-3">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
          {L("Invite link", "邀请链接")}
        </div>
        <div className="mt-1 break-all font-mono text-[11.5px] text-ink-700">
          {url}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={onCopy} size="md" variant="secondary">
          <Copy className="h-4 w-4" />
          {copied ? L("Copied", "已复制") : L("Copy link", "复制链接")}
        </Button>
        {canNativeShare ? (
          <Button onClick={onNativeShare} size="md">
            <Share2 className="h-4 w-4" />
            {L("Share…", "分享…")}
          </Button>
        ) : (
          <Button onClick={onCopy} size="md">
            <Copy className="h-4 w-4" />
            {L("Copy & paste anywhere", "复制后粘贴到任意位置")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a
          href={sms}
          className="rounded-md border border-ink-200 bg-paper-2 px-3 py-2 text-center text-[12px] font-medium text-ink-700 hover:border-ink-400"
        >
          {L("Text", "短信")}
        </a>
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-ink-200 bg-paper-2 px-3 py-2 text-center text-[12px] font-medium text-ink-700 hover:border-ink-400"
        >
          WhatsApp
        </a>
        <a
          href={mailto}
          className="rounded-md border border-ink-200 bg-paper-2 px-3 py-2 text-center text-[12px] font-medium text-ink-700 hover:border-ink-400"
        >
          {L("Email", "邮件")}
        </a>
      </div>

      <button
        type="button"
        onClick={onAnother}
        className="text-[12px] text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
      >
        {L("Invite someone else", "再邀请一位")}
      </button>
    </div>
  );
}
