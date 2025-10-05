// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* =======================
   Config / Auth AppEEARS
   ======================= */
const APPEEARS_API = "https://appeears.earthdatacloud.nasa.gov/api";
const APPEEARS_USER = process.env.APPEEARS_USER || "";
const APPEEARS_PASS = process.env.APPEEARS_PASS || "";

let appeearsToken = null;
let appeearsTokenFetchedAt = 0;

// Login a AppEEARS con HTTP Basic Auth (usuario/contraseña EDL)
async function fetchAppeearsToken() {
  if (!APPEEARS_USER || !APPEEARS_PASS) {
    console.warn("[APPEEARS] Falta APPEEARS_USER/APPEEARS_PASS en .env");
    return null;
  }
  const resp = await axios.post(
    `${APPEEARS_API}/login`,
    null, // cuerpo vacío
    {
      auth: { username: APPEEARS_USER, password: APPEEARS_PASS },
      headers: { "Content-Length": 0, Accept: "application/json" },
      timeout: 30000,
    }
  );
  const token = resp?.data?.token;
  if (!token) throw new Error("No se recibió token de AppEEARS");
  appeearsToken = token;
  appeearsTokenFetchedAt = Date.now();
  console.log("[APPEEARS] token obtenido");
  return token;
}

// Devuelve token válido (relogin simple cada ~11h)
async function getAppeearsToken() {
  const MAX_AGE_MS = 11 * 60 * 60 * 1000;
  if (!appeearsToken || (Date.now() - appeearsTokenFetchedAt) > MAX_AGE_MS) {
    try {
      await fetchAppeearsToken();
    } catch (e) {
      console.error("[APPEEARS] login error:", e?.response?.status, e?.message);
      return null;
    }
  }
  return appeearsToken;
}

/* =======================
   Helpers
   ======================= */
function toMMDDYYYY(iso) {
  // 'YYYY-MM-DD' → 'MM-DD-YYYY'
  const [Y, M, D] = String(iso).split("-");
  return `${M}-${D}-${Y}`;
}

function buildDemoSeries(start, end, latN, lonN, mode = "demo", productUsed = "MYD13Q1.061") {
  const startD = new Date(start);
  const endD = new Date(end);
  const days = Math.max(1, Math.round((endD - startD) / (1000 * 3600 * 24)));
  const points = [];
  for (let i = 0; i <= days; i += 8) {
    const d = new Date(startD.getTime() + i * 24 * 3600 * 1000);
    const t = (i / days) * 2 * Math.PI;
    let ndvi = 0.3 + 0.25 * Math.sin(t + 0.6) + 0.05 * Math.cos(2 * t);
    ndvi = Math.max(0, Math.min(0.9, ndvi + (Math.random() - 0.5) * 0.03));
    points.push({ date: d.toISOString().slice(0, 10), ndvi: Number(ndvi.toFixed(3)) });
  }
  return { points, meta: { mode, lat: latN, lon: lonN, start, end, product: productUsed } };
}

/* =======================
   Healthcheck
   ======================= */
app.get("/api/health", async (_, res) => {
  res.json({
    ok: true,
    service: "blooms-agro",
    time: new Date().toISOString(),
    appeearsCredsConfigured: !!(APPEEARS_USER && APPEEARS_PASS),
    appeearsTokenCached: !!appeearsToken
  });
});

/* =======================
   NDVI por punto (AppEEARS)
   ======================= */
let ndviActiveRequests = 0;
const NDVI_MAX_CONCURRENT = 1;

app.get("/api/ndvi/point", async (req, res) => {
  const step = (name, extra = {}) => console.log(`[APPEEARS] ${name}`, extra);

  if (ndviActiveRequests >= NDVI_MAX_CONCURRENT) {
    return res.status(429).json({ error: `Máximo de ${NDVI_MAX_CONCURRENT} peticiones NDVI concurrentes alcanzado. Intenta nuevamente en unos segundos.` });
  }
  ndviActiveRequests++;
  try {
    const { lat, lon, start, end } = req.query;
    const userProduct = (req.query.product || "").toString().trim();

    const latN = Number(lat), lonN = Number(lon);
    if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
      ndviActiveRequests--;
      return res.status(400).json({ error: "lat/lon inválidos" });
    }
    if (!start || !end) {
      ndviActiveRequests--;
      return res.status(400).json({ error: "start/end requeridos" });
    }

    // Producto por defecto (puedes pasarlo por query ?product=)
    const PRODUCT = userProduct || "MYD13Q1.061";

    // *** Opción 1: capa NDVI fija para MYD13Q1.061 ***
    // Este nombre viene exactamente como lo expone AppEEARS:
    // clave "_250m_16_days_NDVI" (con guion bajo inicial)
    let NDVI_LAYER = "_250m_16_days_NDVI";
    // Si cambias de producto en el futuro, tendrás que ajustar el nombre de capa.

    const demo = (mode) => buildDemoSeries(start, end, latN, lonN, mode, PRODUCT);

    // 1) token de AppEEARS
    const token = await getAppeearsToken();
    if (!token) {
      console.warn("[APPEEARS] sin token, devolviendo DEMO");
      return res.json(demo("demo"));
    }

    // 2) Fechas y payload (MM-DD-YYYY, coordinates como objetos)
    const startMDY = toMMDDYYYY(start);
    const endMDY   = toMMDDYYYY(end);

    const taskPayload = {
      task_type: "point",
      task_name: `ndvi_timeseries_${Date.now()}`,
      params: {
        dates: [{ startDate: startMDY, endDate: endMDY }],
        layers: [{ product: PRODUCT, layer: NDVI_LAYER }],  // ← capa exacta
        coordinates: [{ latitude: latN, longitude: lonN }],
        output: { format: "csv" }
      }
    };

    // 3) Crear tarea
    step("POST /task", { product: PRODUCT, layer: NDVI_LAYER });
    const create = await axios.post(`${APPEEARS_API}/task`, taskPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      timeout: 60000
    });
    const taskId = create?.data?.task_id;
    if (!taskId) throw new Error("No se obtuvo task_id de AppEEARS");
    step("task created", { taskId });

    // 4) Poll estado
    let status = "pending";
    let tries = 0;
    while (status !== "done" && tries < 60) {
      await new Promise((r) => setTimeout(r, 4000));
      const st = await axios.get(`${APPEEARS_API}/task/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      });
      status = st?.data?.status || status;
      step("status", { status, tries });
      if (status === "failed") throw new Error("Tarea AppEEARS falló");
      tries++;
    }
    if (status !== "done") throw new Error("Timeout esperando AppEEARS");

    // 5) Bundle → CSV
    step("GET /bundle/:taskId");
    const bundle = await axios.get(`${APPEEARS_API}/bundle/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const files = bundle?.data?.files || [];
    const csvFile = files.find((f) => /csv$/i.test(f.file_name));
    step("bundle files", { count: files.length, csv: !!csvFile });
    if (!csvFile) throw new Error("No se encontró CSV en bundle");

    step("GET /bundle/:taskId/:file_id");
    const csvResp = await axios.get(`${APPEEARS_API}/bundle/${taskId}/${csvFile.file_id}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "text",
      timeout: 120000
    });

    // 6) Parsear CSV (Date + NDVI)
    const text = String(csvResp.data);
    const lines = text.split(/\r?\n/).filter(Boolean);
    const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
    const dIdx = header.findIndex((h) => /date|time/.test(h));
    const vIdx = header.findIndex((h) => /ndvi/.test(h));

    const points = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((s) => s.trim());
      if (cols[dIdx] && cols[vIdx]) {
        const val = Number(cols[vIdx]);
        if (Number.isFinite(val)) points.push({ date: cols[dIdx].slice(0, 10), ndvi: val });
      }
    }
    step("parsed points", { n: points.length });

    return res.json({
      points,
      meta: { mode: "appeears", lat: latN, lon: lonN, start, end, product: PRODUCT, layer: NDVI_LAYER }
    });

  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error("AppEEARS error", status, data);

    // Mantén la app viva con demo si hay 401/403/400
    if (status === 401 || status === 403 || status === 400) {
      const { lat, lon, start, end } = req.query;
      const productUsed = (req.query.product || "").toString().trim() || "MYD13Q1.061";
      const latN = Number(lat), lonN = Number(lon);
      ndviActiveRequests--;
      return res.json({
        ...buildDemoSeries(start, end, latN, lonN, "fallback_demo", productUsed),
        warning: `AppEEARS ${status}: ${data?.message || "verifica EULA/capa/fechas"}`,
        appeearsError: data || null
      });
    }

    return res.status(500).json({ error: "NDVI service error", detail: err.message, status, data });
  }
  finally {
    ndviActiveRequests--;
  }
});

/* =======================
   Arranque
   ======================= */
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, async () => {
  console.log(`Server up on http://${HOST}:${PORT}`);
  if (APPEEARS_USER && APPEEARS_PASS) {
    try {
      await fetchAppeearsToken();
    } catch (e) {
      console.error("[APPEEARS] No se pudo iniciar sesión al arranque:", e?.response?.status, e?.message);
    }
  } else {
    console.warn("[APPEEARS] Sin APPEEARS_USER/APPEEARS_PASS configurados");
  }
});
