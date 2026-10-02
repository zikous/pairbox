import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ command, mode }) => {
  // Same .env as the API server (see .env.example at the repo root).
  const env = loadEnv(mode, repoRoot, "");
  if (command === "serve" && (!env["API_PORT"] || !env["WEB_PORT"])) {
    throw new Error(
      "API_PORT and WEB_PORT are not set. Copy .env.example to .env at the repo root.",
    );
  }
  const api = `${env["API_HOST"]}:${env["API_PORT"]}`;

  return {
    plugins: [tailwindcss(), svelte()],
    resolve: {
      alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
    },
    server: {
      port: Number(env["WEB_PORT"]),
      strictPort: true,
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
