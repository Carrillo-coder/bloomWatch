// client/src/components/VigorIndicator.jsx
import { useEffect, useState } from "react";
import { Box, Typography, LinearProgress } from "@mui/material";

// Thresholds for vigor visual (bar)
const NDVI_THRESHOLDS = {
  high: 0.6,
  medium: 0.3,
};

// Visual (not stage): how to display the NDVI value as “High/Medium/Low”
function interpretNDVI(value) {
  if (value >= NDVI_THRESHOLDS.high) {
    return { level: "High", color: "success", description: "The plants at this point look very healthy and vigorous." };
  }
  if (value >= NDVI_THRESHOLDS.medium) {
    return { level: "Medium", color: "warning", description: "The vigor is moderate. Monitoring is recommended." };
  }
  return { level: "Low", color: "error", description: "Signs of stress or little vegetation. Requires attention." };
}

// === Stage heuristic (current + prediction) without showing curve ===
function analyzeNDVI(series = [], crop = "general", daysAhead = 7) {
  if (!Array.isArray(series) || series.length < 5) {
    return {
      now:  { status: "Not enough data", hint: "Not enough observations yet to estimate phase." },
      next: { status: "Not enough data", hint: "Try again with a larger range or a different point." },
      meta: { points: series.length, confidence: 0.2 }
    };
  }

  // sort by date
  const s = [...series].sort((a, b) => a.date.localeCompare(b.date));

  // smoothing window 3
  const smooth = s.map((p, i) => {
    const w = s.slice(Math.max(0, i - 1), Math.min(s.length, i + 2));
    const avg = w.reduce((acc, x) => acc + (x.ndvi ?? 0), 0) / w.length;
    return { date: p.date, ndvi: avg };
  });

  const last = smooth[smooth.length - 1].ndvi;

  // recent slope (last 3–4 steps ~16d)
  const recent = smooth.slice(-4);
  const slopes = [];
  for (let i = 1; i < recent.length; i++) {
    slopes.push((recent[i].ndvi ?? 0) - (recent[i - 1].ndvi ?? 0));
  }
  const slopeRecent = slopes.length ? slopes.reduce((a, b) => a + b, 0) / slopes.length : 0;

  // peak in window ~120d
  const cutoffIdx = Math.max(0, smooth.length - Math.ceil(120 / 16));
  const win = smooth.slice(cutoffIdx);
  const peak = win.reduce((best, p) => (p.ndvi > best.ndvi ? p : best), { ndvi: -Infinity });
  const peakNDVI = peak.ndvi > 0 ? peak.ndvi : Math.max(...smooth.map(p => p.ndvi));

  // thresholds
  const TH_RISE = 0.03;   // strong rise per step (~16d)
  const TH_NEAR = 0.9;    // near the peak

  function classify(ndviValue, slopeAvg, peakRef) {
    if (Math.abs(slopeAvg) < 0.015 && ndviValue >= TH_NEAR * peakRef) return "Flowering";
    if (slopeAvg > TH_RISE)                                          return "Pre-flowering";
    if (ndviValue < TH_NEAR * peakRef && slopeAvg <= 0)              return "Post-flowering";
    return "Stable vegetation";
  }

  const statusNow = classify(last, slopeRecent, peakNDVI);

  // Simple prediction +7 days (interpolating the ~16d step)
  const steps = daysAhead / 16;
  const ndviNext = last + slopeRecent * steps;
  const statusNext = classify(ndviNext, slopeRecent, Math.max(peakNDVI, ndviNext));

  // hints by crop
  const HINTS = {
    apple: {
      "Pre-flowering": "Rise in progress; prepare hives 7–10 days before the peak.",
      "Flowering": "Near the peak; avoid practices that harm pollinators.",
      "Post-flowering": "After the peak; monitor for early pests and vegetative vigor.",
      "Stable vegetation": "No major changes; check weekly."
    },
    walnut: {
      "Pre-flowering": "Rise detected; light irrigation if there is a deficit and prepare management.",
      "Flowering": "Minimize actions that affect bees; validate in the field.",
      "Post-flowering": "Enter vegetative management and watch for water stress.",
      "Stable vegetation": "Monitoring recommended; no clear signs yet."
    },
    cotton: {
      "Pre-flowering": "Align tasks before the peak; intensify monitoring.",
      "Flowering": "Avoid applications that affect pollinators; observe retention.",
      "Post-flowering": "Adjust management according to observed vigor.",
      "Stable vegetation": "Monitor weekly until signs are seen."
    },
    corn: {
      "Pre-flowering": "Rise; prepare fertilization/monitoring logistics.",
      "Flowering": "Minimize stress; prioritize field observation.",
      "Post-flowering": "Adjust vegetative management according to vigor.",
      "Stable vegetation": "No strong signs yet; continue monitoring."
    },
    alfalfa: {
      "Pre-flowering": "Rise; prepare cutting/monitoring according to local management.",
      "Flowering": "Avoid practices that affect pollinators; validate in the field.",
      "Post-flowering": "Plan post-flowering management.",
      "Stable vegetation": "Keep observing; no notable changes."
    },
    general: {
      "Pre-flowering": "Rise observed; prepare pre-peak logistics.",
      "Flowering": "Near the peak; minimize actions that affect pollinators.",
      "Post-flowering": "After the peak; focus on vegetative management.",
      "Stable vegetation": "No major changes; keep observing."
    }
  };
  const dict = HINTS[crop] || HINTS.general;

  // simple confidence
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
        const resp = await fetch(`/api/ndvi/point?${qs}`); // use Vite's proxy
        const json = await resp.json();

        if (!resp.ok) throw new Error(json?.error || "Could not get vigor data.");
        if (cancelled) return;

        if (json.warning) setWarning(String(json.warning));

        const points = Array.isArray(json.points) ? json.points : [];
        if (points.length === 0) {
          setVigor(null);
          onAnalysis?.({
            now: { status: "No data", hint: "There are no observations for this range." },
            next: { status: "No data", hint: "Not enough observations to predict." },
            meta: { points: 0, confidence: 0 }
          });
          return;
        }

        // most recent NDVI value for the vigor bar
        const latestPoint = points[points.length - 1];
        const latestNDVI  = latestPoint.ndvi;
        const interpreted = interpretNDVI(latestNDVI);

        setVigor({
          ...interpreted,
          value: latestNDVI,
          date: latestPoint.date,
        });

        // current stage + 7-day prediction
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
  // Important: we DO NOT include onAnalysis in deps to avoid repolls
  }, [lat, lon, start, end, product, crop]);

  // Stable container (avoids visual jumps)
  return (
    <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>Crop Health (Vigor)</Typography>

      {loading && <Typography variant="body2">Calculating crop health…</Typography>}

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
          No vigor data to display.
        </Typography>
      )}

      {!error && !loading && vigor && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
            <Typography variant="h5" component="div" color={`${vigor.color}.main`}>
              {vigor.level}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              (Value: {vigor.value.toFixed(2)} on {vigor.date})
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