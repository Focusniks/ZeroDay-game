import {
  deleteFs,
  getFsDiskUsage,
  initGameFs,
  listFs,
  mkdirFs,
  moveFs,
  readBytesBase64Fs,
  readTextFs,
  writeBytesBase64Fs,
  writeTextFs,
  type FsEntry
} from "./gameFs";
import { formatHumanBytes, formatPwd, resolveVirtualPath } from "./terminalFs";

const T = (isRu: boolean, ru: string, en: string) => (isRu ? ru : en);

function parseRmArgs(args: string[]): { recursive: boolean; force: boolean; paths: string[] } {
  let recursive = false;
  let force = false;
  const paths: string[] = [];
  for (const a of args) {
    if (a.startsWith("-") && a.length > 1) {
      const body = a.slice(1);
      if (body === "rf" || body === "fr") {
        recursive = true;
        force = true;
        continue;
      }
      for (const ch of body) {
        if (ch === "r") recursive = true;
        if (ch === "f") force = true;
      }
      continue;
    }
    paths.push(a);
  }
  return { recursive, force, paths };
}

function parseLsArgs(args: string[]): { long: boolean; all: boolean; paths: string[] } {
  let long = false;
  let all = false;
  const paths: string[] = [];
  for (const w of args) {
    if (w.startsWith("-") && w.length > 1) {
      for (const c of w.slice(1)) {
        if (c === "l") long = true;
        if (c === "a") all = true;
      }
      continue;
    }
    paths.push(w);
  }
  if (!paths.length) paths.push(".");
  return { long, all, paths };
}

function parseTreeArgs(args: string[]): { maxDepth: number; path: string } {
  let maxDepth = 3;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "-L" && args[i + 1]) {
      const n = Number.parseInt(args[i + 1]!, 10);
      if (Number.isFinite(n)) maxDepth = Math.min(8, Math.max(1, n));
      i++;
      continue;
    }
    rest.push(a);
  }
  const path = rest[0] ?? ".";
  return { maxDepth, path };
}

function filterHidden(name: string, all: boolean): boolean {
  if (all) return true;
  return !name.startsWith(".");
}

function formatEntryLine(e: FsEntry, long: boolean): string {
  if (!long) return e.name;
  const kind = e.kind === "dir" ? "d" : "-";
  const sz = e.kind === "dir" ? "-" : String(e.size);
  return `${kind}  ${sz.padStart(10)}  ${e.name}`;
}

async function listOnePath(cwdRel: string, pathArg: string, long: boolean, all: boolean, isRu: boolean): Promise<string[]> {
  const target = resolveVirtualPath(cwdRel, pathArg);
  let items: FsEntry[];
  try {
    items = await listFs(target);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return [T(isRu, `ls: не удалось открыть: ${msg}`, `ls: cannot access: ${msg}`)];
  }
  const filtered = items.filter((e) => filterHidden(e.name, all));
  if (!filtered.length) {
    return long ? [] : [T(isRu, "(пусто)", "(empty)")];
  }
  return filtered.map((e) => formatEntryLine(e, long));
}

async function buildTree(
  relPath: string,
  prefix: string,
  depth: number,
  maxDepth: number
): Promise<string[]> {
  if (depth > maxDepth) return [];
  let items: FsEntry[];
  try {
    items = await listFs(relPath);
  } catch {
    return [];
  }
  const dirs = items.filter((i) => i.kind === "dir").sort((a, b) => a.name.localeCompare(b.name));
  const files = items.filter((i) => i.kind === "file").sort((a, b) => a.name.localeCompare(b.name));
  const all = [...dirs, ...files];
  const lines: string[] = [];
  for (let i = 0; i < all.length; i++) {
    const last = i === all.length - 1;
    const branch = last ? "└── " : "├── ";
    const entry = all[i]!;
    lines.push(`${prefix}${branch}${entry.name}`);
    if (entry.kind === "dir") {
      const nextPrefix = prefix + (last ? "    " : "│   ");
      lines.push(...(await buildTree(entry.relPath, nextPrefix, depth + 1, maxDepth)));
    }
  }
  return lines;
}

/**
 * Execute virtual-fs shell commands. Returns null if `cmd` is not handled here.
 */
export async function execTerminalFsLine(
  argv: string[],
  cwdRel: string,
  isRu: boolean
): Promise<{ lines: string[]; newCwd?: string } | null> {
  const cmd = argv[0]?.toLowerCase() ?? "";
  const args = argv.slice(1);

  const handled = new Set([
    "pwd",
    "cd",
    "ls",
    "cat",
    "mkdir",
    "rmdir",
    "rm",
    "mv",
    "cp",
    "touch",
    "tree",
    "df"
  ]);
  if (!handled.has(cmd)) return null;

  await initGameFs();

  try {
    switch (cmd) {
      case "pwd": {
        return { lines: [formatPwd(cwdRel)] };
      }
      case "cd": {
        const raw = args.join(" ").trim();
        if (!raw) {
          return { lines: [], newCwd: "" };
        }
        const target = resolveVirtualPath(cwdRel, raw);
        try {
          await listFs(target);
          return { lines: [], newCwd: target };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { lines: [T(isRu, `cd: ${msg}`, `cd: ${msg}`)] };
        }
      }
      case "ls": {
        const { long, all, paths } = parseLsArgs(args);
        const out: string[] = [];
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i]!;
          const resolved = resolveVirtualPath(cwdRel, p);
          if (paths.length > 1) {
            out.push(`${formatPwd(resolved)}:`);
          }
          out.push(...(await listOnePath(cwdRel, p, long, all, isRu)));
          if (i < paths.length - 1) out.push("");
        }
        return { lines: out };
      }
      case "cat": {
        if (!args.length) {
          return { lines: [T(isRu, "cat: укажите файл", "cat: missing file operand")] };
        }
        const out: string[] = [];
        for (const arg of args) {
          const rel = resolveVirtualPath(cwdRel, arg);
          try {
            const text = await readTextFs(rel);
            out.push(text);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            out.push(T(isRu, `cat: ${arg}: ${msg}`, `cat: ${arg}: ${msg}`));
          }
        }
        return { lines: out };
      }
      case "mkdir": {
        const paths = args.filter((a) => a !== "-p" && a !== "--parents");
        if (!paths.length) {
          return { lines: [T(isRu, "mkdir: укажите имя", "mkdir: missing operand")] };
        }
        const out: string[] = [];
        for (const arg of paths) {
          const rel = resolveVirtualPath(cwdRel, arg);
          try {
            await mkdirFs(rel);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            out.push(T(isRu, `mkdir: ${arg}: ${msg}`, `mkdir: ${arg}: ${msg}`));
          }
        }
        return { lines: out };
      }
      case "rmdir": {
        if (!args.length) {
          return { lines: [T(isRu, "rmdir: укажите каталог", "rmdir: missing operand")] };
        }
        const out: string[] = [];
        for (const arg of args) {
          const rel = resolveVirtualPath(cwdRel, arg);
          try {
            const items = await listFs(rel);
            if (items.length > 0) {
              out.push(
                T(isRu, `rmdir: каталог не пуст: ${arg}`, `rmdir: directory not empty: ${arg}`)
              );
              continue;
            }
            await deleteFs(rel);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            out.push(T(isRu, `rmdir: ${arg}: ${msg}`, `rmdir: ${arg}: ${msg}`));
          }
        }
        return { lines: out };
      }
      case "rm": {
        const { recursive, force, paths } = parseRmArgs(args);
        if (!paths.length) {
          return { lines: [T(isRu, "rm: укажите путь", "rm: missing operand")] };
        }
        const out: string[] = [];
        for (const arg of paths) {
          const rel = resolveVirtualPath(cwdRel, arg);
          try {
            let isDir = false;
            try {
              await listFs(rel);
              isDir = true;
            } catch {
              isDir = false;
            }
            if (isDir && !recursive) {
              out.push(
                T(
                  isRu,
                  `rm: ${arg}: это каталог (используйте rm -r)`,
                  `rm: ${arg}: is a directory (use rm -r)`
                )
              );
              continue;
            }
            await deleteFs(rel);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!force) out.push(T(isRu, `rm: ${arg}: ${msg}`, `rm: ${arg}: ${msg}`));
          }
        }
        return { lines: out };
      }
      case "mv": {
        if (args.length < 2) {
          return { lines: [T(isRu, "mv: нужны источник и назначение", "mv: missing file operand")] };
        }
        const dstRaw = args[args.length - 1]!;
        const srcs = args.slice(0, -1);
        if (srcs.length > 1) {
          return {
            lines: [
              T(
                isRu,
                "mv: несколько файлов → только в каталог (пока не поддерживается)",
                "mv: multiple sources not supported yet"
              )
            ]
          };
        }
        const src = resolveVirtualPath(cwdRel, srcs[0]!);
        const dst = resolveVirtualPath(cwdRel, dstRaw);
        try {
          await moveFs(src, dst);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { lines: [T(isRu, `mv: ${msg}`, `mv: ${msg}`)] };
        }
        return { lines: [] };
      }
      case "cp": {
        if (args.length > 0 && (args[0] === "-r" || args[0] === "-R")) {
          return {
            lines: [
              T(
                isRu,
                "cp -r: копирование каталогов пока не поддерживается (только файлы)",
                "cp -r: directory copy not supported (files only)"
              )
            ]
          };
        }
        if (args.length !== 2) {
          return { lines: [T(isRu, "cp: нужны источник и файл назначения", "cp: missing operand")] };
        }
        const src = resolveVirtualPath(cwdRel, args[0]!);
        const dst = resolveVirtualPath(cwdRel, args[1]!);
        try {
          await listFs(src);
          return {
            lines: [
              T(
                isRu,
                "cp: источник — каталог (копирование каталогов не поддерживается)",
                "cp: source is a directory"
              )
            ]
          };
        } catch {
          /* file path: list fails */
        }
        try {
          const b64 = await readBytesBase64Fs(src);
          await writeBytesBase64Fs(dst, b64);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { lines: [T(isRu, `cp: ${msg}`, `cp: ${msg}`)] };
        }
        return { lines: [] };
      }
      case "touch": {
        if (!args.length) {
          return { lines: [T(isRu, "touch: укажите файл", "touch: missing operand")] };
        }
        const out: string[] = [];
        for (const arg of args) {
          const rel = resolveVirtualPath(cwdRel, arg);
          try {
            await readTextFs(rel);
          } catch {
            try {
              await writeTextFs(rel, "");
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              out.push(T(isRu, `touch: ${arg}: ${msg}`, `touch: ${arg}: ${msg}`));
            }
          }
        }
        return { lines: out };
      }
      case "tree": {
        const { maxDepth, path } = parseTreeArgs(args);
        const root = resolveVirtualPath(cwdRel, path);
        const header = formatPwd(root);
        const body = await buildTree(root, "", 1, maxDepth);
        return { lines: [header, ...body] };
      }
      case "df": {
        const u = await getFsDiskUsage();
        const cap = formatHumanBytes(u.capacityBytes);
        const used = formatHumanBytes(u.usedBytes);
        const free = formatHumanBytes(u.freeBytes);
        return {
          lines: [
            T(isRu, "Виртуальный диск ZeroDay:", "ZeroDay virtual disk:"),
            `  ${T(isRu, "Всего", "Size")}  ${cap}  ${T(isRu, "Занято", "Used")}  ${used}  ${T(isRu, "Свободно", "Avail")}  ${free}`
          ]
        };
      }
      default:
        return null;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { lines: [msg] };
  }
}
