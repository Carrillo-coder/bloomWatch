
import { useEffect, useState } from "react";
import { Box, Typography, LinearProgress } from "@mui/material";

// Estos umbrales definen qué es un NDVI bajo, medio o alto.
// Son un punto de partida y pueden ajustarse.
const NDVI_THRESHOLDS = {
  high: 0.6,
  medium: 0.3,
};

// Función para interpretar el valor de NDVI
function interpretNDVI(value) {
  if (value >= NDVI_THRESHOLDS.high) {
    return {
      level: "Alto",
      color: "success", // Verde
      description: "Las plantas en este punto se ven muy saludables y vigorosas.",
    };
  }
  if (value >= NDVI_THRESHOLDS.medium) {
    return {
      level: "Medio",
      color: "warning", // Ámbar
      description: "El vigor de las plantas es moderado. Se recomienda monitorear.",
    };
  }
  return {
    level: "Bajo",
    color: "error", // Rojo
    description: "Las plantas muestran signos de estrés o hay poca vegetación. Requiere atención.",
  };
}

export default function VigorIndicator({ lat, lon, start, end, product = "MYD13Q1.061" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vigor, setVigor] = useState(null); // Aquí guardaremos el resultado interpretado

  useEffect(() => {
    if (lat == null || lon == null || !start || !end) return;
    let cancelled = false;

    async function fetchAndInterpretNDVI() {
      try {
        setLoading(true);
        setError("");
        setVigor(null);

        const qs = new URLSearchParams({
          lat: String(lat),
          lon: String(lon),
          start,
          end,
          product,
        }).toString();

        const resp = await fetch(`http://127.0.0.1:4000/api/ndvi/point?${qs}`);
        const json = await resp.json();

        if (!resp.ok) throw new Error(json?.error || "No se pudieron obtener los datos de vigor.");
        if (cancelled) return;

        if (json.points && json.points.length > 0) {
          // Tomamos el valor de NDVI más reciente
          const latestPoint = json.points[json.points.length - 1];
          const latestNDVI = latestPoint.ndvi;
          
          // "Traducimos" el valor numérico a algo entendible
          const interpretation = interpretNDVI(latestNDVI);
          setVigor({
            ...interpretation,
            value: latestNDVI,
            date: latestPoint.date,
          });

        } else {
          setWarning("No se encontraron datos de vigor para este punto y rango de fechas.");
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAndInterpretNDVI();
    return () => {
      cancelled = true;
    };
  }, [lat, lon, start, end, product]);

  // --- Renderizado del componente ---
  if (loading) {
    return <Typography variant="body2">Calculando salud del cultivo...</Typography>;
  }

  if (error) {
    return <Typography variant="body2" color="error">❌ {error}</Typography>;
  }

  if (!vigor) {
    return <Typography variant="body2" sx={{ opacity: 0.8 }}>No hay datos de vigor para mostrar.</Typography>;
  }

  // El valor de NDVI (0 a 1) se multiplica por 100 para usarlo en la barra de progreso
  const progressValue = vigor.value * 100;

  return (
    <Box sx={{ p: 2, bgcolor: "#191970", borderRadius: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Salud del Cultivo (Vigor)
      </Typography>
      
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Typography variant="h5" component="div" color={`${vigor.color}.main`}>
          {vigor.level}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          (Valor: {vigor.value.toFixed(2)} el {vigor.date})
        </Typography>
      </Box>

      <LinearProgress variant="determinate" value={progressValue} color={vigor.color} sx={{ height: 10, borderRadius: 5 }} />
      
      <Typography variant="body2" sx={{ mt: 2, opacity: 0.9 }}>
        {vigor.description}
      </Typography>
    </Box>
  );
}
