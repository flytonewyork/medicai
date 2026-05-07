"use client";

import { useEffect, useState } from "react";
import { useL } from "~/hooks/use-translate";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Watch, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getHealthConnectClient,
  type HealthConnectClient,
  type PermissionStatus,
} from "~/lib/wearable";
import type { WearableMetricKind } from "~/types/wearable";

// The metrics we ask Health Connect for. Aligned with what the
// `capacitor-health-connect@0.7.0` plugin currently supports.
// HRV + Sleep are added when the plugin extension lands.
const REQUESTED_METRICS: ReadonlyArray<WearableMetricKind> = [
  "resting_hr_bpm",
  "spo2_pct_overnight",
  "steps",
  "weight_kg",
  "body_fat_pct",
  "body_temperature_c",
  "active_calories_kcal",
];

const METRIC_LABEL: Record<WearableMetricKind, [string, string]> = {
  resting_hr_bpm: ["Resting heart rate", "静息心率"],
  hrv_rmssd_ms: ["Heart rate variability", "心率变异"],
  spo2_pct_overnight: ["Oxygen saturation", "血氧饱和度"],
  steps: ["Steps", "步数"],
  active_calories_kcal: ["Active calories", "活动热量"],
  sleep_total_minutes: ["Sleep duration", "睡眠时长"],
  sleep_efficiency_pct: ["Sleep efficiency", "睡眠效率"],
  sleep_waso_min: ["Time awake at night", "夜间觉醒时长"],
  sleep_awakenings_count: ["Awakenings", "觉醒次数"],
  weight_kg: ["Weight", "体重"],
  body_fat_pct: ["Body fat", "体脂率"],
  body_temperature_c: ["Body temperature", "体温"],
};

type AvailabilityState = "checking" | "available" | "unavailable";

export function WearableSection() {
  const L = useL();
  const [availability, setAvailability] = useState<AvailabilityState>("checking");
  const [permissions, setPermissions] = useState<
    Record<WearableMetricKind, PermissionStatus> | null
  >(null);
  const [client, setClient] = useState<HealthConnectClient | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getHealthConnectClient();
      if (cancelled) return;
      setClient(c);
      const isAvailable = await c.isAvailable();
      if (cancelled) return;
      setAvailability(isAvailable ? "available" : "unavailable");
      if (isAvailable) {
        const p = await c.permissionsFor(REQUESTED_METRICS);
        if (!cancelled) setPermissions(p);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect() {
    if (!client) return;
    setIsRequesting(true);
    try {
      const p = await client.requestPermissions(REQUESTED_METRICS);
      setPermissions(p);
    } finally {
      setIsRequesting(false);
    }
  }

  const grantedCount = permissions
    ? REQUESTED_METRICS.filter((m) => permissions[m] === "granted").length
    : 0;

  return (
    <section className="space-y-3">
      <h2 className="eyebrow">
        <Watch className="mr-1.5 inline h-3.5 w-3.5" />
        {L("Wearable", "穿戴设备")}
      </h2>
      <Card>
        <CardContent className="space-y-3 pt-4">
          {availability === "checking" && (
            <p className="text-[12.5px] text-ink-500">
              {L("Checking Health Connect…", "正在检查 Health Connect…")}
            </p>
          )}
          {availability === "unavailable" && (
            <div className="flex items-start gap-2 text-[12.5px] text-ink-500">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                {L(
                  "Health Connect is not available on this device. Install Health Connect on the patient's Android phone, then pair an Oura ring or other supported device.",
                  "本设备不可用 Health Connect。请在患者的 Android 手机上安装 Health Connect，然后配对 Oura 戒指或其他支持的设备。",
                )}
              </p>
            </div>
          )}
          {availability === "available" && permissions && (
            <>
              <div className="flex items-start gap-2">
                {grantedCount > 0 ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
                )}
                <div className="text-[12.5px] text-ink-700">
                  {grantedCount === 0
                    ? L(
                        "Health Connect is installed but no metrics are linked yet.",
                        "Health Connect 已安装但尚未授权任何指标。",
                      )
                    : L(
                        `${grantedCount} of ${REQUESTED_METRICS.length} metrics linked.`,
                        `已授权 ${grantedCount} / ${REQUESTED_METRICS.length} 项指标。`,
                      )}
                </div>
              </div>
              <ul className="space-y-1.5">
                {REQUESTED_METRICS.map((m) => {
                  const status = permissions[m];
                  const [en, zh] = METRIC_LABEL[m];
                  return (
                    <li
                      key={m}
                      className="flex items-center justify-between text-[12.5px]"
                    >
                      <span className="text-ink-700">{L(en, zh)}</span>
                      <span
                        className={
                          status === "granted"
                            ? "text-emerald-600"
                            : "text-ink-400"
                        }
                      >
                        {status === "granted"
                          ? L("Linked", "已链接")
                          : status === "denied"
                            ? L("Not granted", "未授权")
                            : L("Not requested", "未请求")}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Button
                type="button"
                onClick={handleConnect}
                disabled={isRequesting}
                className="w-full"
              >
                {isRequesting
                  ? L("Opening…", "正在打开…")
                  : grantedCount === REQUESTED_METRICS.length
                    ? L("Re-confirm permissions", "重新确认授权")
                    : L("Link Health Connect", "链接 Health Connect")}
              </Button>
              <p className="text-[11.5px] leading-relaxed text-ink-500">
                {L(
                  "Linking lets the platform read passive readings from the Oura ring, Withings scale, and other devices that publish to Health Connect. The ring is the recommended pairing for daily HRV, sleep, and resting heart rate.",
                  "链接后平台可读取 Oura 戒指、Withings 体重秤等设备发布到 Health Connect 的被动数据。戒指为推荐配对，用于每日 HRV、睡眠及静息心率。",
                )}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
