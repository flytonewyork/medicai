"use client";

export interface OcrResult {
  text: string;
  confidence: number;
}

type ProgressFn = (phase: string, progress: number) => void;

export async function ocrImage(
  file: File | Blob,
  onProgress?: ProgressFn,
): Promise<OcrResult> {
  const { default: Tesseract } = await import("tesseract.js");
  const result = await Tesseract.recognize(file, "eng+chi_sim", {
    logger: (m) => {
      if (onProgress && "status" in m && "progress" in m) {
        onProgress(m.status, m.progress);
      }
    },
  });
  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
}

async function renderPdfPages(file: File | Blob): Promise<HTMLCanvasElement[]> {
  const pdfjs = await import("pdfjs-dist");
  // Worker is served from /public as a static asset (see /public/pdfjs/).
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  }
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

export async function ocrPdf(
  file: File,
  onProgress?: ProgressFn,
): Promise<OcrResult> {
  onProgress?.("rendering_pdf", 0);
  const canvases = await renderPdfPages(file);
  const texts: string[] = [];
  let totalConf = 0;
  for (let i = 0; i < canvases.length; i++) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const c = canvases[i];
      if (!c) {
        reject(new Error("canvas missing"));
        return;
      }
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("blob failed"))),
        "image/png",
      );
    });
    const r = await ocrImage(blob, (phase, p) => {
      onProgress?.(`page ${i + 1}/${canvases.length}: ${phase}`, p);
    });
    texts.push(r.text);
    totalConf += r.confidence;
  }
  return {
    text: texts.join("\n\n---\n\n"),
    confidence: canvases.length ? totalConf / canvases.length : 0,
  };
}

export async function ocrFile(
  file: File,
  onProgress?: ProgressFn,
): Promise<OcrResult> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return ocrPdf(file, onProgress);
  }
  return ocrImage(file, onProgress);
}
