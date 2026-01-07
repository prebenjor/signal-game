/* public/app.js */
/* global Hls */

const $ = (sel) => document.querySelector(sel);

// --------------------
// UI helpers
// --------------------
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg || "";
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

function setStatus(msg) {
  $("#status").textContent = msg || "";
}

function setVideoMsg(msg) {
  $("#videoMsg").textContent = msg || "";
}

function fixupUrlClient(s) {
  const v = String(s || "").trim();
  if (!v) return v;
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(v)) return v;
  return `https://${v}`;
}

// Robust response parsing (prevents "Unexpected token '<'")
async function readJsonOrText(r) {
  const ct = (r.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("application/json")) {
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  }

  const text = await r.text();
  const snippet = text.slice(0, 220).replace(/\s+/g, " ");
  throw new Error(`Expected JSON but got ${ct || "unknown"} (HTTP ${r.status}): ${snippet}`);
}

async function api(url) {
  const r = await fetch(url);
  return readJsonOrText(r);
}

// --------------------
// URL normalization for detected candidates
// --------------------
// Converts JSON-style escapes (e.g., \u002D -> '-') and repairs common host-splitting artifacts.
function decodeEscapes(s) {
  let x = String(s || "");

  // JSON often escapes forward slashes
  x = x.replace(/\\\//g, "/");

  // Convert \uXXXX sequences
  x = x.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return _m;
    }
  });

  return x;
}

function normalizeCandidateUrl(raw) {
  let s = decodeEscapes(raw).trim();
  if (!s) return "";

  // Some captures yield "https://edge11/-hel.live.mmcdn.com/..." (host split by '/')
  // Repair only when the part after slash clearly looks like it belongs to the host (contains a dot).
  s = s.replace(/^https?:\/\/([^/]+)\/([^-\/][^/]*\.[^/].*)$/i, "https://$1$2");
  s = s.replace(/^https?:\/\/([^/]+)\/(-[^/]+\.[^/].*)$/i, "https://$1$2");

  // Handle occasional accidental "https:\/\/*" leftovers (very rare)
  s = s.replace(/^https?:\/+(?!\/)/i, (m) => (m.startsWith("https") ? "https://" : "http://"));

  return s;
}

function safeUrl(u) {
  const s = normalizeCandidateUrl(u);
  if (!s) return "";
  try {
    const parsed = new URL(s);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

// --------------------
// Tabs
// --------------------
function setTab(tab) {
  $("#tabImages").classList.toggle("active", tab === "images");
  $("#tabYoutube").classList.toggle("active", tab === "youtube");
  $("#tabVideo").classList.toggle("active", tab === "video");
  $("#tabHistory").classList.toggle("active", tab === "history");

  $("#panelImages").classList.toggle("hidden", tab !== "images");
  $("#panelYoutube").classList.toggle("hidden", tab !== "youtube");
  $("#panelVideo").classList.toggle("hidden", tab !== "video");
  $("#panelHistory").classList.toggle("hidden", tab !== "history");
}

// --------------------
// History
// --------------------
const HISTORY_KEY = "site_history_v2";
let history = loadHistory();

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 200)));
  } catch {}
}

function addHistory(url) {
  const u = (url || "").trim();
  if (!u) return;
  history = [u, ...history.filter((x) => x !== u)].slice(0, 200);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  const list = $("#historyList");
  list.innerHTML = "";

  if (!history.length) {
    list.innerHTML = `<div class="empty">No history yet.</div>`;
    return;
  }

  for (const url of history) {
    const row = document.createElement("div");
    row.className = "histRow";

    const label = document.createElement("div");
    label.className = "histLabel";
    label.textContent = url;

    const btnUseImages = document.createElement("button");
    btnUseImages.className = "btn";
    btnUseImages.textContent = "Use (Images)";
    btnUseImages.addEventListener("click", () => {
      $("#urlInput").value = url;
      setTab("images");
      toast("Loaded URL");
    });

    const btnUseVideo = document.createElement("button");
    btnUseVideo.className = "btn";
    btnUseVideo.textContent = "Use (Video)";
    btnUseVideo.addEventListener("click", () => {
      $("#videoInput").value = url;
      setTab("video");
      toast("Loaded URL");
    });

    row.appendChild(label);
    row.appendChild(btnUseImages);
    row.appendChild(btnUseVideo);
    list.appendChild(row);
  }
}

// --------------------
// Images
// --------------------
function isDataUrl(s) {
  return typeof s === "string" && s.toLowerCase().startsWith("data:");
}

function isSvgSrc(src) {
  const s = String(src || "").toLowerCase();
  if (s.startsWith("data:image/svg+xml")) return true;
  try {
    const u = new URL(src);
    return (u.pathname || "").toLowerCase().endsWith(".svg");
  } catch {
    return false;
  }
}

function proxiedImageSrc(src) {
  return `/api/proxy?url=${encodeURIComponent(src)}`;
}

async function loadImages() {
  const raw = ($("#urlInput").value || "").trim();
  if (!raw) return toast("Paste a URL first.");

  const url = fixupUrlClient(raw);
  addHistory(url);

  setStatus("Fetching images…");
  $("#imageGrid").innerHTML = "";

  try {
    const data = await api(`/api/scrape?url=${encodeURIComponent(url)}`);
    const imgs = (data.images || []).filter((i) => i?.src && !isSvgSrc(i.src));

    setStatus(`Found ${imgs.length} candidates (SVG removed).`);
    renderImages(imgs);
  } catch (e) {
    console.error(e);
    setStatus("");
    toast(e.message || "Failed");
  }
}

function renderImages(imgs) {
  const grid = $("#imageGrid");
  grid.innerHTML = "";

  if (!imgs.length) {
    grid.innerHTML = `<div class="empty">No images found.</div>`;
    return;
  }

  for (const img of imgs) {
    const card = document.createElement("div");
    card.className = "card pending";
    card.style.visibility = "hidden";

    const wrap = document.createElement("div");
    wrap.className = "thumbWrap";

    const el = document.createElement("img");
    el.className = "thumb";
    el.loading = "lazy";
    el.alt = img.alt || "";
    el.src = proxiedImageSrc(img.src);

    el.addEventListener("error", () => card.remove());
    el.addEventListener("load", () => {
      const w = el.naturalWidth || 0;
      const h = el.naturalHeight || 0;

      if (w === 0 || h === 0 || (w <= 2 && h <= 2) || (w < 32 && h < 32)) {
        card.remove();
        return;
      }

      card.style.visibility = "visible";
      card.classList.remove("pending");
    });

    wrap.appendChild(el);

    const meta = document.createElement("div");
    meta.className = "meta";

    const title = document.createElement("div");
    title.className = "metaTitle";
    title.textContent = isDataUrl(img.src) ? "Inline image (base64)" : img.src;

    const alt = document.createElement("div");
    alt.className = "metaAlt";
    alt.textContent = img.alt || " ";

    meta.appendChild(title);
    meta.appendChild(alt);

    card.appendChild(wrap);
    card.appendChild(meta);
    grid.appendChild(card);
  }
}

// --------------------
// YouTube
// --------------------
function extractYoutubeId(s) {
  const v = String(s || "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

  try {
    const u = new URL(v);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {}
  return null;
}

function loadYoutube() {
  const input = ($("#ytInput").value || "").trim();
  if (!input) return toast("Paste a YouTube link or ID.");

  const id = extractYoutubeId(input);
  if (!id) return toast("Could not parse YouTube ID.");

  $("#ytFrame").src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
  toast("Loaded YouTube");
}

// --------------------
// Video (A+B+C)
// --------------------
let hlsInstance = null;

function destroyHls() {
  if (hlsInstance) {
    try {
      hlsInstance.destroy();
    } catch {}
    hlsInstance = null;
  }
}

function hideCandidates() {
  $("#streamCandidates").classList.add("hidden");
  $("#candList").innerHTML = "";
}

function hideEmbed() {
  $("#embedWrap").classList.add("hidden");
  $("#embedFrame").src = "about:blank";
}

function clearVideo() {
  destroyHls();
  hideCandidates();
  hideEmbed();

  const v = $("#customVideo");
  try {
    v.pause();
  } catch {}
  v.removeAttribute("src");
  v.load();

  setVideoMsg("");
}

function parseVideoUrl(raw) {
  const s0 = String(raw || "").trim();
  if (!s0) return { error: "Paste a URL first." };

  if (s0.toLowerCase().startsWith("blob:")) {
    return { error: "blob: URLs only work inside the original page/tab and cannot be embedded elsewhere." };
  }

  const s = fixupUrlClient(s0);
  let u;
  try {
    u = new URL(s);
  } catch {
    return { error: "Invalid URL." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { error: "Only http/https URLs are supported." };

  const p = (u.pathname || "").toLowerCase();
  const isHls = p.endsWith(".m3u8");
  const isDash = p.endsWith(".mpd");
  const isFile = p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".ogg");
  const isPage = !isHls && !isDash && !isFile;

  return { url: u.toString(), isHls, isDash, isFile, isPage };
}

function canPlayNativeHls(videoEl) {
  const t = videoEl.canPlayType("application/vnd.apple.mpegurl");
  return t === "probably" || t === "maybe";
}

async function loadHls(urlRaw) {
  const url = safeUrl(urlRaw);
  if (!url) {
    setVideoMsg("HLS candidate URL could not be normalized into a valid URL.");
    return;
  }

  hideEmbed();
  const video = $("#customVideo");
  destroyHls();

  if (canPlayNativeHls(video)) {
    video.src = url;
    video.load();
    video.play().catch(() => {});
    setVideoMsg("Loaded HLS (native).");
    return;
  }

  if (!window.Hls) {
    setVideoMsg("hls.js not loaded. Check /vendor/hls.min.js.");
    return;
  }
  if (!window.Hls.isSupported()) {
    setVideoMsg("HLS not supported by this browser.");
    return;
  }

  hlsInstance = new window.Hls({ enableWorker: true, lowLatencyMode: true });

  hlsInstance.on(window.Hls.Events.ERROR, (_ev, data) => {
    console.error("[HLS ERROR]", data);
    if (data?.type === "networkError") {
      setVideoMsg("HLS network error. Likely CORS blocked playlist/segments or signed segments require origin cookies.");
    } else {
      setVideoMsg(`HLS error: ${data?.details || "unknown"}`);
    }
  });

  hlsInstance.loadSource(url);
  hlsInstance.attachMedia(video);

  hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
    video.play().catch(() => {});
    setVideoMsg("Loaded HLS (hls.js).");
  });
}

async function loadDirect(urlRaw) {
  const url = safeUrl(urlRaw);
  if (!url) {
    setVideoMsg("Video candidate URL could not be normalized into a valid URL.");
    return;
  }

  hideEmbed();
  destroyHls();
  const video = $("#customVideo");
  video.src = url;
  video.load();
  video.play().catch(() => {});
  setVideoMsg("Loaded direct video.");
}

function showCandidates(groups, sourceLabel) {
  const wrap = $("#streamCandidates");
  const list = $("#candList");
  list.innerHTML = "";

  const sections = [
    { key: "hls", title: "HLS (.m3u8)", loader: loadHls },
    { key: "file", title: "Direct files (.mp4/.webm/.ogg)", loader: loadDirect },
    { key: "dash", title: "DASH (.mpd) (listed only)", loader: null }
  ];

  let any = false;

  for (const s of sections) {
    const arr = Array.isArray(groups?.[s.key]) ? groups[s.key] : [];
    if (!arr.length) continue;
    any = true;

    const sec = document.createElement("div");
    sec.className = "candSection";

    const h = document.createElement("div");
    h.className = "candSectionTitle";
    h.textContent = `${s.title} (${arr.length})`;
    sec.appendChild(h);

    for (const rawUrl of arr.slice(0, 25)) {
      const fixed = safeUrl(rawUrl);
      if (!fixed) continue;

      const row = document.createElement("div");
      row.className = "candRow";

      const u = document.createElement("div");
      u.className = "candUrl";
      u.textContent = fixed;

      const btnLoad = document.createElement("button");
      btnLoad.className = "btn";
      btnLoad.textContent = s.loader ? "Load" : "N/A";
      btnLoad.disabled = !s.loader;
      btnLoad.addEventListener("click", async () => {
        if (!s.loader) return;
        await s.loader(fixed);
      });

      const btnOpen = document.createElement("button");
      btnOpen.className = "btn";
      btnOpen.textContent = "Open";
      btnOpen.addEventListener("click", () => window.open(fixed, "_blank", "noopener,noreferrer"));

      row.appendChild(u);
      row.appendChild(btnLoad);
      row.appendChild(btnOpen);
      sec.appendChild(row);
    }

    list.appendChild(sec);
  }

  if (!any) {
    hideCandidates();
    return false;
  }

  wrap.classList.remove("hidden");
  setVideoMsg(sourceLabel ? `Candidates detected (${sourceLabel}).` : "Candidates detected.");
  return true;
}

function mergeCandidates(into, data) {
  for (const k of ["hls", "dash", "file"]) {
    const arr = Array.isArray(data?.[k]) ? data[k] : [];
    for (const u of arr) {
      const fixed = safeUrl(u);
      if (!fixed) continue;
      if (!into[k].includes(fixed)) into[k].push(fixed);
    }
  }
}

function embedPage(urlRaw) {
  const url = safeUrl(urlRaw) || fixupUrlClient(urlRaw);
  hideCandidates();
  $("#embedFrame").src = url;
  $("#embedWrap").classList.remove("hidden");
  $("#embedNote").textContent = "If it’s blank, the site likely blocks iframes (CSP/X-Frame-Options).";
  setVideoMsg("Embed attempt started.");
}

async function detectStreams(pageUrlRaw) {
  const pageUrl = safeUrl(pageUrlRaw) || fixupUrlClient(pageUrlRaw);

  hideCandidates();
  const advanced = $("#videoAdvanced").checked;

  setVideoMsg(advanced ? "Detecting streams (HTML + headless)..." : "Detecting streams (HTML scan)...");

  const merged = { hls: [], dash: [], file: [] };

  // A) HTML scan
  try {
    const a = await api(`/api/detect-streams?url=${encodeURIComponent(pageUrl)}`);
    mergeCandidates(merged, a);
  } catch (e) {
    console.warn("[A detect failed]", e);
    setVideoMsg(`HTML scan failed: ${e.message}`);
  }

  // C) Headless capture (optional)
  if (advanced) {
    try {
      const c = await api(`/api/capture-streams?url=${encodeURIComponent(pageUrl)}`);
      mergeCandidates(merged, c);
    } catch (e) {
      console.warn("[C capture failed]", e);
      setVideoMsg(`Headless capture failed: ${e.message}`);
    }
  }

  const ok = showCandidates(merged, advanced ? "HTML + headless" : "HTML");
  if (!ok) {
    setVideoMsg("No candidates detected. Use Open page, or try Advanced detection.");
  }

  return merged;
}

async function onVideoLoad() {
  const raw = $("#videoInput").value || "";
  const parsed = parseVideoUrl(raw);
  if (parsed.error) return toast(parsed.error);

  addHistory(parsed.url);
  clearVideo();

  if (parsed.isFile) return loadDirect(parsed.url);
  if (parsed.isHls) return loadHls(parsed.url);

  if (parsed.isDash) {
    setVideoMsg("DASH (.mpd) detected. This app lists it, but native playback requires a DASH player (e.g., Shaka).");
    showCandidates({ hls: [], file: [], dash: [parsed.url] }, "direct");
    return;
  }

  // page URL path: detect, then auto-try first HLS if any
  const candidates = await detectStreams(parsed.url);

  if (candidates.hls.length) {
    await loadHls(candidates.hls[0]);
  } else if (candidates.file.length) {
    await loadDirect(candidates.file[0]);
  } else {
    setVideoMsg("No playable URL detected. You can try Embed page (may be blocked), or Open page.");
  }
}

async function onVideoDetect() {
  const raw = $("#videoInput").value || "";
  const parsed = parseVideoUrl(raw);
  if (parsed.error) return toast(parsed.error);

  addHistory(parsed.url);
  clearVideo();

  if (!parsed.isPage) {
    showCandidates(
      {
        hls: parsed.isHls ? [parsed.url] : [],
        file: parsed.isFile ? [parsed.url] : [],
        dash: parsed.isDash ? [parsed.url] : []
      },
      "direct"
    );
    return;
  }

  await detectStreams(parsed.url);
}

function onVideoEmbed() {
  const raw = $("#videoInput").value || "";
  const parsed = parseVideoUrl(raw);
  if (parsed.error) return toast(parsed.error);

  addHistory(parsed.url);
  clearVideo();
  embedPage(parsed.url);
}

function onVideoOpen() {
  const raw = $("#videoInput").value || "";
  const parsed = parseVideoUrl(raw);
  if (parsed.error) return toast(parsed.error);

  addHistory(parsed.url);
  window.open(parsed.url, "_blank", "noopener,noreferrer");
}

// --------------------
// Wire up
// --------------------
window.addEventListener("DOMContentLoaded", () => {
  // tabs
  $("#tabImages").addEventListener("click", () => setTab("images"));
  $("#tabYoutube").addEventListener("click", () => setTab("youtube"));
  $("#tabVideo").addEventListener("click", () => setTab("video"));
  $("#tabHistory").addEventListener("click", () => setTab("history"));

  // images
  $("#btnLoadImages").addEventListener("click", loadImages);
  $("#urlInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadImages();
  });

  // youtube
  $("#ytLoad").addEventListener("click", loadYoutube);
  $("#ytInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadYoutube();
  });

  // video
  $("#videoLoad").addEventListener("click", onVideoLoad);
  $("#videoDetect").addEventListener("click", onVideoDetect);
  $("#videoEmbed").addEventListener("click", onVideoEmbed);
  $("#videoOpen").addEventListener("click", onVideoOpen);
  $("#videoClear").addEventListener("click", () => {
    clearVideo();
    $("#videoInput").value = "";
    toast("Cleared");
  });

  renderHistory();
  setTab("images");
});
