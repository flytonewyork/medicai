import type {
  DailyEntry,
  LabResult,
  Settings,
} from "~/types/clinical";
import type { FeedItem } from "~/types/feed";

export interface TrendInputs {
  settings: Settings | null;
  recentDailies: DailyEntry[]; // chronological ascending, up to 28
  recentLabs: LabResult[]; // chronological ascending
  todayISO: string;
}

function avg(nums: number[]): number | null {
  const vs = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (vs.length === 0) return null;
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

export function computeTrendNudges({
  settings,
  recentDailies,
  recentLabs,
  todayISO,
}: TrendInputs): FeedItem[] {
  const out: FeedItem[] = [];
  const baselineWeight = settings?.baseline_weight_kg ?? null;

  // ── Daily check-in reminder ───────────────────────────────────────
  const loggedToday = recentDailies.some((d) => d.date === todayISO);
  if (!loggedToday) {
    out.push({
      id: "checkin_today",
      priority: 35,
      category: "checkin",
      tone: "info",
      title: {
        en: "Today's check-in",
        zh: "今日记录",
      },
      body: {
        en: "A two-minute daily entry keeps every trend honest.",
        zh: "花两分钟记录今日 —— 所有趋势才准。",
      },
      cta: {
        href: "/daily/new",
        label: { en: "Start", zh: "开始" },
      },
      icon: "pulse",
      source: "trend",
    });
  }

  // ── Weight trend vs baseline (last 7 days mean) ──────────────────
  const last7Weights = recentDailies
    .slice(-7)
    .map((d) => d.weight_kg)
    .filter((w): w is number => typeof w === "number");
  const weight7Mean = avg(last7Weights);
  if (typeof baselineWeight === "number" && typeof weight7Mean === "number") {
    const pct = ((weight7Mean - baselineWeight) / baselineWeight) * 100;
    if (Math.abs(pct) < 2 && last7Weights.length >= 4) {
      out.push({
        id: "trend_weight_stable",
        priority: 80,
        category: "encouragement",
        tone: "positive",
        title: {
          en: "Weight is holding",
          zh: "体重稳定",
        },
        body: {
          en: `Within 2% of baseline over the past week (${weight7Mean.toFixed(1)} kg).`,
          zh: `过去一周内体重与基线相差 ≤ 2%（${weight7Mean.toFixed(1)} 公斤）。`,
        },
        icon: "anchor",
        source: "trend",
      });
    } else if (pct <= -3 && pct > -5) {
      out.push({
        id: "trend_weight_drifting",
        priority: 70,
        category: "trend",
        tone: "caution",
        title: {
          en: "Weight drifting down",
          zh: "体重缓慢下降",
        },
        body: {
          en: `Down ${Math.abs(pct).toFixed(1)}% vs baseline. Protein + PERT + smaller more frequent meals help most.`,
          zh: `相对基线下降 ${Math.abs(pct).toFixed(1)}%。增加蛋白、按时用胰酶，少量多餐最有效。`,
        },
        icon: "food",
        source: "trend",
      });
    }
  }

  // ── Protein adherence (7-day mean) ────────────────────────────────
  const baselineWeightKg =
    baselineWeight ??
    (last7Weights.length > 0
      ? last7Weights[last7Weights.length - 1] ?? null
      : null);
  if (typeof baselineWeightKg === "number") {
    const target = 1.2 * baselineWeightKg;
    const proteins = recentDailies
      .slice(-7)
      .map((d) => d.protein_grams)
      .filter((p): p is number => typeof p === "number");
    const proteinMean = avg(proteins);
    if (typeof proteinMean === "number" && proteins.length >= 4) {
      if (proteinMean < target * 0.75) {
        out.push({
          id: "trend_protein_low",
          priority: 75,
          category: "trend",
          tone: "caution",
          title: {
            en: "Protein running low",
            zh: "蛋白摄入偏低",
          },
          body: {
            en: `7-day average ${Math.round(proteinMean)} g/day, target ≈ ${Math.round(target)} g. Muscle protection depends on protein during chemo.`,
            zh: `过去 7 天平均 ${Math.round(proteinMean)} 克/天，目标约 ${Math.round(target)} 克。化疗期间保留肌肉取决于蛋白摄入。`,
          },
          icon: "food",
          source: "trend",
        });
      } else if (proteinMean >= target) {
        out.push({
          id: "trend_protein_on_target",
          priority: 85,
          category: "encouragement",
          tone: "positive",
          title: {
            en: "Protein on target",
            zh: "蛋白摄入达标",
          },
          body: {
            en: `${Math.round(proteinMean)} g/day this week — best thing for muscle preservation.`,
            zh: `本周平均 ${Math.round(proteinMean)} 克/天 —— 对保留肌肉最有效。`,
          },
          icon: "food",
          source: "trend",
        });
      }
    }
  }

  // ── Exercise consistency (walking + resistance in last 7 days) ────
  const last7 = recentDailies.slice(-7);
  const daysWithWalking = last7.filter(
    (d) => typeof d.walking_minutes === "number" && d.walking_minutes > 0,
  ).length;
  const resistanceDays = last7.filter((d) => d.resistance_training).length;
  if (last7.length >= 5) {
    if (daysWithWalking >= 5) {
      out.push({
        id: "trend_walking_consistent",
        priority: 85,
        category: "encouragement",
        tone: "positive",
        title: {
          en: "Walking five or more days",
          zh: "一周至少五天在走路",
        },
        body: {
          en: "Aerobic consistency is the strongest fatigue buffer during chemo.",
          zh: "有氧运动的规律性是化疗期间抵抗疲劳最有效的手段。",
        },
        icon: "walk",
        source: "trend",
      });
    }
    if (resistanceDays === 0 && last7.length === 7) {
      out.push({
        id: "trend_resistance_absent",
        priority: 72,
        category: "trend",
        tone: "info",
        title: {
          en: "Add a resistance session this week",
          zh: "本周加一次阻力训练",
        },
        body: {
          en: "No resistance training recorded. Even 10 minutes of band-work protects muscle.",
          zh: "过去一周没有阻力训练。即便 10 分钟弹力带也能保护肌肉。",
        },
        icon: "pulse",
        source: "trend",
      });
    }
  }

  // ── CA 19-9 trajectory ──────────────────────────────────────────
  const ca199 = recentLabs
    .map((l) => l.ca199)
    .filter((v): v is number => typeof v === "number");
  if (ca199.length >= 3) {
    const first = ca199[0]!;
    const last = ca199[ca199.length - 1]!;
    const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
    if (pct <= -20) {
      out.push({
        id: "trend_ca199_falling",
        priority: 80,
        category: "encouragement",
        tone: "positive",
        title: {
          en: "CA 19-9 trending down",
          zh: "CA 19-9 呈下降趋势",
        },
        body: {
          en: `Down ${Math.abs(pct)}% across your last ${ca199.length} readings — a positive response signal.`,
          zh: `最近 ${ca199.length} 次化验下降 ${Math.abs(pct)}% —— 治疗反应良好。`,
        },
        cta: {
          href: "/labs",
          label: { en: "See the chart", zh: "查看趋势图" },
        },
        icon: "flask",
        source: "trend",
      });
    } else if (pct >= 15 && ca199.length >= 3) {
      // Rising: zone-rule likely flagged separately, but still surface
      out.push({
        id: "trend_ca199_rising",
        priority: 50,
        category: "trend",
        tone: "caution",
        title: {
          en: "CA 19-9 rising",
          zh: "CA 19-9 呈上升趋势",
        },
        body: {
          en: `Up ${pct}% across your last ${ca199.length} readings. Worth raising at the next oncology visit.`,
          zh: `最近 ${ca199.length} 次上升 ${pct}%。下次就诊值得与主诊讨论。`,
        },
        cta: {
          href: "/labs",
          label: { en: "See the chart", zh: "查看趋势图" },
        },
        icon: "flask",
        source: "trend",
      });
    }
  }

  // ── Streak: logged all 7 days ─────────────────────────────────────
  if (recentDailies.length >= 7) {
    const last7Dates = recentDailies.slice(-7).map((d) => d.date);
    const uniq = new Set(last7Dates);
    if (uniq.size >= 7) {
      out.push({
        id: "trend_streak_7",
        priority: 88,
        category: "encouragement",
        tone: "positive",
        title: {
          en: "Seven days in a row",
          zh: "连续七日记录",
        },
        body: {
          en: "Daily logging is how every trend on this page becomes real. Thank you.",
          zh: "每天坚持记录，本页的每个趋势才有意义。谢谢你的用心。",
        },
        icon: "check",
        source: "trend",
      });
    }
  }

  // ── Backup nudge — fire when data sits on the device with no export ──
  // Suppress until there are at least 3 logged dailies of real data so we
  // don't nag fresh installs.
  if (settings && recentDailies.length >= 3) {
    const lastExport = settings.last_exported_at
      ? new Date(settings.last_exported_at).getTime()
      : null;
    const daysSince =
      lastExport !== null
        ? Math.floor((Date.parse(todayISO) - lastExport) / (24 * 3600 * 1000))
        : null;
    if (lastExport === null || (daysSince !== null && daysSince >= 7)) {
      out.push({
        id: "trend_backup_due",
        priority: 76,
        category: "trend",
        tone: "info",
        title: {
          en: "Back up your data",
          zh: "备份你的数据",
        },
        body: {
          en:
            lastExport === null
              ? "You haven't exported a backup yet. Everything lives on this device — one export keeps it safe."
              : `Last backup ${daysSince ?? "?"} days ago. Save a JSON bundle to encrypted storage so a lost device can't take the history with it.`,
          zh:
            lastExport === null
              ? "还没有导出过备份。所有数据都在本机 —— 导出一次就能存一份副本。"
              : `上次备份已过 ${daysSince ?? "?"} 天。建议导出 JSON 备份并存到加密位置，避免设备丢失带走全部记录。`,
        },
        cta: {
          href: "/reports",
          label: { en: "Export now", zh: "现在备份" },
        },
        icon: "anchor",
        source: "trend",
      });
    }
  }

  return out;
}
