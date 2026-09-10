import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const native = process.env.npm_lifecycle_event === "build:native";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        app: resolve(root, "app.html"),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/robinhood-rpc": {
        target: "https://rpc.mainnet.chain.robinhood.com",
        changeOrigin: true,
        rewrite: () => "",
      },
      "/xau-history": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        rewrite: () => "/v8/finance/chart/GC=F?interval=1mo&range=max",
      },
    },
  },
});
