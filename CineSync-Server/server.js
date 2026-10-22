/**
 * CineSync API Server — versión cloud (Render/Railway/any Node host)
 * Keys se leen de Firebase (persisten para siempre, gestionadas desde la app)
 */
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const FIREBASE_URL = "https://abby-cdb30-default-rtdb.firebaseio.com";
const MASTER_SECRET = process.env.MASTER_SECRET || "cinesync_panel_admin_2026";

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Firebase: leer contenido y keys (endpoints públicos)
// ---------------------------------------------------------------------------
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Cache de keys (se refresca cada 30s o en cada request si no hay cache)
let keysCache = null;
let keysCacheTime = 0;
const KEYS_CACHE_TTL = 30_000;

async function getApiKeys() {
  const now = Date.now();
  if (keysCache && now - keysCacheTime < KEYS_CACHE_TTL) return keysCache;
  try {
    const data = await fetchJson(`${FIREBASE_URL}/config/api_server/keys.json`);
    keysCache = data || {};
    keysCacheTime = now;
    return keysCache;
  } catch { return keysCache || {}; }
}

async function getMovies() {
  const data = await fetchJson(`${FIREBASE_URL}/peliculas.json`);
  if (!data) return [];
  return Object.entries(data)
    .filter(([, m]) => m.published === true || m.published === "true")
    .map(([id, m]) => ({
      id, type: "movie",
      title: m.title || "", originalTitle: m.originalTitle || "",
      overview: m.overview || "", year: m.releaseYear || 0,
      durationMinutes: m.durationMinutes || 0, rating: m.rating || 0,
      director: m.director || "", actors: m.actors || "",
      category: m.category || "", categories: m.categories || [],
      country: m.country || "", classification: m.classification || "",
      posterUrl: m.posterUrl || "", bannerUrl: m.bannerUrl || "",
      status: m.status || ""
    }));
}

async function getSeries(filterType) {
  const data = await fetchJson(`${FIREBASE_URL}/series.json`);
  if (!data) return [];
  return Object.entries(data)
    .filter(([, s]) => s.published === true || s.published === "true")
    .filter(([, s]) => !filterType || (s.contentType || "").toLowerCase() === filterType)
    .map(([id, s]) => {
      const episodes = [];
      (s.seasons || []).forEach((season) => {
        (season.episodes || []).forEach((ep) => {
          episodes.push({
            season: season.seasonNumber || 1,
            episode: ep.episodeNumber || 0,
            title: ep.title || "",
            hasStream: !!(ep.servers && ep.servers.some(srv => srv.streamUrl))
          });
        });
      });
      return {
        id, type: (s.contentType === "anime") ? "anime" : "series",
        title: s.title || "", originalTitle: s.originalTitle || "",
        overview: s.overview || "", year: s.releaseYear || 0,
        rating: s.rating || 0, director: s.director || "",
        actors: s.actors || "", category: s.category || "",
        categories: s.categories || [], country: s.country || "",
        classification: s.classification || "",
        posterUrl: s.posterUrl || "", bannerUrl: s.bannerUrl || "",
        status: s.status || "", totalEpisodes: s.totalEpisodes || episodes.length,
        seasons: (s.seasons || []).map(se => ({
          number: se.seasonNumber || 1, title: se.title || "",
          episodeCount: (se.episodes || []).length
        })),
        episodeList: episodes
      };
    });
}

async function getContentById(id) {
  let data = await fetchJson(`${FIREBASE_URL}/peliculas/${id}.json`).catch(() => null);
  if (data && (data.published === true || data.published === "true")) return { source: "movie", data };
  data = await fetchJson(`${FIREBASE_URL}/series/${id}.json`).catch(() => null);
  if (data && (data.published === true || data.published === "true")) return { source: "series", data };
  return null;
}

// ---------------------------------------------------------------------------
// Middleware de autenticación
// ---------------------------------------------------------------------------
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const apiKey = authHeader.replace("Bearer ", "").trim() || req.query.key || req.query.api_key || "";
  if (!apiKey) return res.status(401).json({ ok: false, error: "API key requerida." });

  getApiKeys().then(keys => {
    let found = null;
    for (const [id, data] of Object.entries(keys)) {
      if (data && data.key === apiKey && data.active !== false) { found = data; break; }
    }
    if (!found) return res.status(401).json({ ok: false, error: "API key inválida o revocada." });
    if (found.expiresAt && found.expiresAt < Date.now()) return res.status(401).json({ ok: false, error: "API key expirada." });

    req.apiKeyType = found.type || "basic";
    req.apiKeyName = found.name || "";
    next();
  }).catch(() => res.status(500).json({ ok: false, error: "Error validando key." }));
}

function requireKeyType(...allowed) {
  return (req, res, next) => {
    if (req.apiKeyType === "full" || allowed.includes(req.apiKeyType)) next();
    else res.status(403).json({ ok: false, error: `Key tipo '${req.apiKeyType}' sin acceso. Se requiere: ${allowed.join(", ")} o full.` });
  };
}

// ---------------------------------------------------------------------------
// ENDPOINTS
// ---------------------------------------------------------------------------
app.get("/v1/health", (req, res) => {
  res.json({ ok: true, service: "CineSync API", version: "1.2.0", time: new Date().toISOString() });
});

app.get("/v1/catalog", authenticate, async (req, res) => {
  try {
    const [movies, series] = await Promise.all([getMovies(), getSeries()]);
    res.json({ ok: true, total: movies.length + series.length, movies: movies.length, series: series.filter(s => s.type === "series").length, anime: series.filter(s => s.type === "anime").length, content: [...movies, ...series] });
  } catch { res.status(500).json({ ok: false, error: "Error leyendo el catálogo." }); }
});

app.get("/v1/catalog/movies", authenticate, async (req, res) => {
  try { const m = await getMovies(); res.json({ ok: true, total: m.length, content: m }); }
  catch { res.status(500).json({ ok: false, error: "Error interno." }); }
});

app.get("/v1/catalog/series", authenticate, async (req, res) => {
  try { const s = await getSeries("series"); res.json({ ok: true, total: s.length, content: s }); }
  catch { res.status(500).json({ ok: false, error: "Error interno." }); }
});

app.get("/v1/catalog/anime", authenticate, async (req, res) => {
  try { const a = await getSeries("anime"); res.json({ ok: true, total: a.length, content: a }); }
  catch { res.status(500).json({ ok: false, error: "Error interno." }); }
});

app.get("/v1/content/:id", authenticate, async (req, res) => {
  try {
    const result = await getContentById(req.params.id);
    if (!result) return res.status(404).json({ ok: false, error: "No encontrado." });
    if (result.source === "movie") res.json({ ok: true, content: { id: req.params.id, type: "movie", ...result.data } });
    else res.json({ ok: true, content: { id: req.params.id, type: "series", ...result.data } });
  } catch { res.status(500).json({ ok: false, error: "Error interno." }); }
});

app.get("/v1/content/:id/stream", authenticate, requireKeyType("streaming"), async (req, res) => {
  try {
    const result = await getContentById(req.params.id);
    if (!result) return res.status(404).json({ ok: false, error: "No encontrado." });
    if (result.source === "movie") {
      const servers = (result.data.servers || [])
        .map((s, i) => ({ serverIndex: i, serverName: s.serverName || `Servidor ${i+1}`, streamUrl: s.streamUrl || "" }))
        .filter(s => s.streamUrl);
      return res.json({ ok: true, type: "movie", servers });
    }
    const episodes = [];
    (result.data.seasons || []).forEach((season) => {
      (season.episodes || []).forEach((ep) => {
        const servers = (ep.servers || [])
          .map((s, i) => ({ serverIndex: i, streamUrl: s.streamUrl || "" }))
          .filter(s => s.streamUrl);
        if (servers.length > 0) episodes.push({ season: season.seasonNumber || 1, episode: ep.episodeNumber || 0, title: ep.title || "", servers });
      });
    });
    res.json({ ok: true, type: "series", episodes });
  } catch { res.status(500).json({ ok: false, error: "Error interno." }); }
});

app.get("/v1/content/:id/subtitles", authenticate, requireKeyType("subtitles"), async (req, res) => {
  try {
    const result = await getContentById(req.params.id);
    if (!result) return res.status(404).json({ ok: false, error: "No encontrado." });
    if (result.source === "movie") {
      const subs = (result.data.servers || []).flatMap(s => s.subtitles || []).filter(s => s.vttUrl);
      return res.json({ ok: true, type: "movie", subtitles: subs });
    }
    const episodes = [];
    (result.data.seasons || []).forEach((season) => {
      (season.episodes || []).forEach((ep) => {
        const subs = (ep.servers || []).flatMap(s => s.subtitles || []).filter(s => s.vttUrl);
        if (subs.length > 0) episodes.push({ season: season.seasonNumber || 1, episode: ep.episodeNumber || 0, subtitles: subs });
      });
    });
    res.json({ ok: true, type: "series", episodes });
  } catch { res.status(500).json({ ok: false, error: "Error interno." }); }
});

app.get("/v1/content/:id/images", authenticate, async (req, res) => {
  try {
    const result = await getContentById(req.params.id);
    if (!result) return res.status(404).json({ ok: false, error: "No encontrado." });
    res.json({ ok: true, images: { poster: result.data.posterUrl || "", banner: result.data.bannerUrl || "", thumbnail: result.data.thumbnailUrl || "" } });
  } catch { res.status(500).json({ ok: false, error: "Error interno." }); }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CineSync API v1.2.0 corriendo en puerto ${PORT}`);
});
