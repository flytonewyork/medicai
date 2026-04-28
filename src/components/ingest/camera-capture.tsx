"use client";

import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import { useLocale } from "~/hooks/use-translate";

// On iOS/Android, omitting `capture` causes the native picker to offer
// camera + photo library + files in one sheet. Forcing capture would
// shut out gallery/file uploads entirely.
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
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            onPhoto(f);
            e.target.value = "";
          }
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-700"
      >
        <ImagePlus className="h-4 w-4" />
        {label ?? (locale === "zh" ? "添加照片" : "Add photo")}
      </button>
    </>
  );
}
