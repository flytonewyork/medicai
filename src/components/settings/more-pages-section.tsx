"use client";

import Link from "next/link";
import { useL } from "~/hooks/use-translate";
import { Card } from "~/components/ui/card";
import {
  Compass,
  FlaskConical,
  Sparkles,
  History as HistoryIcon,
  Route,
  ScanLine,
  Mic,
  ChevronRight,
} from "lucide-react";

// The patient nav was trimmed to seven daily-use destinations to match
// the single-channel doctrine in CLAUDE.md. The pages below are still
// reachable from where they're already deep-linked (BaselineNudge →
// /assessment, PillarTiles → /labs, daily wizard → /practices, FAB
// photo capture → /ingest, /diary memo cards → /memos/<id>), but a
// curious patient or carer who wants the index view of any of them
// shouldn't have to know the URL. This section keeps every secondary
// surface one tap away without putting it back in the persistent nav.
export function MorePagesSection() {
  const L = useL();
  const items = [
    {
      href: "/assessment",
      icon: Compass,
      label: L("Assessment", "评估"),
      hint: L(
        "Baselines and comprehensive checks",
        "基线与综合评估",
      ),
    },
    {
      href: "/labs",
      icon: FlaskConical,
      label: L("Labs", "化验"),
      hint: L("Trends and lab uploads", "趋势与化验录入"),
    },
    {
      href: "/practices",
      icon: Sparkles,
      label: L("Practices", "修习"),
      hint: L(
        "Qigong, meditation, breathing",
        "气功、冥想、呼吸",
      ),
    },
    {
      href: "/bridge",
      icon: Route,
      label: L("Bridge brief", "过渡策略"),
      hint: L(
        "Strategy and trial countdown",
        "策略与试验倒计时",
      ),
    },
    {
      href: "/history",
      icon: HistoryIcon,
      label: L("History", "历史"),
      hint: L(
        "Long-form trends and audit log",
        "长期趋势与历史记录",
      ),
    },
    {
      href: "/memos",
      icon: Mic,
      label: L("Voice memos", "语音记录"),
      hint: L(
        "Every recording, newest first",
        "全部录音，最新在前",
      ),
    },
    {
      href: "/ingest",
      icon: ScanLine,
      label: L("Documents", "导入文档"),
      hint: L(
        "Upload letters, lab reports, scans",
        "上传函件、化验单、影像",
      ),
    },
  ];

  return (
    <section className="space-y-3">
      <h2 className="eyebrow">{L("More pages", "更多页面")}</h2>
      <Card>
        <ul className="divide-y divide-ink-100">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink-100/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--tide-soft)] text-[var(--tide-2)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ink-900">
                      {item.label}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-500">
                      {item.hint}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
