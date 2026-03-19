export type HackRunResult = {
  output: string[];
};

type Token =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "ident"; value: string }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenizeExpr(expr: string): Token[] {
  const s = expr.trim();
  const out: Token[] = [];
  let i = 0;

  const isIdentStart = (c: string) => /[a-zA-Z_]/.test(c);
  const isIdent = (c: string) => /[a-zA-Z0-9_]/.test(c);

  while (i < s.length) {
    const c = s[i]!;
    if (c === " " || c === "\t") {
      i++;
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
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      out.push({ type: "op", value: c });
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      let buf = "";
      while (i < s.length) {
        const cc = s[i]!;
        if (cc === "\\") {
          const next = s[i + 1];
          if (next) {
            buf += next;
            i += 2;
            continue;
          }
        }
        if (cc === quote) {
          i++;
          break;
        }
        buf += cc;
        i++;
      }
      out.push({ type: "string", value: buf });
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] ?? ""))) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j]!)) j++;
      const num = Number(s.slice(i, j));
      if (Number.isNaN(num)) throw new Error("Invalid number");
      out.push({ type: "number", value: num });
      i = j;
      continue;
    }
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < s.length && isIdent(s[j]!)) j++;
      out.push({ type: "ident", value: s.slice(i, j) });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character in expression: '${c}'`);
  }

  return out;
}

function evalTokens(tokens: Token[], env: Record<string, string | number>): string | number {
  // Shunting-yard for + - * /
  const output: Token[] = [];
  const ops: Array<Token & { type: "op" }> = [];

  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

  for (const t of tokens) {
    if (t.type === "number" || t.type === "string" || t.type === "ident") {
      output.push(t);
      continue;
    }
    if (t.type === "op") {
      while (ops.length) {
        const top = ops[ops.length - 1]!;
        if (top.type === "op" && prec[top.value] >= prec[t.value]) output.push(ops.pop()!);
        else break;
      }
      ops.push(t);
      continue;
    }
    if (t.type === "lparen") {
      ops.push({ type: "op", value: "+" }); // placeholder to keep stack shape
      output.push(t);
      continue;
    }
    if (t.type === "rparen") {
      // Not used in this simplified approach; we handle parentheses by a separate parser below.
      output.push(t);
      continue;
    }
  }

  // Better: use recursive evaluator by handling parentheses in string directly.
  // To keep this compact, implement a simple eval by building a new expression parser:
  return evalExprRecursive(tokens, env);
}

function evalExprRecursive(tokens: Token[], env: Record<string, string | number>): string | number {
  // Recursive descent: expr -> term (('+'|'-') term)*
  // term -> factor (('*'|'/') factor)*
  // factor -> number|string|ident|'(' expr ')'
  let idx = 0;

  const peek = () => tokens[idx];
  const consume = () => tokens[idx++];

  const parseFactor = (): string | number => {
    const t = peek();
    if (!t) throw new Error("Unexpected end of expression");
    if (t.type === "number") {
      consume();
      return t.value;
    }
    if (t.type === "string") {
      consume();
      return t.value;
    }
    if (t.type === "ident") {
      consume();
      if (!(t.value in env)) throw new Error(`Undefined variable: ${t.value}`);
      return env[t.value]!;
    }
    if (t.type === "lparen") {
      consume();
      const v = parseExpr();
      const closing = consume();
      if (!closing || closing.type !== "rparen") throw new Error("Missing ')'");
      return v;
    }
    throw new Error("Unexpected token in factor");
  };

  const parseTerm = (): string | number => {
    let left = parseFactor();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "*" && t.value !== "/")) break;
      consume();
      const right = parseFactor();
      const lnum = typeof left === "number" ? left : Number(left);
      const rnum = typeof right === "number" ? right : Number(right);
      if (Number.isNaN(lnum) || Number.isNaN(rnum)) throw new Error("Numeric operator used with non-number");
      left = t.value === "*" ? lnum * rnum : lnum / rnum;
    }
    return left;
  };

  const parseExpr = (): string | number => {
    let left = parseTerm();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "+" && t.value !== "-")) break;
      consume();
      const right = parseTerm();
      if (t.value === "+") {
        if (typeof left === "string" || typeof right === "string") {
          left = String(left) + String(right);
        } else {
          left = (left as number) + (right as number);
        }
      } else {
        const lnum = typeof left === "number" ? left : Number(left);
        const rnum = typeof right === "number" ? right : Number(right);
        if (Number.isNaN(lnum) || Number.isNaN(rnum)) throw new Error("Numeric operator used with non-number");
        left = lnum - rnum;
      }
    }
    return left;
  };

  const result = parseExpr();
  if (idx !== tokens.length) throw new Error("Unexpected tokens at end of expression");
  return result;
}

function countIndent(line: string): number {
  let i = 0;
  while (i < line.length && line[i] === " ") i++;
  // Treat tab as 2 spaces (rare)
  return i;
}

type Stmt =
  | { type: "print"; expr: string }
  | { type: "assign"; name: string; expr: string }
  | { type: "for"; varName: string; rangeExpr: string; body: Stmt[] };

function parseProgram(source: string): Stmt[] {
  const lines = source
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, "  "))
    .filter((l) => l.trim().length > 0);

  const stmts: Stmt[] = [];
  let i = 0;

  const parseBlock = (indentLevel: number): Stmt[] => {
    const block: Stmt[] = [];
    while (i < lines.length) {
      const raw = lines[i]!;
      const trimmed = raw.trim();
      if (trimmed.startsWith("#")) {
        i++;
        continue;
      }
      const ind = countIndent(raw);
      if (ind < indentLevel) break;
      if (ind > indentLevel) {
        throw new Error("Unexpected indentation");
      }

      if (trimmed.startsWith("for ")) {
        // for <var> in range(<expr>):
        const m = trimmed.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+range\((.+)\):$/);
        if (!m) throw new Error("Invalid for syntax. Expected: for i in range(N):");
        const varName = m[1]!;
        const rangeExpr = m[2]!;
        i++;

        const bodyIndent = indentLevel + 2;
        const body = parseBlock(bodyIndent);
        block.push({ type: "for", varName, rangeExpr, body });
        continue;
      }

      if (trimmed.startsWith("print")) {
        const m = trimmed.match(/^print\s*(?:\((.*)\)|\s+(.+))$/);
        if (!m) throw new Error("Invalid print syntax. Expected: print(expr)");
        const expr = (m[1] ?? m[2] ?? "").trim();
        block.push({ type: "print", expr });
        i++;
        continue;
      }

      const assign = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      if (assign) {
        block.push({ type: "assign", name: assign[1]!, expr: assign[2]! });
        i++;
        continue;
      }

      throw new Error(`Unknown statement: ${trimmed}`);
    }
    return block;
  };

  // Base indent is 0
  while (i < lines.length) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (trimmed.startsWith("#") || trimmed.length === 0) {
      i++;
      continue;
    }
    const ind = countIndent(raw);
    if (ind !== 0) {
      throw new Error("Program must start at indentation level 0");
    }
    stmts.push(...parseBlock(0));
  }

  return stmts;
}

function evalExpr(expr: string, env: Record<string, string | number>): string | number {
  const tokens = tokenizeExpr(expr);
  return evalExprRecursive(tokens, env);
}

export function runHackScript(source: string): HackRunResult {
  const output: string[] = [];
  const env: Record<string, string | number> = {};

  const ast = parseProgram(source);

  const execStmts = (stmts: Stmt[]) => {
    for (const s of stmts) {
      if (s.type === "assign") {
        env[s.name] = evalExpr(s.expr, env);
      } else if (s.type === "print") {
        const v = evalExpr(s.expr, env);
        output.push(String(v));
      } else if (s.type === "for") {
        const nRaw = evalExpr(s.rangeExpr, env);
        const n = typeof nRaw === "number" ? nRaw : Number(nRaw);
        if (!Number.isFinite(n)) throw new Error("range() must evaluate to a number");
        for (let k = 0; k < n; k++) {
          env[s.varName] = k;
          execStmts(s.body);
        }
      }
    }
  };

  execStmts(ast);
  return { output };
}

