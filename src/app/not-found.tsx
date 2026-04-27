import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

// 404 fallback. Without this, Next renders the framework-default page
// which doesn't carry the Anchor palette and breaks the visual
// continuity for someone who landed on a stale link (e.g. an older
// invite email or a mistyped URL). Bilingual side-by-side because we
// don't have access to the user's locale on a not-found render.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md p-6 pt-16">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-700">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-ink-900">
                Page not found
                <span className="ml-2 text-ink-500">页面未找到</span>
              </div>
              <p className="mt-1 text-[12.5px] text-ink-500">
                The link may be old or mistyped.
                <br />
                <span className="text-ink-500/80">
                  链接可能已过期或输错了。
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/">
              <Button>
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
