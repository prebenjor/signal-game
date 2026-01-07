import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mount /vendor to serve hls.js build
export function mountVendor(app) {
  const hlsPath = path.join(__dirname, "node_modules", "hls.js", "dist");
  app.use("/vendor", express.static(hlsPath, { maxAge: "7d" }));
}
