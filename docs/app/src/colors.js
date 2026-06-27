export const DEFAULT_COLOR = "#7dd3fc";
export const COLORS = [
  "#7dd3fc",
  "#f0abfc",
  "#fcd34d",
  "#86efac",
  "#fb7185",
  "#c4b5fd"
];

export function isValidHexColor(value) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value ?? ""));
}

export function normalizeHexColor(value, fallback = DEFAULT_COLOR) {
  const raw = String(value ?? "").trim();
  if (!isValidHexColor(raw)) {
    return fallback;
  }

  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return raw.toLowerCase();
}

export function mixHexColors(first, second) {
  const firstParts = hexToRgb(normalizeHexColor(first));
  const secondParts = hexToRgb(normalizeHexColor(second));
  return rgbToHex({
    r: Math.round((firstParts.r + secondParts.r) / 2),
    g: Math.round((firstParts.g + secondParts.g) / 2),
    b: Math.round((firstParts.b + secondParts.b) / 2)
  });
}

export function hslToHex(hue, saturation, lightness) {
  const h = ((Number(hue) % 360) + 360) % 360;
  const s = clamp(Number(saturation), 0, 100) / 100;
  const l = clamp(Number(lightness), 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = l - chroma / 2;
  const [r1, g1, b1] =
    segment < 1
      ? [chroma, x, 0]
      : segment < 2
        ? [x, chroma, 0]
        : segment < 3
          ? [0, chroma, x]
          : segment < 4
            ? [0, x, chroma]
            : segment < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return rgbToHex({
    r: Math.round((r1 + match) * 255),
    g: Math.round((g1 + match) * 255),
    b: Math.round((b1 + match) * 255)
  });
}

function hexToRgb(color) {
  const value = color.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, numeric));
}
