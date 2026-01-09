import express from "express";
import path from "path";
import { fileURLToPath } from "url";
const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";

// Static hosting AFTER API
const publicDir = __dirname;
app.use(express.static(publicDir, { etag: true, lastModified: true, maxAge: isProd ? "1h" : 0, index: ["index.html"] }));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
