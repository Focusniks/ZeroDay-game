import { useState, useEffect, useCallback, useRef } from "react";
import type { GameLanguage } from "../../lib/gameConfig";
import { useWindowFrame } from "../../desktop/modules/WindowFrameModule";
import { playWindowClose, playWindowMaximize, playWindowMinimize, playWindowRestore } from "../../lib/osSounds";
import { themeIconUrl } from "../../lib/themeIcons";
import type { FsEntry } from "../../lib/gameFs";
import { initGameFs, listFs } from "../../lib/gameFs";

type Props = {
  lang: GameLanguage;
  minimized?: boolean;
  initialRelPath?: string;
  onMinimize: () => void;
  onClose: () => void;
  onRunScript: (scriptPath: string, code: string) => void;
  onFocus?: () => void;
  zIndex?: number;
};

type TerminalLine = {
  type: "input" | "output" | "error" | "success";
  text: string;
  id: string;
};

type FileTreeItem = {
  name: string;
  path: string;
  type: "file" | "folder";
};

export function CodeEditorApp({
  lang,
  minimized = false,
  initialRelPath,
  onMinimize,
  onClose,
  onRunScript,
  onFocus,
  zIndex
}: Props) {
  const [activeFile, setActiveFile] = useState<string | null>(initialRelPath ?? null);
  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);

  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);
  const [selectedPath, setSelectedPath] = useState("Scripts");

  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  // Terminal state
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [terminalCwd, setTerminalCwd] = useState("Scripts");
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const terminalResizerRef = useRef<HTMLDivElement | null>(null);
  const terminalInputRef = useRef<HTMLInputElement | null>(null);
  const isResizingTerminal = useRef(false);

  // Available drives
  const availableDrives = [
    { name: "C:", label: lang === "ru" ? "Система" : "System", path: "" },
    { name: "D:", label: lang === "ru" ? "Данные" : "Data", path: "Documents" },
    { name: "E:", label: lang === "ru" ? "Съёмный" : "Removable", path: "Downloads" }
  ];

  const title = lang === "ru" ? "HackScript Editor" : "HackScript Editor";
  const isDirty = activeFile && code !== savedCode;

  const { rect, maximized, startDrag, startResize, toggleMaximize } = useWindowFrame({
    defaultSize: { w: 1000, h: 700 },
    minSize: { w: 400, h: 300 }
  });

  const maximizedRef = useRef(maximized);
  useEffect(() => {
    maximizedRef.current = maximized;
  }, [maximized]);

  const [maximizedTick, setMaximizedTick] = useState(0);
  const [resizingTick, setResizingTick] = useState(0);

  const onToggleMaximize = useCallback(() => {
    if (maximizedRef.current) playWindowRestore();
    else playWindowMaximize();
    toggleMaximize();
    setMaximizedTick((v) => v + 1);
  }, [toggleMaximize]);

  // Syntax highlighting
  const highlightSyntax = useCallback((source: string) => {
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    return source.split("\n").map((line) => {
      let result = "";
      let i = 0;

      while (i < line.length) {
        if (line[i] === "#") {
          result += `<span class="text-emerald-600/70">${escapeHtml(line.slice(i))}</span>`;
          break;
        }

        if (line[i] === '"' || line[i] === "'") {
          const quote = line[i];
          let j = i + 1;
          while (j < line.length && line[j] !== quote) {
            if (line[j] === "\\") j++;
            j++;
          }
          j++;
          result += `<span class="text-amber-400">${escapeHtml(line.slice(i, j))}</span>`;
          i = j;
          continue;
        }

        if (/[0-9]/.test(line[i]!)) {
          let j = i;
          while (j < line.length && /[0-9.]/.test(line[j]!)) j++;
          result += `<span class="text-cyan-400">${escapeHtml(line.slice(i, j))}</span>`;
          i = j;
          continue;
        }

        if (/[a-zA-Z_]/.test(line[i]!)) {
          let j = i;
          while (j < line.length && /[a-zA-Z0-9_]/.test(line[j]!)) j++;
          const word = line.slice(i, j);
          
          const keywords = ["print", "for", "in", "range", "if", "else", "elif", "while", "def", "return", "true", "false"];
          const builtins = ["len", "str", "int", "float", "input", "sleep", "hack", "scan", "connect"];
          
          if (keywords.includes(word)) {
            result += `<span class="text-purple-400 font-semibold">${escapeHtml(word)}</span>`;
          } else if (builtins.includes(word)) {
            result += `<span class="text-cyan-300">${escapeHtml(word)}</span>`;
          } else {
            result += escapeHtml(word);
          }
          i = j;
          continue;
        }

        result += `<span class="text-slate-400">${escapeHtml(line[i]!)}</span>`;
        i++;
      }

      return result || " ";
    }).join("\n");
  }, []);

  const highlightedCode = highlightSyntax(code);

  // Load file tree
  const loadFileTree = useCallback(async (path: string) => {
    try {
      await initGameFs();
      const entries = await listFs(path);
      const items: FileTreeItem[] = entries
        .sort((a, b) => {
          if (a.kind === b.kind) return a.name.localeCompare(b.name);
          return a.kind === "dir" ? -1 : 1;
        })
        .map((e) => ({
          name: e.name,
          path: e.relPath,
          type: e.kind === "dir" ? "folder" : "file"
        }));
      setFileTree(items);
    } catch (err) {
      console.error("Failed to load file tree:", err);
      setFileTree([]);
    }
  }, []);

  useEffect(() => {
    void loadFileTree(selectedPath);
  }, [selectedPath, loadFileTree]);

  // Load file content
  useEffect(() => {
    if (!activeFile) {
      setCode("");
      setSavedCode("");
      return;
    }
    import("../../lib/gameFs").then(({ readTextFs }) => {
      readTextFs(activeFile).then(setCode).catch(() => setCode(""));
    });
  }, [activeFile]);

  // Sync scroll
  const handleScroll = useCallback(() => {
    if (editorRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = editorRef.current.scrollTop;
      highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
    }
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines]);

  // Focus terminal input
  useEffect(() => {
    if (showTerminal && terminalInputRef.current) {
      terminalInputRef.current.focus();
    }
  }, [showTerminal]);

  // Terminal resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingTerminal.current) return;
      const resizer = terminalResizerRef.current;
      if (!resizer) return;
      const rect = resizer.getBoundingClientRect();
      const delta = rect.bottom - e.clientY;
      setTerminalHeight((prev) => Math.max(100, Math.min(400, prev + delta)));
    };

    const handleMouseUp = () => {
      isResizingTerminal.current = false;
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const startTerminalResize = (e: React.PointerEvent) => {
    e.preventDefault();
    isResizingTerminal.current = true;
    document.body.style.cursor = "ns-resize";
  };

  // Save file
  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    try {
      const { writeTextFs } = await import("../../lib/gameFs");
      await writeTextFs(activeFile, code);
      setSavedCode(code);
    } catch (err) {
      console.error("Failed to save:", err);
    }
  }, [activeFile, code]);

  // Run script with output
  const handleRun = useCallback(() => {
    if (!activeFile) return;
    
    const timestamp = Date.now();
    setTerminalLines((prev) => [
      ...prev,
      { type: "input", text: `$ hackrun ${activeFile}`, id: `line-${timestamp}-1` },
      { type: "output", text: `Running ${activeFile}...`, id: `line-${timestamp}-2` }
    ]);
    
    // Execute and show output immediately
    const lines = code.split("\n");
    const output: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const printMatch = trimmed.match(/^print\s+(.+)$/);
      if (printMatch) {
        const content = printMatch[1].replace(/^["']|["']$/g, "");
        output.push(content);
      }
      
      const forMatch = trimmed.match(/^for\s+(\w+)\s+in\s+range\((\d+),?\s*(\d*)\)$/);
      if (forMatch) {
        const varName = forMatch[1];
        const start = parseInt(forMatch[2], 10);
        const end = parseInt(forMatch[3] || forMatch[2], 10);
        for (let i = start; i < end; i++) {
          output.push(`${varName} = ${i}`);
        }
      }
    }
    
    // Show output lines
    setTimeout(() => {
      const newLines: TerminalLine[] = [];
      if (output.length > 0) {
        output.forEach((line, i) => {
          newLines.push({ type: "output", text: line, id: `output-${timestamp}-${i}` });
        });
      }
      newLines.push({ type: "success", text: `✓ Script executed successfully.`, id: `success-${timestamp}` });
      setTerminalLines((prev) => [...prev, ...newLines]);
    }, 100);
  }, [activeFile, code]);

  // Terminal command handler
  const handleTerminalSubmit = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    
    const timestamp = Date.now();
    const id = `cmd-${timestamp}`;
    
    setTerminalLines((prev) => [...prev, { type: "input", text: `$ ${trimmed}`, id }]);
    setTerminalHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(null);
    setTerminalInput("");
    
    const parts = trimmed.split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);
    
    if (command === "clear" || command === "cls") {
      setTerminalLines([]);
      return;
    }
    
    if (command === "help") {
      setTerminalLines((prev) => [...prev, { 
        type: "output", 
        text: "Commands: hackrun, clear, cls, help, ls, pwd, cd, df\nUse 'cd <path>' to navigate, 'cd ..' to go back", 
        id: `help-${timestamp}` 
      }]);
      return;
    }
    
    if (command === "pwd") {
      setTerminalLines((prev) => [...prev, { type: "output", text: terminalCwd, id: `pwd-${timestamp}` }]);
      return;
    }
    
    if (command === "ls") {
      const targetPath = args[0] || terminalCwd;
      setTerminalLines((prev) => [...prev, { 
        type: "output", 
        text: `Listing: ${targetPath}\n${fileTree.map((f) => `${f.type === "folder" ? "📁" : "📄"} ${f.name}`).join("\n")}`, 
        id: `ls-${timestamp}` 
      }]);
      return;
    }
    
    if (command === "cd") {
      const target = args[0];
      if (!target) {
        setTerminalLines((prev) => [...prev, { type: "error", text: "Usage: cd <path>", id: `cd-err-${timestamp}` }]);
        return;
      }
      
      if (target === "..") {
        const parts = terminalCwd.split("/");
        if (parts.length > 1) {
          parts.pop();
          setTerminalCwd(parts.join("/") || "Scripts");
        }
        return;
      }
      
      if (target === "/" || target === "~") {
        setTerminalCwd("Scripts");
        return;
      }
      
      const driveMatch = target.match(/^([A-Za-z]):/);
      if (driveMatch) {
        const driveName = driveMatch[1].toUpperCase() + ":";
        const drive = availableDrives.find((d) => d.name === driveName);
        if (drive) {
          setTerminalCwd(drive.path || "");
          setTerminalLines((prev) => [...prev, { 
            type: "output", 
            text: `Switched to ${driveName} (${drive.label})`, 
            id: `cd-drive-${timestamp}` 
          }]);
          return;
        }
      }
      
      const newCwd = target.startsWith("/") ? target.slice(1) : `${terminalCwd}/${target}`;
      const dirExists = fileTree.some((f) => f.type === "folder" && f.name === target);
      
      if (dirExists || ["Documents", "Downloads", "Scripts", "Pictures", "Music", "Videos"].includes(target)) {
        setTerminalCwd(newCwd);
        void loadFileTree(newCwd);
        return;
      }
      
      setTerminalLines((prev) => [...prev, { 
        type: "error", 
        text: `cd: no such directory: ${target}`, 
        id: `cd-err2-${timestamp}` 
      }]);
      return;
    }
    
    if (command === "df") {
      const diskInfo = availableDrives.map((d) => `${d.name}  ${d.label.padEnd(12)}  /${d.path || "root"}`).join("\n");
      setTerminalLines((prev) => [...prev, { type: "output", text: `Filesystems:\n${diskInfo}`, id: `df-${timestamp}` }]);
      return;
    }
    
    if (command === "hackrun") {
      const scriptPath = args.join(" ");
      if (!scriptPath) {
        setTerminalLines((prev) => [...prev, { type: "error", text: "Usage: hackrun <file.hack>", id: `hackrun-err-${timestamp}` }]);
        return;
      }
      setTerminalLines((prev) => [...prev, { type: "output", text: `Running ${scriptPath}...`, id: `hackrun-${timestamp}` }]);
      
      // Simulate script execution with output
      setTimeout(() => {
        setTerminalLines((prev) => [...prev, { type: "success", text: `✓ Script executed successfully.`, id: `hackrun-ok-${timestamp}` }]);
      }, 300);
      return;
    }
    
    setTerminalLines((prev) => [...prev, { type: "error", text: `Command not found: ${command}`, id: `err-${timestamp}` }]);
  }, [terminalCwd, fileTree, availableDrives, loadFileTree]);

  // Terminal key handler
  const handleTerminalKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTerminalSubmit(terminalInput);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (terminalHistory.length === 0) return;
      const newIdx = historyIdx === null ? terminalHistory.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(newIdx);
      setTerminalInput(terminalHistory[newIdx] || "");
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === null) return;
      const newIdx = historyIdx + 1;
      if (newIdx >= terminalHistory.length) {
        setHistoryIdx(null);
        setTerminalInput("");
      } else {
        setHistoryIdx(newIdx);
        setTerminalInput(terminalHistory[newIdx] || "");
      }
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const input = terminalInput.trim();
      if (!input) return;
      
      const parts = input.split(/\s+/);
      const command = parts[0]?.toLowerCase();
      const arg = parts[1] || "";
      const timestamp = Date.now();
      
      // Completing command name
      if (parts.length === 1) {
        const commands = ["hackrun", "clear", "cls", "help", "ls", "pwd", "cd", "df"];
        const matches = commands.filter((c) => c.startsWith(input.toLowerCase()));
        if (matches.length === 1) {
          setTerminalInput(matches[0]);
        } else if (matches.length > 1) {
          setTerminalLines((prev) => [...prev, { type: "output", text: matches.join("  "), id: `tab-${timestamp}` }]);
        }
        return;
      }
      
      // Completing cd argument (directories/drives)
      if (command === "cd" && arg) {
        const drives = availableDrives.map((d) => d.name);
        const dirs = ["..", "/", "~", "Documents", "Downloads", "Scripts", "Pictures", "Music", "Videos"];
        const candidates = [...drives, ...dirs];
        const matches = candidates.filter((c) => c.toLowerCase().startsWith(arg.toLowerCase()));
        if (matches.length === 1) {
          setTerminalInput(`cd ${matches[0]}`);
        } else if (matches.length > 1) {
          setTerminalLines((prev) => [...prev, { type: "output", text: matches.join("  "), id: `tab-cd-${timestamp}` }]);
        }
        return;
      }
      
      // Completing hackrun argument (.hack files)
      if (command === "hackrun" && arg) {
        const hackFiles = fileTree.filter((f) => f.name.endsWith(".hack")).map((f) => f.name);
        const matches = hackFiles.filter((f) => f.toLowerCase().startsWith(arg.toLowerCase()));
        if (matches.length === 1) {
          setTerminalInput(`hackrun ${matches[0]}`);
        } else if (matches.length > 1) {
          setTerminalLines((prev) => [...prev, { type: "output", text: matches.join("  "), id: `tab-hack-${timestamp}` }]);
        }
        return;
      }
    }
  }, [terminalInput, terminalHistory, historyIdx, handleTerminalSubmit, availableDrives, fileTree]);

  // New file
  const handleNewFile = useCallback(async () => {
    if (!newFileName.trim()) return;
    const fullPath = selectedPath ? `${selectedPath}/${newFileName}` : newFileName;
    try {
      const { writeTextFs } = await import("../../lib/gameFs");
      await writeTextFs(fullPath, "");
      await loadFileTree(selectedPath);
      setActiveFile(fullPath);
      setCode("");
      setSavedCode("");
      setShowNewFileInput(false);
      setNewFileName("");
    } catch (err) {
      console.error("Failed to create file:", err);
    }
  }, [newFileName, selectedPath, loadFileTree]);

  // File click handler
  const handleFileClick = useCallback((item: FileTreeItem) => {
    if (item.type === "folder") {
      setSelectedPath(item.path);
    } else if (item.name.endsWith(".hack")) {
      setActiveFile(item.path);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
      }

      if (e.key === "F5" || (mod && e.key === "Enter")) {
        e.preventDefault();
        handleRun();
      }

      if (e.key === "Escape") {
        setShowNewFileInput(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleRun]);

  const lineNumbers = code.split("\n").length;

  return (
    <div
      className={`settings-window absolute z-[75] pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl ${
        minimized ? "pointer-events-none opacity-0 scale-95" : ""
      }`}
      onMouseDown={onFocus}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        ...(zIndex !== undefined ? { zIndex } : {})
      }}
      role="dialog"
      aria-label={title}
    >
      {/* Title bar */}
      <div
        className="flex cursor-grab items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#0f766e]/40 via-[#1e1b4b]/30 to-[#0c0a09] px-3 py-2"
        onPointerDown={(e) => startDrag(e, e.currentTarget)}
      >
        <div className="flex items-center gap-2">
          <button type="button" className="h-3 w-3 rounded-full bg-[#ff5f57] hover:opacity-90" onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onClick={() => { playWindowClose(); onClose(); }} />
          <button type="button" className="h-3 w-3 rounded-full bg-[#febc2e] hover:opacity-90" onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onClick={() => { playWindowMinimize(); onMinimize(); }} />
          <button type="button" className="h-3 w-3 rounded-full bg-[#28c840] hover:opacity-90" onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onClick={onToggleMaximize} />
        </div>
        <div className="flex items-center gap-2">
          <img src={themeIconUrl("scripts.svg")} alt="" className="w-4 h-4" />
          <span className="text-xs text-slate-300">{activeFile ? `${activeFile}${isDirty ? " ●" : ""}` : title}</span>
        </div>
        <div className="w-20" />
      </div>

      {/* Resize handles */}
      {!maximized && (
        <>
          <div className="resize-handle resize-handle--n" onPointerDown={(e) => { onFocus?.(); startResize(e, "n"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--s" onPointerDown={(e) => { onFocus?.(); startResize(e, "s"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--e" onPointerDown={(e) => { onFocus?.(); startResize(e, "e"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--w" onPointerDown={(e) => { onFocus?.(); startResize(e, "w"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--nw" onPointerDown={(e) => { onFocus?.(); startResize(e, "nw"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--ne" onPointerDown={(e) => { onFocus?.(); startResize(e, "ne"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--sw" onPointerDown={(e) => { onFocus?.(); startResize(e, "sw"); setResizingTick((v) => v + 1); }} />
          <div className="resize-handle resize-handle--se" onPointerDown={(e) => { onFocus?.(); startResize(e, "se"); setResizingTick((v) => v + 1); }} />
        </>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#1a1f29] px-3 py-1.5">
        <button type="button" onClick={handleSave} disabled={!activeFile || !isDirty} className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          {lang === "ru" ? "Сохранить" : "Save"}
        </button>
        <button type="button" onClick={handleRun} disabled={!activeFile} className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-emerald-400 hover:bg-white/5 disabled:opacity-40">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          {lang === "ru" ? "Запуск" : "Run"}
        </button>
        <div className="h-4 w-px bg-white/10" />
        <button type="button" onClick={() => setShowNewFileInput(true)} className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {lang === "ru" ? "Новый" : "New"}
        </button>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <div className="w-56 border-r border-white/10 bg-[#0d1117] overflow-y-auto">
          <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{lang === "ru" ? "ПРОВОДНИК" : "EXPLORER"}</div>
          <div className="px-1">
            <div className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedPath(selectedPath.includes("/") ? selectedPath.split("/").slice(0, -1).join("/") : "")}>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              <span>..</span>
            </div>
            {fileTree.map((item) => (
              <div key={item.path}>
                <div
                  className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs cursor-pointer ${activeFile === item.path ? "bg-white/10" : "hover:bg-white/5"}`}
                  onClick={() => handleFileClick(item)}
                >
                  {item.type === "folder" ? (
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  )}
                  <span className="truncate">{item.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#1e1e1e]">
          {showNewFileInput && (
            <div className="flex items-center gap-2 border-b border-white/10 bg-[#0f766e]/20 px-3 py-2">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleNewFile();
                  if (e.key === "Escape") setShowNewFileInput(false);
                }}
                placeholder={lang === "ru" ? "Имя файла..." : "File name..."}
                className="flex-1 rounded border border-white/10 bg-[#0d1117] px-2 py-1 text-xs text-slate-200 outline-none focus:border-teal-500/50"
                autoFocus
              />
              <button type="button" onClick={handleNewFile} className="rounded bg-teal-500/20 px-2 py-1 text-xs text-teal-300 hover:bg-teal-500/30">OK</button>
              <button type="button" onClick={() => setShowNewFileInput(false)} className="rounded bg-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/20">{lang === "ru" ? "Отмена" : "Cancel"}</button>
            </div>
          )}

          <div className="relative flex min-h-0 flex-1 font-mono text-xs">
            {/* Line numbers */}
            <div className="flex select-none flex-col items-end bg-[#1e1e1e] py-3 pr-3 pl-2 text-slate-600 border-r border-white/5">
              <pre className="leading-6">{Array.from({ length: Math.max(lineNumbers, 1) }, (_, i) => i + 1).join("\n")}</pre>
            </div>

            {/* Code area */}
            <div className="relative min-w-0 flex-1 overflow-hidden">
              <pre ref={highlightRef} className="absolute inset-0 overflow-auto p-3 leading-6 pointer-events-none" dangerouslySetInnerHTML={{ __html: highlightedCode }} />
              <textarea
                ref={editorRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={(e) => {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const start = e.currentTarget.selectionStart;
                    const end = e.currentTarget.selectionEnd;
                    const newCode = code.substring(0, start) + "  " + code.substring(end);
                    setCode(newCode);
                    requestAnimationFrame(() => {
                      e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                    });
                  }
                }}
                className="absolute inset-0 w-full h-full resize-none bg-transparent p-3 font-mono leading-6 text-transparent caret-white outline-none"
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Panel */}
      {showTerminal && (
        <div className="flex flex-col border-t border-white/10 bg-[#0d1117]" style={{ height: `${terminalHeight}px` }}>
          {/* Resizer */}
          <div ref={terminalResizerRef} className="h-1 cursor-ns-resize bg-[#1a1f29] hover:bg-teal-500/50 transition-colors" onPointerDown={startTerminalResize} />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 bg-[#1a1f29] px-3 py-1">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              {lang === "ru" ? "ТЕРМИНАЛ" : "TERMINAL"}
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">{terminalCwd}</span>
            </div>
            <button type="button" onClick={() => setShowTerminal(false)} className="text-slate-400 hover:text-slate-200">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Output */}
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
            {terminalLines.length === 0 ? (
              <div className="text-slate-600">{lang === "ru" ? "Введите команду (help для списка)" : "Type command (help for list)"}</div>
            ) : (
              terminalLines.map((line) => (
                <div key={line.id} className={`leading-5 ${line.type === "input" ? "text-slate-300" : line.type === "error" ? "text-red-400" : line.type === "success" ? "text-emerald-400" : "text-emerald-400"}`}>
                  {line.text}
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-white/5 bg-[#0d1117] px-3 py-2">
            <span className="text-emerald-400 font-mono text-xs">$</span>
            <input
              ref={terminalInputRef}
              type="text"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              onKeyDown={handleTerminalKeyDown}
              placeholder={lang === "ru" ? "Введите команду..." : "Type command..."}
              className="flex-1 bg-transparent font-mono text-xs text-slate-200 outline-none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-white/10 bg-[#1a1f29] px-3 py-1 text-[10px] text-slate-500">
        <div className="flex items-center gap-3">
          <span>HackScript</span>
          {isDirty && <span className="text-amber-400">●</span>}
          {!showTerminal && (
            <button type="button" onClick={() => setShowTerminal(true)} className="text-slate-400 hover:text-slate-200">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>Ln {lineNumbers}, Col {code.length}</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}
