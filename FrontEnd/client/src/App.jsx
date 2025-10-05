// client/src/App.jsx
import { useState, useCallback } from "react";
import MapView from "./components/MapView";
import PopupIntro from "./components/PopupIntro";
import VigorIndicator from "./components/VigorIndicator";

import {
  Box,
  Typography,
  MenuItem,
  TextField,
  Slider,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Chip,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import dayjs from "dayjs";
// Ya no usamos estimateBloomStatus basado en fecha
// import { estimateBloomStatus } from "./lib/heuristics";
import { parseGlobeCSV } from "./lib/csvParser"; // Ajusta si tu archivo se llama distinto (csvParsear.js)
import "./App.css";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#9400d3" },
    background: { paper: "rgba(40, 40, 50, 0.8)" },
    success: { main: "#2e7d32" },
    warning: { main: "#ed6c02" },
    error: { main: "#d32f2f" },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            "& fieldset": { borderColor: "rgba(255, 255, 255, 0.5)" },
            "&:hover fieldset": { borderColor: "#ffffff" },
            "&.Mui-focused fieldset": { borderColor: "#9400d3" },
          },
        },
      },
    },
  },
});

const REGIONS = [
  "Delicias (walnut/alfalfa)",
  "Cuauhtémoc (apple)",
  "Valle de Juárez (corn/cotton)",
  "Camargo",
];

const REGION_CROP_MAP = {
  "Delicias (walnut/alfalfa)": "walnut",
  "Cuauhtémoc (apple)": "apple",
  "Valle de Juárez (corn/cotton)": "cotton",
  Camargo: "walnut",
};

// Chip visual según etapa
const stageChipProps = (status) => {
  switch ((status || "").toLowerCase()) {
    case "pre-floración":
    case "prefloración":
    case "pre floración":
      return { label: "Pre-floración", color: "warning", variant: "filled" };
    case "floración":
      return { label: "Floración", color: "success", variant: "filled" };
    case "post-floración":
    case "postfloración":
    case "post floración":
      return { label: "Post-floración", color: "error", variant: "filled" };
    case "vegetación estable":
      return { label: "Estable", color: "default", variant: "filled" };
    case "sin datos":
    case "sin datos suficientes":
      return { label: "Sin datos", color: "default", variant: "outlined" };
    default:
      return { label: status || "—", color: "default", variant: "outlined" };
  }
};

export default function App() {
  // ===== Estado principal =====
  const [region, setRegion] = useState(REGIONS[2]);
  const [daysBack, setDaysBack] = useState(180);
  const [globePoints, setGlobePoints] = useState([]);
  const [crop, setCrop] = useState("apple");
  const [linkCropToRegion, setLinkCropToRegion] = useState(true);
  const [mapCenter, setMapCenter] = useState(null); // Estado para manejar el centro del mapa

  // Punto clicado en el mapa
  const [clickedPoint, setClickedPoint] = useState(null); // { lat, lon }

  // Popup de ayuda
  const [showIntro, setShowIntro] = useState(true);

  // Resultado del análisis (actual + predicción) que envía VigorIndicator
  const [analysis, setAnalysis] = useState(null);

  // Fechas para la foto satelital y la serie NDVI (visual vs cálculo)
  const dateISO = dayjs().subtract(daysBack, "day").format("YYYY-MM-DD");
  const startSeries = dayjs().subtract(daysBack, "day").format("YYYY-MM-DD");
  const endSeries = dayjs().format("YYYY-MM-DD");

  // Mantener estable la función que recibe el análisis (evita repolls)
  const handleAnalysis = useCallback((a) => setAnalysis(a), []);

  // ===== Handlers =====
  const handleRegionChange = (event) => {
    const newRegion = event.target.value;
    setRegion(newRegion);
    if (linkCropToRegion) {
      setCrop(REGION_CROP_MAP[newRegion] || "nogal");
    }
  };

  const handleCropChange = (event) => {
    setCrop(event.target.value);
  };

  const handleCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseGlobeCSV(text);
    setGlobePoints(rows);
    alert(`Cargados ${rows.length} puntos de validación (GLOBE)`);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      {showIntro && <PopupIntro onClose={() => setShowIntro(false)} />}

      <div className="app-container">
        <IconButton
          aria-label="Ayuda"
          onClick={() => setShowIntro(true)}
          style={{ position: "fixed", top: 10, right: 18, zIndex: 10000, background: "#fff" }}
        >
          <HelpOutlineIcon style={{ color: "#388e3c", fontSize: 32 }} />
        </IconButton>

        <video autoPlay loop muted className="background-video">
          <source src="/videos/earth-bg.mp4" type="video/mp4" />
          Tu navegador no soporta videos.
        </video>

        <header className="app-header">
          <Typography variant="h4">Bloom-it</Typography>
        </header>

        <main className="main-content">
          {/* Panel izquierdo: mapa y selector de fecha */}
          <section className="left-panel">
            <MapView
              selectedRegion={region}
              dateISO={dateISO}
              globePoints={globePoints}
              onMapClick={(lat, lon) => setClickedPoint({ lat, lon })}
              mapCenter={mapCenter} // Pasar el centro del mapa al componente
            />

            <div className="date-slider-container">
              <Typography variant="body2" align="center" gutterBottom>
                Fecha de la Foto Satelital: {dateISO}
              </Typography>
              <Slider
                value={daysBack}
                onChange={(_, v) => setDaysBack(v)}
                min={0}
                max={365 * 2}
                valueLabelFormat={(v) => `-${v} días`}
                valueLabelDisplay="auto"
              />
            </div>
          </section>

          {/* Panel central: análisis de vigor (NDVI real, sin curva) */}
          <section className="middle-panel">
            {!clickedPoint ? (
              <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2, height: "100%" }}>
                <Typography variant="h6" gutterBottom>
                  Vigor Analysis
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Select a point on the map to see the crop health analysis based on NDVI
                  data.
                </Typography>
              </Box>
            ) : (
              <VigorIndicator
                lat={clickedPoint.lat}
                lon={clickedPoint.lon}
                start={startSeries}
                end={endSeries}
                crop={crop}
                onAnalysis={handleAnalysis} // función estable
              />
            )}
          </section>

          {/* Panel derecho: información y controles */}
          <section className="right-panel">
            <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2 }}>
              <Typography variant="h6">Crop type: {crop.toUpperCase()}</Typography>
            </Box>

            {/* Etapa actual con Chip */}
            <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2 }}>
              <Typography
                variant="h6"
                sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
              >
                Current Stage:
                <Chip {...stageChipProps(analysis?.now?.status)} size="small" />
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {analysis?.now?.hint ?? "Choose a point on the map to see the current stage."}
              </Typography>
            </Box>

            {/* Predicción +7 días con Chip */}
            <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2 }}>
              <Typography
                variant="h6"
                sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}
              >
                Prediction (+7 days):
                <Chip {...stageChipProps(analysis?.next?.status)} size="small" />
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {analysis?.next?.hint ?? "No prediction available."}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, display: "block", mt: 1 }}>
                confidence:{" "}
                {analysis?.meta?.confidence != null
                  ? Math.round(analysis.meta.confidence * 100)
                  : 0}
                %
                {" · "}observations used: {analysis?.meta?.points ?? 0}
              </Typography>
            </Box>

            {/* Controles */}
            <div className="control-box">
              <TextField
                select
                label="Agricultural Region"
                value={region}
                onChange={handleRegionChange}
              >
                {REGIONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Crop Type"
                value={crop}
                onChange={handleCropChange}
                disabled={linkCropToRegion}
              >
                {Object.keys(REGION_CROP_MAP)
                  .map((key) => (
                    <MenuItem key={REGION_CROP_MAP[key]} value={REGION_CROP_MAP[key]}>
                      {REGION_CROP_MAP[key].charAt(0).toUpperCase() +
                        REGION_CROP_MAP[key].slice(1)}
                    </MenuItem>
                  ))
                  .filter(
                    (item, index, self) =>
                      self.findIndex((t) => t.props.value === item.props.value) === index
                  )}
              </TextField>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={linkCropToRegion}
                    onChange={(e) => setLinkCropToRegion(e.target.checked)}
                    sx={{ color: "rgba(255, 255, 255, 0.7)", "&.Mui-checked": { color: "#9400d3" } }}
                  />
                }
                label="Sugest crop type based on the region"
              />

              <Button variant="outlined" component="label">
                Load CSV (GLOBE)
                <input hidden type="file" accept=".csv" onChange={handleCSV} />
              </Button>

              <Button
                variant="contained"
                color="primary"
                style={{ marginTop: "10px" }}
                onClick={() => setMapCenter({ lat: 28.674, lng: -106.079, zoom: 12 })}
              >
                Use my coordinates
              </Button>
            </div>
          </section>
        </main>
      </div>
    </ThemeProvider>
  );
}
