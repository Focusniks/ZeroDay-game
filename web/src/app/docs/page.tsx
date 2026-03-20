"use client";

import AppHeader from "@/components/ui/AppHeader";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type DocSection = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  code?: string;
};

function Card({
  id,
  title,
  summary,
  bullets,
  code,
  query,
}: {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  code?: string;
  query: string;
}) {
  const [copied, setCopied] = useState(false);
  const highlightedTitle = useMemo(() => highlightText(title, query), [title, query]);
  const highlightedSummary = useMemo(() => highlightText(summary, query), [summary, query]);

  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-zinc-50">{highlightedTitle}</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300">{highlightedSummary}</p>
      <ul className="mt-3 space-y-1 text-sm leading-relaxed text-zinc-300">
        {bullets.map((bullet) => (
          <li key={bullet}>- {highlightText(bullet, query)}</li>
        ))}
      </ul>
      {code ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-zinc-400">example.hack</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/10"
            >
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
          <pre className="overflow-auto rounded-xl border border-white/10 bg-black/25 p-4 text-xs text-cyan-100">
            {code}
          </pre>
        </div>
      ) : null}
    </section>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const regex = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(regex);
  return parts.map((part, idx) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={`${part}-${idx}`} className="rounded bg-cyan-400/25 px-1 text-cyan-100">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${idx}`}>{part}</span>
    )
  );
}

export default function DocsPage() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>("syntax");
  const searchRef = useRef<HTMLInputElement | null>(null);

  const sections = useMemo<DocSection[]>(
    () => [
      {
        id: "syntax",
        title: "1) Базовый синтаксис",
        summary:
          "HackScript в игре использует лаконичный Python-подобный синтаксис с блоками по отступам.",
        bullets: [
          "Комментарии: строка, начинающаяся с #.",
          "Присваивание: variable = expression.",
          "Вывод: print(expr) или print expr.",
          "Условие: if condition: и блок else:.",
          "Цикл: for i in range(N):.",
          "Отступы: блоки строятся отступами (2 пробела).",
        ],
      },
      {
        id: "types",
        title: "2) Типы данных и выражения",
        summary:
          "Движок поддерживает базовые примитивы и выражения с арифметикой, сравнениями и логикой.",
        bullets: [
          "Поддерживаются числа, строки и логические значения.",
          "Строки в одинарных и двойных кавычках.",
          "Операторы: + - * / % ** (возведение в степень).",
          "Сравнения: == != < <= > >=.",
          "Логика: && || !.",
          "Скобки () поддерживаются в выражениях.",
        ],
      },
      {
        id: "builtins",
        title: "3) Встроенные функции",
        summary:
          "HackScript предоставляет набор встроенных функций для работы со строками, числами и преобразования типов.",
        bullets: [
          "len(x) — длина строки или количество цифр в числе.",
          "str(x) — преобразование в строку.",
          "int(x) — преобразование в целое число.",
          "float(x) — преобразование в число с плавающей точкой.",
          "upper(x) — перевод строки в верхний регистр.",
          "lower(x) — перевод строки в нижний регистр.",
          "abs(x) — модуль числа.",
          "sqrt(x) — квадратный корень.",
          "min(a, b, ...) — минимальное значение из аргументов.",
          "max(a, b, ...) — максимальное значение из аргументов.",
        ],
        code: `# Встроенные функции
name = "hackscript"
print(len(name))        # 10
print(upper(name))      # HACKSCRIPT
print(sqrt(16))         # 4
print(max(1, 5, 3))     # 5
print(min(10, 2, 8))    # 2
print(abs(-42))         # 42
`,
      },
      {
        id: "runtime",
        title: "4) Запуск в игре",
        summary:
          "Скрипты запускаются из игрового терминала; путь к .hack считается от текущей папки (cd), как в Linux.",
        bullets: [
          "Команда терминала: hackrun <file>.",
          "Можно сначала cd Scripts (или любая папка), затем hackrun myscript — путь относительный.",
          "Расширение .hack можно не указывать, оно подставится автоматически.",
          "Tab-complete: команды и .hack файлы в текущей папке.",
        ],
      },
      {
        id: "control",
        title: "5) Операторы управления",
        summary:
          "HackScript поддерживает условные операторы и циклы для управления потоком выполнения.",
        bullets: [
          "if condition: ... else: — условный оператор.",
          "for i in range(N): — цикл с счётчиком.",
          "while condition: — цикл с условием (макс. 10 000 итераций).",
          "input var, \"prompt\": — ввод данных (в sandboxed среде возвращает пустую строку).",
        ],
        code: `# Цикл while
i = 0
while i < 5:
  print(i)
  i = i + 1

# Условие с else
x = 10
if x > 5:
  print("big")
else:
  print("small")
`,
      },
      {
        id: "limits",
        title: "6) Ограничения выполнения",
        summary:
          "Для стабильности симуляции в рантайме есть лимиты по итерациям, выводу и общему числу инструкций.",
        bullets: [
          "Лимит итераций range/while: до 10 000.",
          "Лимит строк вывода: до 500.",
          "Лимит исполняемых инструкций: до 50 000.",
          "Ошибки выполнения возвращаются в терминал как HackScript error.",
        ],
      },
      {
        id: "example",
        title: "7) Пример скрипта",
        summary: "Небольшой рабочий пример с переменными, циклом, условием и выводом результата.",
        bullets: [
          "Создается счетчик и сумма.",
          "Цикл range(count) накапливает итог.",
          "if проверяет порог и печатает текст.",
          "Используется встроенная функция max().",
        ],
        code: `# simple demo
count = 5
sum = 0

for i in range(count):
  sum = sum + i

if sum >= 10:
  print("sum is " + sum)
else:
  print("too small")

# Используем встроенные функции
print("max: " + max(1, 10, 5))
`,
      },
    ],
    []
  );

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((section) => {
      const haystack = [section.title, section.summary, ...section.bullets, section.code ?? ""].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [query, sections]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const isTypingField =
          target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
        if (isTypingField) return;
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (filteredSections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: [0.2, 0.5, 0.8] }
    );
    filteredSections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [filteredSections]);

  return (
    <div className="relative min-h-screen">
      <AppHeader
        subtitle="HackScript Docs"
        nav={[
          { href: "/", label: "Главная" },
          { href: "/marketplace", label: "Торговая площадка" },
          { href: "/account", label: "Личный кабинет" },
        ]}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-10">
        <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
          <div className="text-xs uppercase tracking-widest text-cyan-200/70">Документация языка</div>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-50">HackScript</h1>
          <p className="mt-3 text-sm text-zinc-300">
            Внутриигровой скриптовый язык для запуска через терминал `hackrun`. Синтаксис и поведение собраны по текущей реализации движка в `client`.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl lg:sticky lg:top-24">
            <div className="text-xs uppercase tracking-widest text-cyan-200/70">Навигация</div>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по документации..."
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-cyan-400/30"
            />
            <div className="mt-2 text-xs text-zinc-400">
              Найдено разделов: <span className="text-zinc-200">{filteredSections.length}</span> · <span className="text-zinc-500">Быстрый фокус: /</span>
            </div>
            <nav className="mt-4 space-y-2">
              {filteredSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={[
                    "block rounded-xl border px-3 py-2 text-sm transition",
                    activeId === section.id
                      ? "border-cyan-400/35 bg-cyan-500/15 text-cyan-100"
                      : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="grid grid-cols-1 gap-4">
            {filteredSections.length === 0 ? (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <h2 className="text-lg font-semibold text-zinc-50">Ничего не найдено</h2>
                <p className="mt-2 text-sm text-zinc-300">
                  По запросу <span className="text-cyan-200">{query}</span> совпадений нет. Попробуй другой термин: например `range`, `print`, `условие`.
                </p>
              </section>
            ) : null}
            {filteredSections.map((section) => (
              <Card
                key={section.id}
                id={section.id}
                title={section.title}
                summary={section.summary}
                bullets={section.bullets}
                code={section.code}
                query={query}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10"
          >
            Наверх
          </button>
        </div>
      </main>
    </div>
  );
}

