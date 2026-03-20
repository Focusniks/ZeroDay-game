import { useMemo, useState } from "react";
import type { GameLanguage } from "../../lib/gameConfig";
import { FloatingWindow } from "../window/FloatingWindow";

type Props = {
  lang: GameLanguage;
  minimized?: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onFocus?: () => void;
  zIndex?: number;
};

type CalcToken =
  | { type: "number"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "^" | "%" }
  | { type: "func"; name: "sqrt" | "sin" | "cos" | "tan" | "log" | "abs" }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenize(exprRaw: string): CalcToken[] {
  const expr = exprRaw.replace(/\s+/g, "");
  const out: CalcToken[] = [];
  let i = 0;

  while (i < expr.length) {
    const c = expr[i]!;

    // Functions
    const funcNames = ["sqrt", "sin", "cos", "tan", "log", "abs"];
    let matchedFunc: string | null = null;
    for (const fn of funcNames) {
      if (expr.slice(i, i + fn.length) === fn) {
        matchedFunc = fn;
        break;
      }
    }
    if (matchedFunc) {
      out.push({ type: "func", name: matchedFunc as any });
      i += matchedFunc.length;
      continue;
    }

    if (c === "(") {
      out.push({ type: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ type: "rparen" });
      i++;
      continue;
    }

    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "^" || c === "%") {
      out.push({ type: "op", value: c as any });
      i++;
      continue;
    }

    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < expr.length && /[0-9.]/.test(expr[j]!)) j++;
      const num = Number(expr.slice(i, j));
      if (!Number.isFinite(num)) throw new Error("Invalid number");
      out.push({ type: "number", value: num });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character: '${c}'`);
  }

  return out;
}

function evalTokens(tokens: CalcToken[]): number {
  let idx = 0;
  const peek = () => tokens[idx];
  const consume = () => tokens[idx++];

  // Recursive descent with precedence:
  // expr    -> additive ((^ %) additive)*
  // additive -> term ((+|-) term)*
  // term    -> factor ((*|/) factor)*
  // factor  -> primary (('sqrt'|'sin'|'cos'|'tan'|'log'|'abs') factor)*
  // primary -> number | '(' expr ')' | ('+'|'-') factor

  const parseExpr = (): number => {
    let v = parseAdditive();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "^" && t.value !== "%")) break;
      consume();
      const rhs = parseAdditive();
      if (t.value === "^") v = Math.pow(v, rhs);
      else v = v % rhs;
    }
    return v;
  };

  const parseAdditive = (): number => {
    let v = parseTerm();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "+" && t.value !== "-")) break;
      consume();
      const rhs = parseTerm();
      v = t.value === "+" ? v + rhs : v - rhs;
    }
    return v;
  };

  const parseTerm = (): number => {
    let v = parseFactor();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "*" && t.value !== "/")) break;
      consume();
      const rhs = parseFactor();
      if (t.value === "*") v = v * rhs;
      else v = v / rhs;
    }
    return v;
  };

  const parseFactor = (): number => {
    let v = parsePrimary();
    
    // Apply functions
    while (true) {
      const t = peek();
      if (!t || t.type !== "func") break;
      consume();
      const arg = parsePrimary();
      switch (t.name) {
        case "sqrt": v = Math.sqrt(arg); break;
        case "sin": v = Math.sin(arg); break;
        case "cos": v = Math.cos(arg); break;
        case "tan": v = Math.tan(arg); break;
        case "log": v = Math.log10(arg); break;
        case "abs": v = Math.abs(arg); break;
      }
    }
    return v;
  };

  const parsePrimary = (): number => {
    const t = peek();
    if (!t) throw new Error("Unexpected end of expression");

    if (t.type === "number") {
      consume();
      return t.value;
    }

    if (t.type === "lparen") {
      consume();
      const v = parseExpr();
      const closing = consume();
      if (!closing || closing.type !== "rparen") throw new Error("Missing ')'");
      return v;
    }

    // Unary + / -
    if (t.type === "op" && (t.value === "+" || t.value === "-")) {
      consume();
      const v = parseFactor();
      return t.value === "-" ? -v : v;
    }

    throw new Error("Unexpected token");
  };

  const res = parseExpr();
  if (idx !== tokens.length) throw new Error("Trailing tokens");
  if (!Number.isFinite(res)) throw new Error("Result is not finite");
  return res;
}

function formatResult(n: number): string {
  // Keep it readable for in-game UI.
  if (Object.is(n, -0)) return "0";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) return n.toExponential(8);
  // Trim trailing zeros.
  const s = n.toFixed(10).replace(/\.?0+$/, "");
  return s;
}

export function CalculatorApp({ lang, minimized = false, onMinimize, onClose, onFocus, zIndex }: Props) {
  const title = useMemo(() => (lang === "ru" ? "Калькулятор" : "Calculator"), [lang]);

  const [expr, setExpr] = useState<string>("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClear = () => {
    setExpr("");
    setResult(null);
    setError(null);
  };

  const onBackspace = () => {
    if (!expr) return;
    setExpr((s) => s.slice(0, -1));
    setResult(null);
    setError(null);
  };

  const append = (s: string) => {
    setExpr((prev) => {
      const next = prev + s;
      return next;
    });
    setResult(null);
    setError(null);
  };

  const onEval = () => {
    const trimmed = expr.trim();
    if (!trimmed) return;
    try {
      const tokens = tokenize(trimmed);
      const val = evalTokens(tokens);
      setResult(formatResult(val));
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(lang === "ru" ? `Ошибка: ${msg}` : `Error: ${msg}`);
      setResult(null);
    }
  };

  // Basic input sanity: avoid starting with invalid operators (except unary '-').
  const canAppendOp = (op: "+" | "-" | "*" | "/") => {
    if (!expr) return op === "-";
    const last = expr[expr.length - 1]!;
    if (last === "+" || last === "-" || last === "*" || last === "/") return op === "-";
    if (last === "(") return op === "-";
    return true;
  };

  const appendFunc = (fn: string) => {
    setExpr((prev) => prev + fn + "(");
    setResult(null);
    setError(null);
  };

  const buttons: Array<{
    key: string;
    label: string;
    onClick: () => void;
    variant?: "primary" | "danger" | "secondary";
  }> = [
    // Row 1: Clear, Backspace, Functions
    {
      key: "clear",
      label: lang === "ru" ? "Очистить" : "Clear",
      variant: "danger",
      onClick: onClear
    },
    { key: "bs", label: "⌫", onClick: onBackspace },
    { key: "sqrt", label: "√", variant: "secondary", onClick: () => appendFunc("sqrt") },
    { key: "pow", label: "^", variant: "secondary", onClick: () => append("^") },

    // Row 2: sin, cos, 7, 8
    { key: "sin", label: "sin", variant: "secondary", onClick: () => appendFunc("sin") },
    { key: "cos", label: "cos", variant: "secondary", onClick: () => appendFunc("cos") },
    { key: "7", label: "7", onClick: () => append("7") },
    { key: "8", label: "8", onClick: () => append("8") },

    // Row 3: tan, log, 9, div
    { key: "tan", label: "tan", variant: "secondary", onClick: () => appendFunc("tan") },
    { key: "log", label: "log", variant: "secondary", onClick: () => appendFunc("log") },
    { key: "9", label: "9", onClick: () => append("9") },
    { key: "div", label: "/", onClick: () => canAppendOp("/") && append("/") },

    // Row 4: abs, %, 4, 5
    { key: "abs", label: "|x|", variant: "secondary", onClick: () => appendFunc("abs") },
    { key: "pct", label: "%", variant: "secondary", onClick: () => append("%") },
    { key: "4", label: "4", onClick: () => append("4") },
    { key: "5", label: "5", onClick: () => append("5") },

    // Row 5: 6, mul, 1, 2
    { key: "6", label: "6", onClick: () => append("6") },
    { key: "mul", label: "*", onClick: () => canAppendOp("*") && append("*") },
    { key: "1", label: "1", onClick: () => append("1") },
    { key: "2", label: "2", onClick: () => append("2") },

    // Row 6: 3, sub, 0, dot
    { key: "3", label: "3", onClick: () => append("3") },
    { key: "sub", label: "-", onClick: () => canAppendOp("-") && append("-") },
    { key: "0", label: "0", onClick: () => append("0") },
    { key: "dot", label: ".", onClick: () => append(".") },

    // Row 7: lpar, rpar, eq, add
    { key: "lpar", label: "(", onClick: () => append("(") },
    { key: "rpar", label: ")", onClick: () => append(")") },
    { key: "eq", label: "=", variant: "primary", onClick: onEval },
    { key: "add", label: "+", onClick: () => canAppendOp("+") && append("+") }
  ];

  return (
    <FloatingWindow title={title} onClose={onClose} onMinimize={onMinimize} minimized={minimized} onFocus={onFocus} zIndex={zIndex}>
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-[11px] font-bold text-slate-400">{lang === "ru" ? "Выражение" : "Expression"}</div>
          <div className="font-mono text-sm break-all text-slate-100">{expr || "0"}</div>
          {error ? <div className="mt-2 text-[12px] text-red-400">{error}</div> : null}
          {!error && result !== null ? (
            <div className="mt-2 text-[12px] text-[#2dd4bf]">
              {lang === "ru" ? "Результат" : "Result"}: <span className="font-mono">{result}</span>
            </div>
          ) : null}
        </div>

        <div className="grid flex-1 grid-cols-4 gap-2">
          {buttons.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={b.onClick}
              className={[
                "rounded-md border px-2 py-3 text-sm font-semibold",
                "border-white/10 bg-[#0b1220]/70 text-slate-100 hover:bg-[#0b1220] transition",
                b.variant === "primary" ? "border-[#2dd4bf]/40 bg-[#0f2a28]" : "",
                b.variant === "danger" ? "border-[#ff5f57]/40 bg-[#2a0f0f]" : "",
                b.variant === "secondary" ? "border-[#6366f1]/30 bg-[#1e1b4b]/50 hover:bg-[#1e1b4b]" : ""
              ].join(" ")}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </FloatingWindow>
  );
}

