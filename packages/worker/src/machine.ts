import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Returns the machine to a blank state between rooms: kills every process of the sandbox user
 * and empties the folders it could write to.
 */
export async function cleanMachine(sandboxUser: string, writableDirs: string[]): Promise<void> {
  await killUserProcesses(sandboxUser);
  for (const dir of writableDirs) await emptyDir(dir);
}

async function killUserProcesses(user: string): Promise<void> {
  try {
    await run("pkill", ["-KILL", "-u", user]);
  } catch (error) {
    // pkill exits with 1 when there was nothing to kill.
    if ((error as { code?: number }).code !== 1) throw error;
  }
}

async function emptyDir(dir: string): Promise<void> {
  if (!existsSync(dir)) return;
  for (const entry of await readdir(dir)) {
    await rm(join(dir, entry), { recursive: true, force: true });
  }
}
