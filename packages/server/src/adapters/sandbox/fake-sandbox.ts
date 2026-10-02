import { LANGUAGES, type Language, type RunStatus } from "@pairbox/shared";
import type { Sandbox, SandboxProcess } from "../../application/ports";

const PROMPT = "\x1b[1;32msandbox\x1b[0m:\x1b[1;34m~\x1b[0m$ ";
const BANNER = "\x1b[2mpairbox sandbox (simulated). Type `help` to see commands.\x1b[0m\r\n";
const RUN_COMMAND: Record<Language, string> = {
  python: "python main.py",
  javascript: "node main.js",
};
const LINE_DELAY_MS = 80;

/**
 * A pretend sandbox: a tiny shell that echoes input like a real terminal, and fakes program
 * output by reading print / console.log lines. It lets the whole app work end to end until
 * the Docker sandbox exists. Nothing is executed.
 */
export class FakeSandbox implements Sandbox {
  start(source: { code(): string; language(): Language }): SandboxProcess {
    return new FakeShell(source);
  }
}

class FakeShell implements SandboxProcess {
  private outputListeners: ((data: string) => void)[] = [];
  private statusListeners: ((status: RunStatus) => void)[] = [];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private line = "";
  private status: RunStatus = { state: "idle" };

  constructor(private readonly source: { code(): string; language(): Language }) {
    // Let the caller subscribe before the banner is printed.
    this.later(0, () => this.print(BANNER + PROMPT));
  }

  onOutput(listener: (data: string) => void): void {
    this.outputListeners.push(listener);
  }

  onStatus(listener: (status: RunStatus) => void): void {
    this.statusListeners.push(listener);
  }

  write(data: string): void {
    if (data.startsWith("\x1b")) return; // arrow keys and other escape sequences
    for (const char of data) this.key(char);
  }

  run(): void {
    if (this.status.state === "running") return;
    this.print("\r\x1b[K" + PROMPT + this.runCommand() + "\r\n");
    this.line = "";
    this.startProgram();
  }

  stop(): void {
    if (this.status.state !== "running") return;
    this.cancelTimers();
    this.print("^C\r\n");
    this.setStatus({
      state: "exited",
      exitCode: 130,
      durationMs: Math.round(performance.now() - this.status.startedAt),
    });
    this.print(PROMPT);
  }

  dispose(): void {
    this.cancelTimers();
    this.outputListeners = [];
    this.statusListeners = [];
  }

  // Line discipline: what a real terminal driver would do with each keystroke.
  private key(char: string): void {
    if (char === "\x03") {
      if (this.status.state === "running") return this.stop();
      this.line = "";
      return this.print("^C\r\n" + PROMPT);
    }
    if (this.status.state === "running") return this.print(char === "\r" ? "\r\n" : char);
    if (char === "\r") {
      this.print("\r\n");
      this.execute(this.line.trim());
      this.line = "";
    } else if (char === "\x7f") {
      if (!this.line) return;
      this.line = this.line.slice(0, -1);
      this.print("\b \b");
    } else if (char >= " ") {
      this.line += char;
      this.print(char);
    }
  }

  private execute(command: string): void {
    const file = LANGUAGES[this.source.language()].file;
    if (command === this.runCommand() || command === `python3 ${file}`) return this.startProgram();

    const [name = "", ...args] = command.split(/\s+/);
    const commands: Record<string, () => string> = {
      "": () => "",
      help: () =>
        [
          "Commands:",
          `  ${this.runCommand().padEnd(16)} run the code`,
          "  ls, cat, echo, pwd, whoami, clear",
          "  ctrl-c           stop the running program",
          "",
        ].join("\r\n"),
      clear: () => "\x1b[2J\x1b[3J\x1b[H",
      ls: () => file + "\r\n",
      cat: () =>
        args[0] === file
          ? this.source.code().replaceAll("\n", "\r\n")
          : `cat: ${args[0] ?? ""}: No such file or directory\r\n`,
      echo: () => args.join(" ") + "\r\n",
      pwd: () => "/workspace\r\n",
      whoami: () => "sandbox\r\n",
    };
    const output = commands[name]?.() ?? `${name}: command not found\r\n`;
    this.print(output + PROMPT);
  }

  private startProgram(): void {
    const startedAt = performance.now();
    this.setStatus({ state: "running", startedAt });
    const { output, exitCode } = simulate(this.source.code(), this.source.language());
    output.forEach((text, i) =>
      this.later(LINE_DELAY_MS * (i + 1), () => this.print(text + "\r\n")),
    );
    this.later(LINE_DELAY_MS * (output.length + 1), () => {
      this.setStatus({
        state: "exited",
        exitCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
      this.print(PROMPT);
    });
  }

  private runCommand(): string {
    return RUN_COMMAND[this.source.language()];
  }

  private print(data: string): void {
    for (const listener of this.outputListeners) listener(data);
  }

  private setStatus(status: RunStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  private later(ms: number, fn: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }

  private cancelTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
}

/** Very rough stand-in for running code: tracks string variables and prints. */
function simulate(code: string, language: Language): { output: string[]; exitCode: number } {
  const python = language === "python";
  const assign = python
    ? /^\s*(\w+)\s*=\s*(.+?)\s*$/
    : /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(.+?);?\s*$/;
  const print = python ? /^\s*print\((.*)\)\s*$/ : /^\s*console\.log\((.*)\);?\s*$/;
  const raise = python ? /^\s*raise\s+(\w+)\((.*)\)/ : /^\s*throw\s+new\s+(\w+)\((.*)\)/;

  const vars = new Map<string, string>();
  const output: string[] = [];

  for (const line of code.split("\n")) {
    const error = raise.exec(line);
    if (error) {
      output.push(`\x1b[31m${error[1]}: ${evaluate(error[2] ?? "", vars)}\x1b[0m`);
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
