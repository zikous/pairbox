import { LANGUAGES, type Language, type RunStatus } from "@pairbox/domain";
import type { TerminalSession } from "../types";

const PROMPT = "\x1b[1;32msandbox\x1b[0m:\x1b[1;34m~\x1b[0m$ ";
const BANNER = "\x1b[2mpairbox sandbox (simulated). Type `help` to see commands.\x1b[0m\r\n";
const RUN_COMMAND: Record<Language, string> = {
  python: "python main.py",
  javascript: "node main.js",
};
const SCROLLBACK_MAX = 64_000;

interface Source {
  code(): string;
  language(): Language;
}

/**
 * A pretend shell. It echoes input like a real terminal and fakes program
 * output by reading print/console.log lines, so the UI can be built without
 * a sandbox.
 */
export function createFakeTerminal(source: Source): TerminalSession & { dispose(): void } {
  const outputListeners = new Set<(data: string) => void>();
  const statusListeners = new Set<(status: RunStatus) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let scrollback = "";
  let line = "";
  let status: RunStatus = { state: "idle" };

  const write = (data: string) => {
    scrollback = (scrollback + data).slice(-SCROLLBACK_MAX);
    for (const listener of outputListeners) listener(data);
  };

  const setStatus = (next: RunStatus) => {
    status = next;
    for (const listener of statusListeners) listener(next);
  };

  const later = (ms: number, fn: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  };

  const cancelTimers = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };

  const startRun = () => {
    const startedAt = performance.now();
    setStatus({ state: "running", startedAt });
    const { output, exitCode } = simulate(source.code(), source.language());
    output.forEach((text, i) => later(80 * (i + 1), () => write(text + "\r\n")));
    later(80 * (output.length + 1), () => {
      setStatus({
        state: "exited",
        exitCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
      write(PROMPT);
    });
  };

  const execute = (command: string) => {
    const [name = "", ...args] = command.trim().split(/\s+/);
    const file = LANGUAGES[source.language()].file;

    if (command.trim() === RUN_COMMAND[source.language()] || command.trim() === `python3 ${file}`) {
      return startRun();
    }

    switch (name) {
      case "":
        break;
      case "help":
        write(
          [
            "Commands:",
            `  ${RUN_COMMAND[source.language()].padEnd(16)} run the code`,
            "  ls, cat, echo, pwd, whoami, clear",
            "  ctrl-c           stop the running program",
          ].join("\r\n") + "\r\n",
        );
        break;
      case "clear":
        write("\x1b[2J\x1b[3J\x1b[H");
        break;
      case "ls":
        write(file + "\r\n");
        break;
      case "cat":
        write(
          args[0] === file
            ? source.code().replaceAll("\n", "\r\n")
            : `cat: ${args[0] ?? ""}: No such file or directory\r\n`,
        );
        break;
      case "echo":
        write(args.join(" ") + "\r\n");
        break;
      case "pwd":
        write("/workspace\r\n");
        break;
      case "whoami":
        write("sandbox\r\n");
        break;
      default:
        write(`${name}: command not found\r\n`);
    }
    write(PROMPT);
  };

  const stop = () => {
    if (status.state !== "running") return;
    cancelTimers();
    write("^C\r\n");
    setStatus({
      state: "exited",
      exitCode: 130,
      durationMs: Math.round(performance.now() - status.startedAt),
    });
    write(PROMPT);
  };

  write(BANNER + PROMPT);

  return {
    onOutput(listener) {
      if (scrollback) listener(scrollback);
      outputListeners.add(listener);
      return () => outputListeners.delete(listener);
    },

    onStatus(listener) {
      listener(status);
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },

    input(data) {
      if (data.startsWith("\x1b")) return; // arrow keys and other escape sequences
      for (const char of data) {
        if (char === "\x03") {
          if (status.state === "running") stop();
          else {
            write("^C\r\n" + PROMPT);
            line = "";
          }
        } else if (status.state === "running") {
          write(char === "\r" ? "\r\n" : char);
        } else if (char === "\r") {
          write("\r\n");
          execute(line);
          line = "";
        } else if (char === "\x7f") {
          if (line) {
            line = line.slice(0, -1);
            write("\b \b");
          }
        } else if (char >= " ") {
          line += char;
          write(char);
        }
      }
    },

    run() {
      if (status.state === "running") return;
      write("\r\x1b[K" + PROMPT + RUN_COMMAND[source.language()] + "\r\n");
      line = "";
      startRun();
    },

    stop,

    reset() {
      cancelTimers();
      line = "";
      scrollback = "";
      write("\x1bc" + BANNER + PROMPT);
      setStatus({ state: "idle" });
    },

    dispose() {
      cancelTimers();
      outputListeners.clear();
      statusListeners.clear();
    },
  };
}

/** Very rough stand-in for running code: evaluates string variables and prints. */
function simulate(code: string, language: Language): { output: string[]; exitCode: number } {
  const vars = new Map<string, string>();
  const output: string[] = [];
  const assign =
    language === "python"
      ? /^\s*(\w+)\s*=\s*(.+?)\s*$/
      : /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(.+?);?\s*$/;
  const print = language === "python" ? /^\s*print\((.*)\)\s*$/ : /^\s*console\.log\((.*)\);?\s*$/;
  const raise =
    language === "python" ? /^\s*raise\s+(\w+)\((.*)\)/ : /^\s*throw\s+new\s+(\w+)\((.*)\)/;

  for (const line of code.split("\n")) {
    const error = raise.exec(line);
    if (error) {
      const message = `${error[1]}: ${evaluate(error[2] ?? "", vars)}`;
      output.push(`\x1b[31m${message}\x1b[0m`);
      return { output, exitCode: 1 };
    }
    const printed = print.exec(line);
    if (printed) {
      output.push(evaluate(printed[1] ?? "", vars));
      continue;
    }
    const assigned = assign.exec(line);
    if (assigned?.[1] && assigned[2]) vars.set(assigned[1], evaluate(assigned[2], vars));
  }
  return { output, exitCode: 0 };
}

function evaluate(expression: string, vars: Map<string, string>): string {
  const text = expression.trim();
  const interpolate = (body: string, pattern: RegExp) =>
    body.replace(pattern, (_, name: string) => vars.get(name.trim()) ?? name);

  const quoted = /^(["'])(.*)\1$/.exec(text);
  if (quoted) return quoted[2] ?? "";
  const fString = /^f(["'])(.*)\1$/.exec(text);
  if (fString) return interpolate(fString[2] ?? "", /\{([^}]+)\}/g);
  const template = /^`(.*)`$/.exec(text);
  if (template) return interpolate(template[1] ?? "", /\$\{([^}]+)\}/g);
  return vars.get(text) ?? text;
}
