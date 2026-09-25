import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = path.join(root, "public", "cesium");

if (!fs.existsSync(source)) {
  console.warn("[copy-cesium] Cesium build not found at", source);
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(source, dest, { recursive: true });
console.log("[copy-cesium] Copied Cesium assets → public/cesium");
