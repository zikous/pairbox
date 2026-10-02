import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** This machine's IPv4 address on the local network, if it has one. */
function lanAddress(): string | undefined {
  return Object.values(networkInterfaces())
    .flat()
    .find((net) => net?.family === "IPv4" && !net.internal)?.address;
}

export default defineConfig(({ command, mode }) => {
  // Same .env as the API server (see .env.example at the repo root).
  const env = loadEnv(mode, repoRoot, "");
  if (command === "serve" && (!env["API_PORT"] || !env["WEB_PORT"])) {
    throw new Error(
      "API_PORT and WEB_PORT are not set. Copy .env.example to .env at the repo root.",
    );
  }
  const api = `${env["API_HOST"]}:${env["API_PORT"]}`;
  const lan = command === "serve" ? lanAddress() : undefined;

  return {
    plugins: [tailwindcss(), svelte()],
    resolve: {
      alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
    },
    // Used to build invite links (see roomUrl in src/lib/router.svelte.ts).
    define: {
      "import.meta.env.PUBLIC_URL": JSON.stringify(env["PUBLIC_URL"] ?? ""),
      "import.meta.env.LAN_URL": JSON.stringify(lan ? `http://${lan}:${env["WEB_PORT"]}` : ""),
    },
    server: {
      port: Number(env["WEB_PORT"]),
      strictPort: true,
      // Listen on the local network too, so invite links work for others on the same Wi-Fi.
      host: true,
      // Accept requests through `pnpm tunnel` (Cloudflare quick tunnels).
      allowedHosts: [".trycloudflare.com"],
      // The API server runs separately; forward its routes to it.
      proxy: {
        "/api": `http://${api}`,
        "/ws": { target: `ws://${api}`, ws: true },
      },
    },
    // The room page bundles the editor and terminal; it is loaded on demand.
    build: { chunkSizeWarningLimit: 1200 },
  };
});
