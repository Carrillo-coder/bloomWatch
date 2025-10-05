export const BLOOM_WINDOWS = {
  nogal:   { start: "03-05", end: "04-15" }, 
  manzana: { start: "03-15", end: "04-20" },
  algodon: { start: "05-15", end: "06-30" },
  maiz:    { start: "06-10", end: "07-10" },
  alfalfa: { start: "03-01", end: "04-10" }
};


export function estimateBloomStatus(date = new Date(), cropKey = "nogal") {
  const d = new Date(date);
  const y = d.getFullYear();
  const w = BLOOM_WINDOWS[cropKey];
  if (!w) return { status: "N/D", hint: "Sin ventana definida" };

  const mk = (mmdd) => new Date(`${y}-${mmdd}T00:00:00`);
  const start = mk(w.start);
  const end   = mk(w.end);

  if (d < start) return { status: "Pre-floración", hint: "Prepara colmenas / riego ligero" };
  if (d <= end)  return { status: "Floración",      hint: "Maximiza polinización / evita estrés" };
  return { status: "Post-floración",                hint: "Vigila plagas post-floración" };
}
