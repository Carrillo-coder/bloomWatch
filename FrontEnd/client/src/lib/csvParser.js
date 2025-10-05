export function parseGlobeCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const latIdx = header.findIndex(h => /lat/.test(h));
  const lonIdx = header.findIndex(h => /lon|lng|long/.test(h));
  const dateIdx = header.findIndex(h => /date|fecha/.test(h));
  const colorIdx = header.findIndex(h => /color|bloom|flor|note|comentario/.test(h));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    if (cols[latIdx] && cols[lonIdx]) {
      rows.push({
        lat: Number(cols[latIdx]),
        lon: Number(cols[lonIdx]),
        date: cols[dateIdx] || "",
        color: cols[colorIdx] || "N/A",
      });
    }
  }
  return rows;
}