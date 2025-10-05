// client/src/components/VigorIndicator.jsx
import { useEffect, useState } from "react";
import { Box, Typography, LinearProgress } from "@mui/material";

// Umbrales para la visual de vigor (barra)
const NDVI_THRESHOLDS = {
  high: 0.6,
  medium: 0.3,
};

// Visual (no etapa): cómo mostrar el valor NDVI como “Alto/Medio/Bajo”
function interpretNDVI(value) {
  if (value >= NDVI_THRESHOLDS.high) {
    return { level: "Alto", color: "success", description: "Las plantas en este punto se ven muy saludables y vigorosas." };
  }
  if (value >= NDVI_THRESHOLDS.medium) {
    return { level: "Medio", color: "warning", description: "El vigor es moderado. Se recomienda monitorear." };
  }
  return { level: "Bajo", color: "error", description: "Signos de estrés o poca vegetación. Requiere atención." };
}

// === Heurística de etapa (actual + predicción) sin mostrar curva ===
function analyzeNDVI(series = [], crop = "general", daysAhead = 7) {
  if (!Array.isArray(series) || series.length < 5) {
    return {
      now:  { status: "Sin datos suficientes", hint: "Aún no hay suficientes observaciones para estimar fase." },
      next: { status: "Sin datos suficientes", hint: "Reintenta con un rango mayor o diferente punto." },
      meta: { points: series.length, confidence: 0.2 }
    };
  }

  // ordenar por fecha
  const s = [...series].sort((a, b) => a.date.localeCompare(b.date));

  // suavizado ventana 3
  const smooth = s.map((p, i) => {
    const w = s.slice(Math.max(0, i - 1), Math.min(s.length, i + 2));
    const avg = w.reduce((acc, x) => acc + (x.ndvi ?? 0), 0) / w.length;
    return { date: p.date, ndvi: avg };
  });

  const last = smooth[smooth.length - 1].ndvi;

  // pendiente reciente (últimos 3–4 pasos ~16d)
  const recent = smooth.slice(-4);
  const slopes = [];
  for (let i = 1; i < recent.length; i++) {
    slopes.push((recent[i].ndvi ?? 0) - (recent[i - 1].ndvi ?? 0));
  }
  const slopeRecent = slopes.length ? slopes.reduce((a, b) => a + b, 0) / slopes.length : 0;

  // pico en ventana ~120d
  const cutoffIdx = Math.max(0, smooth.length - Math.ceil(120 / 16));
  const win = smooth.slice(cutoffIdx);
  const peak = win.reduce((best, p) => (p.ndvi > best.ndvi ? p : best), { ndvi: -Infinity });
  const peakNDVI = peak.ndvi > 0 ? peak.ndvi : Math.max(...smooth.map(p => p.ndvi));

  // umbrales
  const TH_RISE = 0.03;   // subida fuerte por paso (~16d)
  const TH_NEAR = 0.9;    // cerca del pico

  function classify(ndviValue, slopeAvg, peakRef) {
    if (Math.abs(slopeAvg) < 0.015 && ndviValue >= TH_NEAR * peakRef) return "Floración";
    if (slopeAvg > TH_RISE)                                          return "Pre-floración";
    if (ndviValue < TH_NEAR * peakRef && slopeAvg <= 0)              return "Post-floración";
    return "Vegetación estable";
  }

  const statusNow = classify(last, slopeRecent, peakNDVI);

  // Predicción simple +7 días (interpolando el paso ~16d)
  const steps = daysAhead / 16;
  const ndviNext = last + slopeRecent * steps;
  const statusNext = classify(ndviNext, slopeRecent, Math.max(peakNDVI, ndviNext));

  // sugerencias por cultivo
  const HINTS = {
    manzana: {
      "Pre-floración": "Subida en curso; prepara colmenas 7–10 días antes del pico.",
      "Floración": "Cerca del pico; evita prácticas que perjudiquen polinizadores.",
      "Post-floración": "Tras el pico; monitorea plagas tempranas y vigor vegetativo.",
      "Vegetación estable": "Sin cambios fuertes; revisa semanalmente."
    },
    nogal: {
      "Pre-floración": "Subida detectada; riegos ligeros si hay déficit y prepara manejo.",
      "Floración": "Minimiza acciones que afecten abejas; valida en campo.",
      "Post-floración": "Entra a manejo vegetativo y cuida estrés hídrico.",
      "Vegetación estable": "Seguimiento recomendado; sin señales claras aún."
    },
    algodon: {
      "Pre-floración": "Alinea labores previas al pico; intensifica monitoreo.",
      "Floración": "Evita aplicaciones que afecten polinizadores; observa retención.",
      "Post-floración": "Ajusta manejo según vigor observado.",
      "Vegetación estable": "Monitorea semanalmente hasta ver señales."
    },
    maiz: {
      "Pre-floración": "Subida; prepara logística de fertilización/monitoreo.",
      "Floración": "Minimiza estrés; prioriza observación en campo.",
      "Post-floración": "Ajusta manejo vegetativo según vigor.",
      "Vegetación estable": "Sin señales fuertes aún; continúa seguimiento."
    },
    alfalfa: {
      "Pre-floración": "Subida; prepara corte/monitoreo según manejo local.",
      "Floración": "Evita prácticas que afecten polinizadores; valida en campo.",
      "Post-floración": "Planifica manejo posterior a floración.",
      "Vegetación estable": "Sigue observando; sin cambios notables."
    },
    general: {
      "Pre-floración": "Se observa subida; prepara logística previa al pico.",
      "Floración": "Cerca del pico; minimiza acciones que afecten polinizadores.",
      "Post-floración": "Tras el pico; enfoca manejo vegetativo.",
      "Vegetación estable": "Sin cambios fuertes; sigue observando."
    }
  };
  const dict = HINTS[crop] || HINTS.general;

  // confianza simple
  const trendStrength = Math.min(1, Math.abs(slopeRecent) / 0.06);
  const nearPeak = Math.min(1, last / (peakNDVI || 1));
  const confidence = Math.max(0.2, 0.3 * (series.length / 24) + 0.4 * trendStrength + 0.3 * nearPeak);

  return {
    now:  { status: statusNow,  hint: dict[statusNow]  || HINTS.general[statusNow]  },
    next: { status: statusNext, hint: dict[statusNext] || HINTS.general[statusNext] },
    meta: { points: series.length, slopeRecent, peakNDVI, last, ndviNext, confidence: Number(confidence.toFixed(2)) }
  };
}

export default function VigorIndicator({
  lat, lon, start, end,
  product = "MYD13Q1.061",
  crop = "general",
  onAnalysis
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [vigor, setVigor]     = useState(null); // { level, color, description, value, date }
  const [warning, setWarning] = useState("");

  useEffect(() => {
    if (lat == null || lon == null || !start || !end) return;
    let cancelled = false;

    async function fetchAndAnalyze() {
      try {
        setLoading(true);
        setError("");
        setWarning("");
        setVigor(null);

        const qs = new URLSearchParams({ lat: String(lat), lon: String(lon), start, end, product }).toString();
        const resp = await fetch(`/api/ndvi/point?${qs}`); // usa el proxy de Vite
        const json = await resp.json();

        if (!resp.ok) throw new Error(json?.error || "No se pudieron obtener los datos de vigor.");
        if (cancelled) return;

        if (json.warning) setWarning(String(json.warning));

        const points = Array.isArray(json.points) ? json.points : [];
        if (points.length === 0) {
          setVigor(null);
          onAnalysis?.({
            now: { status: "Sin datos", hint: "No hay observaciones para este rango." },
            next: { status: "Sin datos", hint: "Sin observaciones suficientes para predecir." },
            meta: { points: 0, confidence: 0 }
          });
          return;
        }

        // valor NDVI más reciente para la barra de vigor
        const latestPoint = points[points.length - 1];
        const latestNDVI  = latestPoint.ndvi;
        const interpreted = interpretNDVI(latestNDVI);

        setVigor({
          ...interpreted,
          value: latestNDVI,
          date: latestPoint.date,
        });

        // etapa actual + predicción a 7 días
        const analysis = analyzeNDVI(points, crop, 7);
        onAnalysis?.(analysis);

      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAndAnalyze();
    return () => { cancelled = true; };
  // Importante: NO incluimos onAnalysis en deps para evitar repolls
  }, [lat, lon, start, end, product, crop]);

  // Contenedor estable (evita saltos visuales)
  return (
    <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>Salud del Cultivo (Vigor)</Typography>

      {loading && <Typography variant="body2">Calculando salud del cultivo…</Typography>}

      {warning && !loading && (
        <Typography variant="caption" sx={{ color: "#ffd166", display: "block", mb: 1 }}>
          ⚠️ {warning}
        </Typography>
      )}

      {error && !loading && (
        <Typography variant="body2" color="error">❌ {error}</Typography>
      )}

      {!error && !loading && !vigor && (
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          No hay datos de vigor para mostrar.
        </Typography>
      )}

      {!error && !loading && vigor && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Typography variant="h5" component="div" color={`${vigor.color}.main`}>
              {vigor.level}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              (Valor: {vigor.value.toFixed(2)} el {vigor.date})
            </Typography>
          </Box>

          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, vigor.value * 100))}
            color={vigor.color}
            sx={{ height: 10, borderRadius: 5 }}
          />

          <Typography variant="body2" sx={{ mt: 2, opacity: 0.9 }}>
            {vigor.description}
          </Typography>
        </>
      )}
    </Box>
  );
}
