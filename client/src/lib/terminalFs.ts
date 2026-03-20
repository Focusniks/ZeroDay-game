/**
 * Virtual paths for the in-game FS (relative to user scope root).
 * Empty string = root. No leading slash in stored cwd; backend uses the same.
 */

export function segmentize(cwdRel: string): string[] {
  return cwdRel ? cwdRel.split("/").filter(Boolean) : [];
}

/** Join segments after applying . and .. */
export function normalizeSegments(segments: string[]): string[] {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return out;
}

/**
 * Resolve user path against cwd. Absolute if raw starts with /.
 * Returns normalized rel path (no leading/trailing slash), or "" for root.
 */
export function resolveVirtualPath(cwdRel: string, rawPath: string): string {
  const p = rawPath.replace(/\\/g, "/").trim();
  if (!p) return cwdRel;
  const fromRoot = p.startsWith("/");
  const tail = p.split("/").filter((s) => s.length > 0);
  const base = fromRoot ? [] : segmentize(cwdRel);
  return normalizeSegments([...base, ...tail]).join("/");
}

/** Display for prompt: ~ = root, else ~/Segment/Path */
export function formatPromptCwd(cwdRel: string): string {
  if (!cwdRel) return "~";
  return `~/${cwdRel}`;
}

/** pwd-style absolute virtual path */
export function formatPwd(cwdRel: string): string {
  if (!cwdRel) return "/";
  return `/${cwdRel}`;
}

export function splitPathCompletionArg(arg: string): { dirPart: string; namePrefix: string } {
  const norm = arg.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  if (idx === -1) return { dirPart: "", namePrefix: norm };
  return { dirPart: norm.slice(0, idx), namePrefix: norm.slice(idx + 1) };
}

export function formatHumanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

/** Minimal shell-like split (double quotes only). */
export function shellSplit(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && /\s/.test(c)) {
      if (cur.length) {
        out.push(cur);
        cur = "";
      }
      continue;
    }
    cur += c;
  }
  if (cur.length) out.push(cur);
  return out;
}
