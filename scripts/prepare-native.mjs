import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dist = join(process.cwd(), "dist");
const html = await readFile(join(dist, "app.html"), "utf8");
const nativeIndex = html
  .replaceAll('href="/', 'href="./')
  .replaceAll("src=\"/", "src=\"./");

await writeFile(join(dist, "index.html"), nativeIndex);
console.log("Native entry ready: dist/index.html (from app.html)");
