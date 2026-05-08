import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { Shortlist } from "./types";

const DEFAULT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "shortlist.yaml",
);

export async function loadShortlist(path?: string): Promise<Shortlist> {
  const p = path ?? DEFAULT_PATH;
  if (!existsSync(p)) {
    throw new Error(`shortlist.yaml not found at ${p}`);
  }
  const raw = await readFile(p, "utf-8");
  const parsed = parseYaml(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`shortlist.yaml at ${p} did not parse to an array`);
  }
  return parsed as Shortlist;
}
