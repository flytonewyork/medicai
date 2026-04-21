"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";
import { useLocale } from "~/hooks/use-translate";

export function CameraCapture({
  onPhoto,
  accept = "image/*",
  label,
}: {
  onPhoto: (file: File) => void;
  accept?: string;
  label?: string;
}) {
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onPhoto(f);
            // reset so the same photo can be selected again
            e.target.value = "";
          }
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-700"
      >
        <Camera className="h-4 w-4" />
        {label ?? (locale === "zh" ? "拍照" : "Take photo")}
      </button>
    </>
  );
}
