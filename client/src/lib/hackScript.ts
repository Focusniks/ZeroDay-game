export type HackRunResult = {
  output: string[];
};

type Token =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "ident"; value: string }
  | {
      type: "op";
      value:
        | "+"
        | "-"
        | "*"
        | "/"
        | "=="
        | "!="
        | "<"
        | "<="
        | ">"
        | ">="
        | "&&"
        | "||"
        | "!"
        | "%"
        | "**";
    }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" };

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
    if (c === ",") {
      out.push({ type: "comma" });
      i++;
      continue;
    }
    // Multi-char operators first.
    const two = s.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=" || two === "&&" || two === "||" || two === "**") {
      out.push({ type: "op", value: two });
      i += 2;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "%" || c === "<" || c === ">" || c === "!") {
      out.push({ type: "op", value: c as any });
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

type HackValue = string | number | boolean;

function toBool(v: HackValue): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return v.length > 0;
}

function toNum(v: HackValue): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return n;
}

function evalExprRecursive(tokens: Token[], env: Record<string, string | number>): HackValue {
  // Recursive descent with precedence:
  // or  -> and ( '||' and )*
  // and -> eq ( '&&' eq )*
  // eq  -> rel ( ('=='|'!=') rel )*
  // rel -> add ( ('<'|'<='|'>'|'>=') add )*
  // add -> mul ( ('+'|'-') mul )*
  // mul -> unary ( ('*'|'/'|'%') unary )*
  // unary -> ('!'|'-') unary | primary
  // primary -> number|string|ident|'(' or ')'
  let idx = 0;

  const peek = () => tokens[idx];
  const consume = () => tokens[idx++];

  const parsePrimary = (): HackValue => {
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
      const v = parseOr();
      const closing = consume();
      if (!closing || closing.type !== "rparen") throw new Error("Missing ')'");
      return v;
    }
    throw new Error("Unexpected token in primary");
  };

  const parseUnary = (): HackValue => {
    const t = peek();
    if (t && t.type === "op" && (t.value === "!" || t.value === "-")) {
      consume();
      const v = parseUnary();
      if (t.value === "!") return !toBool(v);
      const n = toNum(v);
      if (!Number.isFinite(n)) throw new Error("Unary '-' used with non-number");
      return -n;
    }
    return parsePrimary();
  };

  const parseMul = (): HackValue => {
    let left = parseUnary();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "*" && t.value !== "/" && t.value !== "%")) break;
      consume();
      const right = parseUnary();
      const lnum = toNum(left);
      const rnum = toNum(right);
      if (!Number.isFinite(lnum) || !Number.isFinite(rnum)) throw new Error("Numeric operator used with non-number");
      if (t.value === "*") left = lnum * rnum;
      else if (t.value === "/") left = lnum / rnum;
      else left = lnum % rnum;
    }
    return left;
  };

  const parsePower = (): HackValue => {
    let left = parseMul();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || t.value !== "**") break;
      consume();
      const right = parseMul();
      const lnum = toNum(left);
      const rnum = toNum(right);
      if (!Number.isFinite(lnum) || !Number.isFinite(rnum)) throw new Error("Numeric operator used with non-number");
      left = Math.pow(lnum, rnum);
    }
    return left;
  };

  const parseAdd = (): HackValue => {
    let left = parsePower();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "+" && t.value !== "-")) break;
      consume();
      const right = parsePower();
      if (t.value === "+") {
        if (typeof left === "string" || typeof right === "string") left = String(left) + String(right);
        else left = toNum(left) + toNum(right);
      } else {
        const lnum = toNum(left);
        const rnum = toNum(right);
        if (!Number.isFinite(lnum) || !Number.isFinite(rnum)) throw new Error("Numeric operator used with non-number");
        left = lnum - rnum;
      }
    }
    return left;
  };

  const parseRel = (): HackValue => {
    let left = parseAdd();
    while (true) {
      const t = peek();
      if (
        !t ||
        t.type !== "op" ||
        (t.value !== "<" && t.value !== "<=" && t.value !== ">" && t.value !== ">=")
      )
        break;
      consume();
      const right = parseAdd();
      const lnum = toNum(left);
      const rnum = toNum(right);
      if (!Number.isFinite(lnum) || !Number.isFinite(rnum)) throw new Error("Relational operator used with non-number");
      if (t.value === "<") left = lnum < rnum;
      else if (t.value === "<=") left = lnum <= rnum;
      else if (t.value === ">") left = lnum > rnum;
      else left = lnum >= rnum;
    }
    return left;
  };

  const parseEq = (): HackValue => {
    let left = parseRel();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "==" && t.value !== "!=")) break;
      consume();
      const right = parseRel();
      if (typeof left === "number" && typeof right === "number") {
        left = t.value === "==" ? left === right : left !== right;
      } else {
        const ls = String(left);
        const rs = String(right);
        left = t.value === "==" ? ls === rs : ls !== rs;
      }
    }
    return left;
  };

  const parseAnd = (): HackValue => {
    let left = parseEq();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || t.value !== "&&") break;
      consume();
      const right = parseEq();
      left = toBool(left) && toBool(right);
    }
    return left;
  };

  const parseOr = (): HackValue => {
    let left = parseAnd();
    while (true) {
      const t = peek();
      if (!t || t.type !== "op" || t.value !== "||") break;
      consume();
      const right = parseAnd();
      left = toBool(left) || toBool(right);
    }
    return left;
  };

  const result = parseOr();
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
  | { type: "for"; varName: string; rangeExpr: string; body: Stmt[] }
  | { type: "while"; condExpr: string; body: Stmt[] }
  | { type: "input"; name: string; prompt?: string }
  | { type: "if"; condExpr: string; thenStmts: Stmt[]; elseStmts?: Stmt[] };

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

      if (trimmed.startsWith("if ")) {
        // if <expr>:
        const m = trimmed.match(/^if\s+(.+):$/);
        if (!m) throw new Error("Invalid if syntax. Expected: if <cond>:");
        const condExpr = m[1]!;
        i++;

        const bodyIndent = indentLevel + 2;
        const thenStmts = parseBlock(bodyIndent);

        let elseStmts: Stmt[] | undefined = undefined;
        if (i < lines.length) {
          const rawElse = lines[i]!;
          const trimmedElse = rawElse.trim();
          const indElse = countIndent(rawElse);
          if (indElse === indentLevel && /^else\s*:$/.test(trimmedElse)) {
            i++;
            elseStmts = parseBlock(bodyIndent);
          }
        }

        block.push({ type: "if", condExpr, thenStmts, elseStmts });
        continue;
      }

      if (trimmed.startsWith("while ")) {
        // while <expr>:
        const m = trimmed.match(/^while\s+(.+):$/);
        if (!m) throw new Error("Invalid while syntax. Expected: while <cond>:");
        const condExpr = m[1]!;
        i++;

        const bodyIndent = indentLevel + 2;
        const body = parseBlock(bodyIndent);
        block.push({ type: "while", condExpr, body });
        continue;
      }

      if (trimmed.startsWith("input ")) {
        // input <var> or input <var>, "prompt"
        const m = trimmed.match(/^input\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*,\s*["'](.+)["'])?$/);
        if (!m) throw new Error("Invalid input syntax. Expected: input var or input var, \"prompt\"");
        const name = m[1]!;
        const promptStr = m[2];
        block.push({ type: "input", name, prompt: promptStr });
        i++;
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

function evalExpr(expr: string, env: Record<string, string | number>): HackValue {
  // Built-in functions
  const fnCall = expr.match(/^(\w+)\((.*)\)$/s);
  if (fnCall) {
    const fnName = fnCall[1]!;
    const argsStr = fnCall[2]!;
    
    // Parse arguments (simple comma split, works for most cases)
    const args: string[] = [];
    let depth = 0;
    let current = "";
    for (const c of argsStr) {
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "," && depth === 0) {
        args.push(current.trim());
        current = "";
        continue;
      }
      current += c;
    }
    if (current.trim()) args.push(current.trim());

    // Built-in functions
    if (fnName === "len") {
      const argVal = evalExpr(args[0] || "", env);
      if (typeof argVal === "string") return argVal.length;
      if (typeof argVal === "number") return String(argVal).length;
      return 0;
    }
    if (fnName === "str") {
      const argVal = evalExpr(args[0] || "", env);
      return String(argVal);
    }
    if (fnName === "int") {
      const argVal = evalExpr(args[0] || "", env);
      return typeof argVal === "number" ? Math.floor(argVal) : Number(argVal) || 0;
    }
    if (fnName === "float") {
      const argVal = evalExpr(args[0] || "", env);
      return Number(argVal) || 0;
    }
    if (fnName === "upper") {
      const argVal = evalExpr(args[0] || "", env);
      return String(argVal).toUpperCase();
    }
    if (fnName === "lower") {
      const argVal = evalExpr(args[0] || "", env);
      return String(argVal).toLowerCase();
    }
    if (fnName === "abs") {
      const argVal = evalExpr(args[0] || "", env);
      const n = typeof argVal === "number" ? argVal : Number(argVal) || 0;
      return Math.abs(n);
    }
    if (fnName === "sqrt") {
      const argVal = evalExpr(args[0] || "", env);
      const n = typeof argVal === "number" ? argVal : Number(argVal) || 0;
      return Math.sqrt(n);
    }
    if (fnName === "min") {
      const vals = args.map(a => {
        const v = evalExpr(a, env);
        return typeof v === "number" ? v : Number(v) || 0;
      });
      return Math.min(...vals);
    }
    if (fnName === "max") {
      const vals = args.map(a => {
        const v = evalExpr(a, env);
        return typeof v === "number" ? v : Number(v) || 0;
      });
      return Math.max(...vals);
    }
  }

  const tokens = tokenizeExpr(expr);
  return evalExprRecursive(tokens, env);
}

export function runHackScript(source: string): HackRunResult {
  const output: string[] = [];
  const env: Record<string, string | number> = {};
  const MAX_FOR_ITERATIONS = 10_000;
  const MAX_OUTPUT_LINES = 500;
  const MAX_EXEC_STMTS = 50_000;
  let execStmtsCount = 0;

  const ast = parseProgram(source);

  const execStmts = (stmts: Stmt[]) => {
    for (const s of stmts) {
      execStmtsCount += 1;
      if (execStmtsCount > MAX_EXEC_STMTS) {
        throw new Error("HackScript execution limit exceeded");
      }
      if (s.type === "assign") {
        const v = evalExpr(s.expr, env);
        // HackScript assignments store primitive values in the environment.
        // Boolean results are represented as 1/0 to keep env typed.
        env[s.name] = typeof v === "boolean" ? (v ? 1 : 0) : v;
      } else if (s.type === "print") {
        const v = evalExpr(s.expr, env);
        if (output.length >= MAX_OUTPUT_LINES) {
          throw new Error("HackScript output limit exceeded");
        }
        output.push(String(v));
      } else if (s.type === "while") {
        let iterations = 0;
        while (toBool(evalExpr(s.condExpr, env))) {
          iterations++;
          if (iterations > MAX_FOR_ITERATIONS) {
            throw new Error(`While loop too many iterations (max ${MAX_FOR_ITERATIONS})`);
          }
          execStmts(s.body);
        }
      } else if (s.type === "input") {
        // Input is not supported in this sandboxed environment
        // Store empty string as placeholder
        env[s.name] = "";
        if (s.prompt) {
          output.push(`[Input prompt: ${s.prompt}]`);
        }
      } else if (s.type === "if") {
        const condRaw = evalExpr(s.condExpr, env);
        const cond = toBool(condRaw as HackValue);
        if (cond) execStmts(s.thenStmts);
        else if (s.elseStmts) execStmts(s.elseStmts);
      }
    }
  };

  execStmts(ast);
  return { output };
}

