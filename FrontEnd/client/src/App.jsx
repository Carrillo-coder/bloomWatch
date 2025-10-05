// client/src/App.jsx
import { useState } from "react";
import MapView from "./components/MapView";
import PopupIntro from "./components/PopupIntro";
import { IconButton } from "@mui/material";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
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
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import dayjs from "dayjs";
import { estimateBloomStatus } from "./lib/heuristics";
import { parseGlobeCSV } from "./lib/csvParser";
import "./App.css";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#9400d3" },
    background: { paper: "rgba(40, 40, 50, 0.8)" },
    // Colores para el indicador de vigor
    success: { main: "#2e7d32" }, // Verde
    warning: { main: "#ed6c02" }, // Ámbar
    error: { main: "#d32f2f" },   // Rojo
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
  "Delicias (nogal/alfalfa)",
  "Cuauhtémoc (manzana)",
  "Valle de Juárez (maíz/algodón)",
  "Camargo",
];

const REGION_CROP_MAP = {
  "Delicias (nogal/alfalfa)": "nogal",
  "Cuauhtémoc (manzana)": "manzana",
  "Valle de Juárez (maíz/algodón)": "algodon",
  Camargo: "nogal",
};

export default function App() {
  // ===== Estado principal =====
  const [region, setRegion] = useState(REGIONS[2]);
  const [daysBack, setDaysBack] = useState(180);
  const [globePoints, setGlobePoints] = useState([]);
  const [crop, setCrop] = useState("manzana");
  const [linkCropToRegion, setLinkCropToRegion] = useState(true);

  // Punto clicado en el mapa
  const [clickedPoint, setClickedPoint] = useState(null); // { lat, lon }

  // Estado para mostrar el popup
  const [showIntro, setShowIntro] = useState(true);

  // Fechas para la foto satelital y la serie de datos
  const dateISO = dayjs().subtract(daysBack, "day").format("YYYY-MM-DD");
  const startSeries = dayjs().subtract(daysBack, "day").format("YYYY-MM-DD");
  const endSeries = dayjs().format("YYYY-MM-DD");

  // Estimación de la etapa del cultivo
  const bloomEstimation = estimateBloomStatus(dateISO, crop);

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
          style={{ position: "fixed", top: 18, right: 18, zIndex: 10000, background: "#fff" }}
        >
          <HelpOutlineIcon style={{ color: "#388e3c", fontSize: 32 }} />
        </IconButton>
        <video autoPlay loop muted className="background-video">
          <source src="/videos/earth-bg.mp4" type="video/mp4" />
          Tu navegador no soporta videos.
        </video>

        <header className="app-header">
          <Typography variant="h4">BloomScape Agro</Typography>
        </header>

        <main className="main-content">
          {/* Panel izquierdo: mapa y selector de fecha */}
          <section className="left-panel">
            <MapView
              selectedRegion={region}
              dateISO={dateISO}
              globePoints={globePoints}
              onMapClick={(lat, lon) => setClickedPoint({ lat, lon })}
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

          {/* Panel central: análisis de vigor */}
          <section className="middle-panel">
            {!clickedPoint ? (
              <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Análisis de Vigor
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Toca un punto en el mapa para analizar el vigor del cultivo en esa ubicación.
                </Typography>
              </Box>
            ) : (
              <VigorIndicator
                lat={clickedPoint.lat}
                lon={clickedPoint.lon}
                start={startSeries}
                end={endSeries}
              />
            )}
          </section>

          {/* Panel derecho: información y controles */}
          <section className="right-panel">
            <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2 }}>
              <Typography variant="h6">Tipo de Cultivo: {crop.toUpperCase()}</Typography>
            </Box>

            <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2 }}>
              <Typography variant="h6">
                Etapa del Cultivo: {bloomEstimation.status}
              </Typography>
            </Box>

            <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2 }}>
              <Typography variant="h6">Recomendación:</Typography>
              <Typography variant="body1">{bloomEstimation.hint}</Typography>
            </Box>

            {/* Controles */}
            <div className="control-box">
              <TextField
                select
                label="Zona Agrícola"
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
                label="Tipo de Cultivo"
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
                    sx={{
                      color: "rgba(255, 255, 255, 0.7)",
                      "&.Mui-checked": { color: "#9400d3" },
                    }}
                  />
                }
                label="Sugerir cultivo según zona"
              />

              <Button variant="outlined" component="label">
                Cargar CSV de Campo
                <input hidden type="file" accept=".csv" onChange={handleCSV} />
              </Button>
            </div>
          </section>
        </main>
      </div>
    </ThemeProvider>
  );
}