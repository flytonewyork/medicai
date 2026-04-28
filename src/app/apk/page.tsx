import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { PageHeader } from "~/components/ui/page-header";
import manifest from "../../../public/apk/manifest.json";

// Inline because `~/hooks/use-translate` is a "use client" module — importing
// pickL from a server component would turn it into a client reference. The
// helper is one line; not worth a shared non-client i18n module yet.
function makeL(locale: "en" | "zh") {
  return (en: string, zh: string) => (locale === "zh" ? zh : en);
}

// Public Android-install landing page. The share URL for sideloading the
// TWA-wrapped app — anchor.thomashu.com/apk — points here. The page reads
// public/apk/manifest.json (updated by scripts/apk-publish.mjs after a CI
// build) and renders a download for the latest release plus a versioned
// archive. Bilingual via ?lang=zh because this URL is shared outside the
// signed-in app shell, where the locale store hasn't hydrated yet.

type Release = {
  version: string;
  filename: string;
  size_bytes: number;
  sha256: string;
  released_at: string;
  notes_en?: string;
  notes_zh?: string;
};

type Manifest = {
  latest: string | null;
  releases: Release[];
};

const data = manifest as Manifest;

export const metadata: Metadata = {
  title: "Install Anchor for Android",
  description:
    "Sideload the Anchor Android APK. Versioned releases of the Trusted Web Activity wrapper.",
  robots: { index: false, follow: false },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string, locale: "en" | "zh"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ApkPage({
  searchParams,
}: {
  searchParams?: { lang?: string };
}) {
  const locale: "en" | "zh" = searchParams?.lang === "zh" ? "zh" : "en";
  const L = makeL(locale);
  const latest = data.releases.find((r) => r.version === data.latest) ?? null;
  const archive = data.releases.filter((r) => r.version !== data.latest);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 pt-10 md:pt-16">
      <PageHeader
        eyebrow={L("Android install", "安卓安装")}
        title={L("Install Anchor on Android", "在安卓设备上安装 Anchor")}
        subtitle={L(
          "Sideload the latest signed APK. Updates flow through the same domain — your phone reloads the live app on each launch.",
          "下载并侧载已签名的 APK。每次启动时,手机将自动加载最新版本的应用。",
        )}
        action={
          <Link
            href={locale === "zh" ? "/apk" : "/apk?lang=zh"}
            className="text-xs text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
          >
            {L("中文", "English")}
          </Link>
        }
      />

      {latest ? (
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="eyebrow">{L("Latest", "最新版本")}</div>
              <h2 className="serif text-2xl text-ink-900">
                {L("Version", "版本")} {latest.version}
              </h2>
              <p className="text-sm text-ink-500">
                {formatDate(latest.released_at, locale)} ·{" "}
                {formatBytes(latest.size_bytes)}
              </p>
            </div>

            {(locale === "zh" ? latest.notes_zh : latest.notes_en) && (
              <p className="whitespace-pre-line text-sm text-ink-700">
                {locale === "zh" ? latest.notes_zh : latest.notes_en}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <a
                href={`/apk/${latest.filename}`}
                download
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-ink-900 px-6 text-base font-medium text-paper transition-colors hover:bg-ink-700"
              >
                {L("Download APK", "下载 APK")}
              </a>
              <a
                href="/apk/latest.apk"
                className="text-xs text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline"
              >
                {L("Stable share link: /apk/latest.apk", "稳定分享链接: /apk/latest.apk")}
              </a>
            </div>
          </CardContent>
          <CardFooter>
            <span className="break-all font-mono text-[11px]">
              SHA-256 {latest.sha256}
            </span>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <div className="space-y-2">
              <div className="eyebrow">{L("No build yet", "尚未发布")}</div>
              <p className="text-sm text-ink-500">
                {L(
                  "No APK has been published. Trigger the “APK build” workflow in GitHub Actions, or run scripts/apk-publish.mjs locally after bubblewrap build.",
                  "尚未发布 APK。请在 GitHub Actions 中运行 “APK build” 工作流,或在本地运行 scripts/apk-publish.mjs。",
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {archive.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow">{L("Previous releases", "历史版本")}</h2>
          <ul className="divide-y divide-ink-100/60 overflow-hidden rounded-md border border-ink-100/60 bg-paper-2">
            {archive.map((r) => (
              <li
                key={r.version}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900">
                    {L("Version", "版本")} {r.version}
                  </div>
                  <div className="text-xs text-ink-500">
                    {formatDate(r.released_at, locale)} ·{" "}
                    {formatBytes(r.size_bytes)}
                  </div>
                </div>
                <a
                  href={`/apk/${r.filename}`}
                  download
                  className="inline-flex h-9 items-center justify-center rounded-md border border-ink-200 bg-paper-2 px-3 text-xs text-ink-900 hover:border-ink-300"
                >
                  {L("Download", "下载")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2 text-xs text-ink-500">
        <h3 className="eyebrow text-ink-700">
          {L("Install on Android", "在安卓上安装")}
        </h3>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            {L(
              "Open this page on the phone. Tap Download APK.",
              "在手机上打开本页面,点击下载 APK。",
            )}
          </li>
          <li>
            {L(
              "If prompted, allow install from this browser (Settings → Install unknown apps).",
              "如有提示,允许此浏览器安装未知应用(设置 → 安装未知应用)。",
            )}
          </li>
          <li>
            {L(
              "Open the downloaded file and accept the install. Anchor opens full-screen with no browser bar.",
              "打开下载的文件并确认安装。打开后将进入全屏模式,无浏览器地址栏。",
            )}
          </li>
        </ol>
      </section>

      <section className="space-y-2 text-xs text-ink-500">
        <h3 className="eyebrow text-ink-700">
          {L("Updates are automatic", "自动更新")}
        </h3>
        <p>
          {L(
            "The APK is a thin shell — it loads the live anchor.thomashu.com app on every launch. Code fixes and new features ship the moment they're deployed; the patient just opens the app (or pulls to refresh) and sees the new version. No reinstall needed.",
            "APK 是一个轻量外壳,每次启动时都会加载实时的 anchor.thomashu.com 应用。代码修复和新功能在部署后立即生效,只需打开应用(或下拉刷新)即可看到新版本,无需重新安装。",
          )}
        </p>
        <p>
          {L(
            "You only need to install a new APK when the icon, name, package id, or signing key changes — never for app fixes.",
            "只有在图标、名称、应用 ID 或签名密钥更改时才需要安装新的 APK,日常修复无需重装。",
          )}
        </p>
        <BuildStamp locale={locale} />
      </section>
    </div>
  );
}

function BuildStamp({ locale }: { locale: "en" | "zh" }) {
  // Vercel injects the commit SHA at build time when the env var is enabled
  // in the project (Settings → Environment Variables → "Automatically expose
  // System Environment Variables"). When running locally without it the
  // stamp simply hides — no fallback noise.
  const sha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (!sha) return null;
  const short = sha.slice(0, 7);
  const label = locale === "zh" ? "当前版本" : "Live build";
  return (
    <p className="pt-1 font-mono text-[11px] text-ink-500">
      {label} {short}
      {env ? ` · ${env}` : ""}
    </p>
  );
}
