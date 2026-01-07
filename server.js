import express from "express";
import crypto from "crypto";
import dns from "dns/promises";
import net from "net";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import { mountVendor } from "./vendor.js";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Increased caps (fixes your “response too large” issue)
const MAX_HTML_BYTES = 5_000_000;
const MAX_TEXT_SNIFF_BYTES = 400_000; // response-body sniff cap for headless capture
const MAX_IMAGE_BYTES = 8_000_000;

// -------------------------
// Errors / helpers
// -------------------------
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function normalizeUrlString(input) {
  if (!input) return "";
  return String(input).trim();
}

function fixupUrl(urlStr) {
  const s = String(urlStr || "").trim();
  if (!s) return s;
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(s)) return s;
  return `https://${s}`;
}

function safeParseUrl(urlStr) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    throw new HttpError(400, "Invalid URL");
  }
  const protocol = (u.protocol || "").toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new HttpError(400, "Only http/https URLs are allowed");
  }
  return u;
}

// SSRF mitigation (block private network resolution)
function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const parts = ip.split(".").map((n) => parseInt(n, 10));
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe80:")) return true;
    return false;
  }
  return true;
}

async function assertNoPrivateResolution(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) throw new HttpError(403, "Blocked host (localhost)");

  const ips = new Set();

  try {
    (await dns.resolve4(hostname)).forEach((ip) => ips.add(ip));
  } catch {}
  try {
    (await dns.resolve6(hostname)).forEach((ip) => ips.add(ip));
  } catch {}

  if (!ips.size) throw new HttpError(403, "Host could not be resolved (blocked)");

  for (const ip of ips) {
    if (isPrivateIp(ip)) throw new HttpError(403, "Blocked host (private network resolution)");
  }
}

async function fetchWithCap(url, { accept = "*/*", maxBytes = 1_000_000, userAgent = "image-tabs-site/1.0" } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let resp;
  try {
    resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: accept,
        "User-Agent": userAgent
      }
    });
  } catch (e) {
    throw new HttpError(502, `Upstream fetch failed: ${e?.message || e}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    throw new HttpError(502, `Upstream HTTP ${resp.status}`);
  }

  const contentType = resp.headers.get("content-type") || "";
  const finalUrl = resp.url;

  const reader = resp.body?.getReader?.();
  if (!reader) {
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > maxBytes) throw new HttpError(413, `Upstream response too large (>${maxBytes} bytes)`);
    return { buffer: buf, contentType, finalUrl };
  }

  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > maxBytes) throw new HttpError(413, `Upstream response too large (>${maxBytes} bytes)`);
    chunks.push(Buffer.from(value));
  }

  return { buffer: Buffer.concat(chunks), contentType, finalUrl };
}

function parseDataImageUrl(dataUrl, maxBytes) {
  const m = String(dataUrl).match(/^data:([^;]*);base64,(.*)$/i);
  if (!m) throw new HttpError(400, "Invalid data URL (expected data:*;base64,...)");

  const contentType = (m[1] || "application/octet-stream").trim().toLowerCase();
  if (contentType.includes("image/svg+xml")) throw new HttpError(415, "SVG is not supported");

  const b64 = (m[2] || "").replace(/\s+/g, "");
  const approx = Math.floor((b64.length * 3) / 4);
  if (approx > maxBytes) throw new HttpError(413, "Data image too large");

  let buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch {
    throw new HttpError(400, "Invalid base64 data");
  }
  if (buffer.length > maxBytes) throw new HttpError(413, "Data image too large");

  return { contentType, buffer };
}

// -------------------------
// Stream extraction helpers
// -------------------------
function makeStreamCollector(baseUrl) {
  const out = {
    hls: new Set(),
    dash: new Set(),
    file: new Set()
  };

  const addUrl = (raw) => {
    if (!raw) return;
    const s = String(raw).trim();
    if (!s) return;

    const low = s.toLowerCase();
    if (low.startsWith("blob:") || low.startsWith("data:")) return;

    let abs;
    try {
      abs = new URL(s, baseUrl).toString();
    } catch {
      return;
    }

    const p = new URL(abs).pathname.toLowerCase();
    if (p.endsWith(".m3u8")) out.hls.add(abs);
    else if (p.endsWith(".mpd")) out.dash.add(abs);
    else if (p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".ogg")) out.file.add(abs);
  };

  const addFromContentType = (url, contentType) => {
    const ct = String(contentType || "").toLowerCase();
    if (!url) return;

    if (ct.includes("application/vnd.apple.mpegurl") || ct.includes("application/x-mpegurl")) out.hls.add(url);
    if (ct.includes("application/dash+xml")) out.dash.add(url);
    if (ct.startsWith("video/")) out.file.add(url);
  };

  const addFromText = (text) => {
    if (!text) return;

    // absolute URLs
    for (const m of text.matchAll(/https?:\/\/[^\s"'<>]+?\.(m3u8|mpd|mp4|webm|ogg)(\?[^\s"'<>]*)?/gi)) {
      addUrl(m[0]);
    }
    // quoted relative/absolute
    for (const m of text.matchAll(/["']([^"']+?\.(m3u8|mpd|mp4|webm|ogg)(\?[^"']*)?)["']/gi)) {
      addUrl(m[1]);
    }
  };

  return {
    out,
    addUrl,
    addFromContentType,
    addFromText
  };
}

// -------------------------
// API routes FIRST (before static)
// -------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/api/resolve", async (req, res) => {
  const urlStr = normalizeUrlString(req.query.url);
  if (!urlStr) return res.status(400).json({ error: "Missing url" });

  let url;
  try {
    url = safeParseUrl(fixupUrl(urlStr));
    await assertNoPrivateResolution(url.hostname);
  } catch (e) {
    return res.status(e?.status || 400).json({ error: e.message });
  }

  try {
    const out = await fetchWithCap(url.toString(), {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      maxBytes: 300_000
    });

    res.json({
      requested: url.toString(),
      final: out.finalUrl || url.toString(),
      contentType: out.contentType || ""
    });
  } catch (e) {
    return res.status(e?.status || 502).json({ error: e.message });
  }
});

app.get("/api/scrape", async (req, res) => {
  const urlStr = normalizeUrlString(req.query.url);
  if (!urlStr) return res.status(400).json({ error: "Missing url" });

  let url;
  try {
    url = safeParseUrl(fixupUrl(urlStr));
    await assertNoPrivateResolution(url.hostname);
  } catch (e) {
    return res.status(e?.status || 400).json({ error: e.message });
  }

  try {
    const out = await fetchWithCap(url.toString(), {
      accept: "text/html,application/xhtml+xml",
      maxBytes: MAX_HTML_BYTES
    });

    const base = out.finalUrl || url.toString();
    const html = out.buffer.toString("utf8");
    const $ = cheerio.load(html);

    const title =
      ($("meta[property='og:title']").attr("content") || "").trim() ||
      ($("title").text() || "").trim();

    const images = [];
    const seen = new Set();

    const push = (src, alt, type) => {
      if (!src) return;
      if (seen.has(src)) return;
      seen.add(src);
      images.push({ src, alt: alt || "", type });
    };

    // og:image
    const og = ($("meta[property='og:image']").attr("content") || "").trim();
    if (og) {
      try {
        const abs = new URL(og, base).toString();
        if (!abs.toLowerCase().endsWith(".svg")) push(abs, "og:image", "url");
      } catch {}
    }

    $("img").each((_, el) => {
      const src = ($(el).attr("src") || $(el).attr("data-src") || "").trim();
      if (!src) return;
      const alt = ($(el).attr("alt") || "").trim();

      if (src.toLowerCase().startsWith("data:")) {
        // only base64 images
        if (src.toLowerCase().includes("image/svg+xml")) return;
        if (!src.toLowerCase().includes(";base64,")) return;
        push(src, alt, "data");
        return;
      }

      try {
        const abs = new URL(src, base).toString();
        if (!abs.toLowerCase().endsWith(".svg")) push(abs, alt, "url");
      } catch {}
    });

    res.json({
      requested: url.toString(),
      final: base,
      title,
      count: images.length,
      images
    });
  } catch (e) {
    return res.status(e?.status || 502).json({ error: e.message });
  }
});

app.get("/api/proxy", async (req, res) => {
  const urlStr = normalizeUrlString(req.query.url);
  if (!urlStr) return res.status(400).json({ error: "Missing url" });

  // data: images
  if (urlStr.toLowerCase().startsWith("data:")) {
    try {
      const out = parseDataImageUrl(urlStr, MAX_IMAGE_BYTES);
      res.setHeader("Content-Type", out.contentType);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(out.buffer);
    } catch (e) {
      return res.status(e?.status || 400).json({ error: e.message });
    }
  }

  let url;
  try {
    url = safeParseUrl(fixupUrl(urlStr));
    await assertNoPrivateResolution(url.hostname);
  } catch (e) {
    return res.status(e?.status || 400).json({ error: e.message });
  }

  // simple memory cache
  const key = "img:" + sha256(url.toString());
  // eslint-disable-next-line no-constant-condition
  if (true) {
    // keep it simple; optional: add TTL cache here
  }

  try {
    const out = await fetchWithCap(url.toString(), {
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      maxBytes: MAX_IMAGE_BYTES
    });

    const ct = String(out.contentType || "").toLowerCase();
    if (ct.includes("image/svg+xml")) return res.status(415).json({ error: "SVG is not supported" });
    if (!ct.startsWith("image/")) return res.status(415).json({ error: `Upstream is not an image (${ct || "unknown"})` });

    res.setHeader("Content-Type", out.contentType || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=1200");
    return res.status(200).send(out.buffer);
  } catch (e) {
    return res.status(e?.status || 502).json({ error: e.message });
  }
});

// A) HTML detection (robust caps + better scan)
app.get("/api/detect-streams", async (req, res) => {
  const urlStr = normalizeUrlString(req.query.url);
  if (!urlStr) return res.status(400).json({ error: "Missing url" });

  let url;
  try {
    url = safeParseUrl(fixupUrl(urlStr));
    await assertNoPrivateResolution(url.hostname);
  } catch (e) {
    return res.status(e?.status || 400).json({ error: e.message });
  }

  try {
    const out = await fetchWithCap(url.toString(), {
      accept: "text/html,application/xhtml+xml",
      maxBytes: MAX_HTML_BYTES
    });

    const base = out.finalUrl || url.toString();
    const html = out.buffer.toString("utf8");

    const collector = makeStreamCollector(base);
    const { addUrl, addFromText, out: bucket } = collector;

    // Parse DOM quickly for obvious attributes
    const $ = cheerio.load(html);
    $("video").each((_, el) => addUrl($(el).attr("src")));
    $("source").each((_, el) => addUrl($(el).attr("src")));
    $("a").each((_, el) => addUrl($(el).attr("href")));
    $("meta").each((_, el) => addUrl($(el).attr("content")));
    $("link").each((_, el) => addUrl($(el).attr("href")));

    // Inline scripts + whole document scan
    $("script").each((_, el) => addFromText($(el).text() || ""));
    addFromText(html);

    const result = {
      requested: url.toString(),
      final: base,
      hls: Array.from(bucket.hls).slice(0, 60),
      dash: Array.from(bucket.dash).slice(0, 60),
      file: Array.from(bucket.file).slice(0, 60)
    };
    result.count = result.hls.length + result.dash.length + result.file.length;

    return res.json(result);
  } catch (e) {
    return res.status(e?.status || 502).json({ error: e.message });
  }
});

// C) Headless capture (Playwright) with response-body sniffing
app.get("/api/capture-streams", async (req, res) => {
  const urlStr = normalizeUrlString(req.query.url);
  if (!urlStr) return res.status(400).json({ error: "Missing url" });

  let url;
  try {
    url = safeParseUrl(fixupUrl(urlStr));
    await assertNoPrivateResolution(url.hostname);
  } catch (e) {
    return res.status(e?.status || 400).json({ error: e.message });
  }

  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return res.status(500).json({ error: "Playwright is not installed. Run: npm install playwright" });
  }

  const { chromium } = playwright;

  const collector = makeStreamCollector(url.toString());
  const { addUrl, addFromContentType, addFromText, out: bucket } = collector;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: "image-tabs-site/1.0",
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    page.on("request", (reqObj) => {
      addUrl(reqObj.url());
    });

    page.on("response", async (resp) => {
      const rurl = resp.url();
      const headers = resp.headers();
      const ct = headers["content-type"] || "";

      addUrl(rurl);
      addFromContentType(rurl, ct);

      // Sniff small text bodies to extract hidden manifest URLs from JSON/JS/HTML/m3u8
      const ctLow = String(ct).toLowerCase();
      const isTexty =
        ctLow.includes("application/json") ||
        ctLow.includes("text/") ||
        ctLow.includes("application/javascript") ||
        ctLow.includes("application/x-javascript") ||
        ctLow.includes("application/vnd.apple.mpegurl") ||
        ctLow.includes("application/x-mpegurl") ||
        ctLow.includes("application/dash+xml");

      if (!isTexty) return;

      try {
        // Avoid huge bodies
        const cl = headers["content-length"] ? parseInt(headers["content-length"], 10) : NaN;
        if (!Number.isNaN(cl) && cl > MAX_TEXT_SNIFF_BYTES) return;

        const txt = await resp.text();
        if (txt && txt.length <= MAX_TEXT_SNIFF_BYTES) {
          addFromText(txt);
        }
      } catch {
        // ignore body read failures (opaque/cached/etc.)
      }
    });

    // Navigate
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 25_000 });

    // Let network settle
    try {
      await page.waitForLoadState("networkidle", { timeout: 12_000 });
    } catch {
      // ignore
    }
    await page.waitForTimeout(2_500);

    // Best-effort: attempt play
    try {
      await page.evaluate(() => {
        const v = document.querySelector("video");
        if (v) {
          v.muted = true;
          v.play().catch(() => {});
        }
      });
    } catch {}
    await page.waitForTimeout(4_000);

    const finalUrl = page.url();

    const result = {
      requested: url.toString(),
      final: finalUrl,
      hls: Array.from(bucket.hls).slice(0, 80),
      dash: Array.from(bucket.dash).slice(0, 80),
      file: Array.from(bucket.file).slice(0, 80)
    };
    result.count = result.hls.length + result.dash.length + result.file.length;

    return res.json(result);
  } catch (e) {
    return res.status(502).json({ error: e?.message || String(e) });
  } finally {
    try {
      await browser.close();
    } catch {}
  }
});

// -------------------------
// Static hosting AFTER API
// -------------------------
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
  console.warn(`[WARN] public/ directory not found at: ${publicDir}`);
}
app.use(express.static(publicDir, { etag: true, lastModified: true, maxAge: "1h", index: ["index.html"] }));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
