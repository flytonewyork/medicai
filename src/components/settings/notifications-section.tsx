"use client";

import { useCallback, useEffect, useState } from "react";
import {
  disablePush,
  enablePush,
  getCurrentSubscription,
  getPushSupport,
  sendTestPush,
} from "~/lib/push/client";
import { useLocale } from "~/hooks/use-translate";
import { useBilingual } from "~/hooks/use-bilingual";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Bell, BellOff, Check, AlertCircle } from "lucide-react";

// Settings → Notifications. One toggle per device: when on, this
// device receives push for appointment reminders, zone transitions,
// and the morning digest (Slice E lands the cron that fires them).

type Status =
  | { kind: "loading" }
  | { kind: "unsupported"; reason: string }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string }
  | { kind: "error"; message: string };

export function NotificationsSection() {
  const locale = useLocale();
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [busy, setBusy] = useState<"enable" | "disable" | "test" | null>(null);
  const [testedOk, setTestedOk] = useState(false);

  const L = useBilingual();

  const refresh = useCallback(async () => {
    const support = getPushSupport();
    if (support.kind !== "supported") {
      setStatus({ kind: "unsupported", reason: support.reason });
      return;
    }
    if (support.permission === "denied") {
      setStatus({ kind: "denied" });
      return;
    }
    const sub = await getCurrentSubscription();
    if (sub) setStatus({ kind: "on", endpoint: sub.endpoint });
    else setStatus({ kind: "off" });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onEnable() {
    setBusy("enable");
    try {
      const res = await enablePush({ locale });
      if (res.ok) {
        setStatus({ kind: "on", endpoint: res.endpoint });
      } else if (res.reason === "denied") {
        setStatus({ kind: "denied" });
      } else {
        setStatus({ kind: "error", message: res.reason });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onDisable() {
    setBusy("disable");
    try {
      await disablePush();
      setStatus({ kind: "off" });
    } finally {
      setBusy(null);
    }
  }

  async function onTest() {
    setBusy("test");
    try {
      const ok = await sendTestPush();
      setTestedOk(ok);
      setTimeout(() => setTestedOk(false), 2500);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="eyebrow">
          <Bell className="mr-1.5 inline h-3.5 w-3.5" />
          {L("Notifications", "通知")}
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          {L(
            "Push reminders for tomorrow's appointments, overdue follow-ups, and zone changes. Per-device — toggle on any phone that should buzz.",
            "推送明日预约、待跟进项目与状态变化。每台设备独立开关。",
          )}
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          {status.kind === "loading" && (
            <p className="text-[12.5px] text-ink-500">{L("Checking…", "正在检查…")}</p>
          )}

          {status.kind === "unsupported" && (
            <UnsupportedNote reason={status.reason} locale={locale} />
          )}

          {status.kind === "denied" && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-[13px]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warn)]" />
                <div>
                  <div className="font-semibold text-ink-900">
                    {L("Browser permission blocked", "浏览器已阻止通知权限")}
                  </div>
                  <p className="mt-1 text-[12px] text-ink-500">
                    {L(
                      "You denied notifications for this site. Enable them in your browser's site settings, then reload.",
                      "你拒绝了此站点的通知权限。请在浏览器站点设置中启用后重新加载。",
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {status.kind === "off" && (
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] text-ink-700">
                {L("Off on this device", "此设备未开启")}
              </div>
              <Button onClick={onEnable} disabled={busy !== null} size="md">
                <Bell className="h-4 w-4" />
                {busy === "enable"
                  ? L("Enabling…", "开启中…")
                  : L("Turn on", "开启")}
              </Button>
            </div>
          )}

          {status.kind === "on" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--ok)]">
                  <Check className="h-4 w-4" />
                  {L("On for this device", "此设备已开启")}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={onTest}
                    disabled={busy !== null}
                  >
                    {busy === "test"
                      ? L("Sending…", "发送中…")
                      : testedOk
                        ? L("Sent ✓", "已发送 ✓")
                        : L("Send test", "测试一下")}
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    onClick={onDisable}
                    disabled={busy !== null}
                  >
                    <BellOff className="h-4 w-4" />
                    {busy === "disable"
                      ? L("Turning off…", "关闭中…")
                      : L("Turn off", "关闭")}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-ink-400">
                {L(
                  "On iPhone: Web Push only works when Anchor is installed to the home screen.",
                  "iPhone：需将 Anchor 添加到主屏幕后，通知才能工作。",
                )}
              </p>
            </div>
          )}

          {status.kind === "error" && (
            <div className="flex items-start gap-2 text-[12.5px] text-[var(--warn)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{status.message}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function UnsupportedNote({
  reason,
  locale,
}: {
  reason: string;
  locale: "en" | "zh";
}) {
  const L = useBilingual();
  const label =
    reason === "no-service-worker"
      ? L("Your browser doesn't support service workers.", "此浏览器不支持 Service Worker。")
      : reason === "no-push-manager"
        ? L(
            "Push isn't supported in this browser. On iOS Safari, add Anchor to the home screen first.",
            "此浏览器不支持推送。iOS Safari 需先将 Anchor 添加到主屏幕。",
          )
        : reason === "no-notifications"
          ? L(
              "Notifications aren't available in this browser.",
              "此浏览器不支持系统通知。",
            )
          : L(
              "Push isn't available here.",
              "当前环境不支持推送。",
            );
  return <p className="text-[12.5px] text-ink-500">{label}</p>;
}
