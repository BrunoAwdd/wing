export const buildBarChartSvg = (
  labels: string[],
  values: number[],
  colors: string[],
  title: string
): string => {
  const escapeSvgText = (value: string): string =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const shortLabel = (value: string): string => {
    const trimmed = value.trim();
    return trimmed.length > 18 ? `${trimmed.slice(0, 15)}...` : trimmed;
  };

  const width = 400;
  const height = 260;
  const barAreaHeight = 180;
  const safeLabels = labels.length > 0 ? labels.slice(0, 8) : ["Valor"];
  const safeValues = safeLabels.map((_, index) => {
    const value = Number(values[index] ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  const count = Math.max(1, safeLabels.length);
  const gap = count > 5 ? 14 : 24;
  const barWidth = Math.min(80, (width - gap * (count + 1)) / count);
  const maxValue = Math.max(1, ...safeValues);
  const totalWidth = barWidth * count + gap * (count - 1);
  const startX = (width - totalWidth) / 2;

  const bars = safeLabels
    .map((label, i) => {
      const value = safeValues[i] ?? 0;
      const barHeight = (value / maxValue) * barAreaHeight;
      const x = startX + i * (barWidth + gap);
      const y = 20 + (barAreaHeight - barHeight);
      const color = colors[i % Math.max(1, colors.length)] || "#2563EB";

      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="4" />
        <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="16" font-family="Segoe UI, sans-serif" font-weight="bold">${value}</text>
        <text x="${x + barWidth / 2}" y="${20 + barAreaHeight + 24}" text-anchor="middle" font-size="11" font-family="Segoe UI, sans-serif">${escapeSvgText(shortLabel(label))}</text>
      `;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <text x="${width / 2}" y="16" text-anchor="middle" font-size="16" font-family="Segoe UI, sans-serif" font-weight="bold">${escapeSvgText(title)}</text>
      ${bars}
    </svg>
  `;
};

export const svgToPngBase64 = (svg: string, width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const svgBase64 = btoa(unescape(encodeURIComponent(svg)));
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Não foi possível obter o contexto do canvas."));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/png");
      resolve(dataUrl.replace(/^data:image\/png;base64,/, ""));
    };

    image.onerror = () => reject(new Error("Falha ao renderizar o gráfico."));
    image.src = `data:image/svg+xml;base64,${svgBase64}`;
  });
};
