"use client";

import { useRef, useState } from "react";
import { cn } from "~/lib/utils/cn";
import { Upload, FileText, Image as ImageIcon } from "lucide-react";
import { useLocale } from "~/hooks/use-translate";

export function UploadZone({
  onFile,
}: {
  onFile: (file: File) => void;
}) {
  const locale = useLocale();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handle(files: FileList | null) {
    const f = files?.[0];
    if (f) onFile(f);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        dragging
          ? "border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-900"
          : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      <Upload className="mx-auto mb-3 h-8 w-8 text-slate-400" />
      <div className="text-sm font-medium">
        {locale === "zh"
          ? "拖入或选择检查报告 / 影像 / 转诊信"
          : "Drop or choose a lab report, scan, or referral letter"}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {locale === "zh"
          ? "支持 PDF 和图片。处理全部在本机完成。"
          : "PDF or image. Processing stays on this device."}
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
        >
          <FileText className="h-4 w-4" />
          {locale === "zh" ? "选择文件" : "Choose file"}
        </button>
      </div>
      <div className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400">
        <ImageIcon className="h-3 w-3" /> PDF · JPG · PNG
      </div>
    </div>
  );
}
