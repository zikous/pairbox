import { execFileSync } from "node:child_process";
import { chown, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn, type IPty } from "node-pty";
import type { WebSocket } from "ws";
import {
  RUNTIMES,
  parseJson,
  WorkerCommandSchema,
  type Runtime,
  type RunStatus,
  type WorkerCommand,
  type WorkerEvent,
} from "@pairbox/shared";

/**
 * After every command, the shell prints this invisible marker with the command's exit code.
 * That's how a Run's end and result are known; the marker is removed before output is sent.
 */
// eslint-disable-next-line no-control-regex -- the marker is made of terminal control characters
const EXIT_MARKER = /\x1b\]7770;(\d+)\x07/g;
const PROMPT_COMMAND = String.raw`printf '\033]7770;%s\007' "$?"`;
const PROMPT = String.raw`\[\e[1;32m\]sandbox\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]$ `;

export interface SandboxUser {
  name: string;
  home: string;
  /** Only set when the agent runs as root and can switch to the sandbox user. */
  ids?: { uid: number; gid: number };
}

export function sandboxUser(name: string): SandboxUser {
  const home = `/home/${name}`;
  if (process.getuid?.() !== 0) return { name, home }; // development on a laptop
  const id = (flag: string) => Number(execFileSync("id", [flag, name]).toString().trim());
  return { name, home, ids: { uid: id("-u"), gid: id("-g") } };
}

/**
 * Connects one WebSocket to a fresh shell. The shell runs as the sandbox user in the workspace
 * and is killed when the socket closes.
 */
export function openTerminal(
  socket: WebSocket,
  options: {
    workspace: string;
    user: SandboxUser;
    log: (error: unknown) => void;
  },
) {
  const { workspace, user, log } = options;
  const send = (event: WorkerEvent) => socket.send(JSON.stringify(event));

  let status: RunStatus = { state: "idle" };
  const setStatus = (next: RunStatus) => {
    status = next;
    send({ type: "status", status });
  };

  let shell = startShell();

  function startShell(): IPty {
    const pty = spawn("bash", ["--noprofile", "--norc", "-i"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: workspace,
      env: {
        PATH: process.env["PATH"] ?? "/usr/local/bin:/usr/bin:/bin",
        TERM: "xterm-256color",
        LANG: "C.UTF-8",
        HOME: user.home,
        USER: user.name,
        PS1: PROMPT,
        PROMPT_COMMAND,
      },
      ...user.ids,
    });

    pty.onData((data) => {
      for (const [, code] of data.matchAll(EXIT_MARKER)) {
        if (status.state === "running") {
          const durationMs = Math.round(performance.now() - status.startedAt);
          setStatus({ state: "exited", exitCode: Number(code), durationMs });
        }
      }
      const output = data.replace(EXIT_MARKER, "");
      if (output) send({ type: "output", data: output });
    });

    // Typing `exit` ends the shell: start a new one so the terminal keeps working.
    pty.onExit(() => {
      if (socket.readyState !== socket.OPEN) return;
      send({ type: "output", data: "\r\n\x1b[2m[shell restarted]\x1b[0m\r\n" });
      shell = startShell();
    });
    return pty;
  }

  async function saveCode(code: string, runtime: Runtime) {
    const path = join(workspace, RUNTIMES[runtime].file);
    await writeFile(path, code);
    if (user.ids) await chown(path, user.ids.uid, user.ids.gid);
  }

  async function handle(message: WorkerCommand) {
    switch (message.type) {
      case "input":
        return shell.write(message.data);
      case "resize":
        return shell.resize(message.cols, message.rows);
      case "write":
        return saveCode(message.code, message.runtime);
      case "run":
        if (status.state === "running") return;
        await saveCode(message.code, message.runtime);
        setStatus({ state: "running", startedAt: performance.now() });
        // ctrl-u clears anything half-typed on the prompt first.
        return shell.write(`\x15${RUNTIMES[message.runtime].command}\r`);
      case "stop":
        return shell.write("\x03");
    }
  }

  socket.on("message", (raw: Buffer) => {
    const parsed = WorkerCommandSchema.safeParse(parseJson(raw.toString()));
    // A failed command (say, a full disk) shouldn't take the whole worker down.
    if (parsed.success) handle(parsed.data).catch((error: unknown) => log(error));
  });
  socket.on("close", () => shell.kill("SIGKILL"));
}
