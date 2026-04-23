"use client";

// Minimal client-side .docx → plain-text extractor. A .docx is a ZIP
// containing `word/document.xml`; we walk local-file-headers, inflate the
// single entry we need via the browser's native DecompressionStream, strip
// the XML tags, and return the visible text. No dependencies — keeps the
// client bundle small on routes that don't need it (this file is lazy-loaded
// only when the user picks a .docx in the smart-capture file picker).

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function docxToText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entry = findZipEntry(buf, "word/document.xml");
  if (!entry) {
    throw new Error(
      "Couldn't find word/document.xml inside this .docx — file may be corrupt or password-protected.",
    );
  }
  let xmlBytes: Uint8Array;
  if (entry.method === 0) {
    xmlBytes = buf.slice(entry.dataStart, entry.dataStart + entry.compressedSize);
  } else if (entry.method === 8) {
    xmlBytes = await inflateRaw(
      buf.slice(entry.dataStart, entry.dataStart + entry.compressedSize),
    );
  } else {
    throw new Error(`Unsupported compression method ${entry.method}`);
  }
  const xml = new TextDecoder("utf-8").decode(xmlBytes);
  return stripDocxXml(xml);
}

interface ZipEntry {
  method: number;
  compressedSize: number;
  dataStart: number;
}

// Scan the concatenated stream of local file headers (PK\x03\x04). We do not
// rely on the end-of-central-directory, which keeps this robust even on
// truncated / streaming .docx files.
function findZipEntry(buf: Uint8Array, target: string): ZipEntry | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let i = 0;
  while (i + 30 <= buf.length) {
    const sig = view.getUint32(i, true);
    if (sig !== 0x04034b50) break;
    const method = view.getUint16(i + 8, true);
    const compressedSize = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    const name = new TextDecoder("utf-8").decode(
      buf.subarray(i + 30, i + 30 + nameLen),
    );
    const dataStart = i + 30 + nameLen + extraLen;
    if (name === target) {
      return { method, compressedSize, dataStart };
    }
    i = dataStart + compressedSize;
  }
  return null;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "Your browser doesn't support DecompressionStream — can't unpack .docx.",
    );
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  const out = await new Response(stream).arrayBuffer();
  return new Uint8Array(out);
}

// OOXML word/document.xml stores runs of text inside <w:t> elements. Paragraph
// boundaries are <w:p>. Strip everything else and normalise whitespace so the
// output is suitable for pasting into the universal ingest LLM.
function stripDocxXml(xml: string): string {
  const paragraphs = xml
    .split(/<w:p[^>]*>/i)
    .map((p) => {
      const texts = Array.from(p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/gi)).map(
        (m) => decodeEntities(m[1] ?? ""),
      );
      return texts.join("");
    })
    .filter((p) => p.trim().length > 0);
  return paragraphs.join("\n\n").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
