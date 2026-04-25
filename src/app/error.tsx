"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

// Top-level error boundary. Next's app router calls this when any
// client component in the tree throws during render. Without it, a
// crash leaves the user staring at a blank screen with no path
// forward — bad on a phone, especially when the patient is the
// person looking at the broken view.
//
// Strategy:
//   - Render in the patient's expected paper/ink palette (no system
//     "Error" alert). The page still feels like Anchor.
//   - Offer two recovery paths: Try again (calls Next's reset) and
//     Home. Either should unstick the user.
//   - Log to console so Vercel / Sentry-equivalent picks it up.
//   - Bilingual: we don't know the locale here (Zustand state may
//     not have hydrated past the boundary), so we render side-by-side
//     EN + ZH copy. Better than gambling on locale and showing the
//     wrong language to a panicked user.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[anchor] unhandled error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md p-6 pt-16">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
              style={{
                background: "var(--warn-soft)",
                color: "var(--warn)",
              }}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-ink-900">
                Something went wrong
                <span className="ml-2 text-ink-500">出问题了</span>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-500">
                Anchor hit a snag rendering this page. Your data is safe.
                <br />
                <span className="text-ink-500/80">
                  Anchor 在显示这个页面时遇到了问题，您的数据是安全的。
                </span>
              </p>
            </div>
          </div>

          {error.digest && (
            <div className="mono rounded-md bg-paper px-2 py-1.5 text-[10.5px] text-ink-500">
              ref · {error.digest}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Try again · 重试
            </Button>
            <Link href="/">
              <Button variant="secondary">
                <Home className="h-4 w-4" />
                Home · 主页
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
