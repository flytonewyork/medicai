"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCcw, WifiOff } from "lucide-react";
import { readSyncStatus, type SyncStatus } from "~/lib/sync/status";

function formatAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Small pill showing "synced / pending / offline" for the settings page.
// Polls every 2s — cheap because it's just reading localStorage + an
// in-memory counter. No network calls.
export function SyncStatusPill() {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    function tick() {
      setStatus(readSyncStatus());
    }
    tick();
    const timer = setInterval(tick, 2000);
    return () => clearInterval(timer);
  }, []);

  if (!status || !status.configured) return null;

  if (!status.online) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-paper-2/60 px-2.5 py-1 text-[11px] text-ink-600">
        <WifiOff className="h-3 w-3" aria-hidden />
        Offline
        {status.pending > 0 && (
          <span className="text-ink-400">· {status.pending} queued</span>
        )}
      </div>
    );
  }

  if (status.pending > 0) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-paper-2/60 px-2.5 py-1 text-[11px] text-ink-600">
        <RefreshCcw className="h-3 w-3 animate-spin" aria-hidden />
        Syncing {status.pending}…
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-paper-2/60 px-2.5 py-1 text-[11px] text-ink-600">
      <CheckCircle2 className="h-3 w-3 text-[var(--tide-2)]" aria-hidden />
      Synced
      {status.lastPulledAt && (
        <span className="text-ink-400">· {formatAgo(status.lastPulledAt)}</span>
      )}
    </div>
  );
}
