import { Platform } from "react-native";

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return { r, g, b };
}

export function shadow(
  hex: string,
  opacity: number,
  radius: number,
  y: number,
  elevation = 8,
): object {
  if (Platform.OS === "web") {
    const { r, g, b } = hexToRgb(hex);
    return { boxShadow: `0 ${y}px ${radius}px rgba(${r},${g},${b},${opacity})` };
  }
  return {
    shadowColor: hex,
    shadowOffset: { width: 0, height: y },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
}

export const S = {
  card:    shadow("#1650D0", 0.10, 26,  8, 8),
  cardSm:  shadow("#1650D0", 0.08, 18,  5, 5),
  cardLg:  shadow("#1650D0", 0.12, 34, 12, 10),
  btn:     shadow("#1650D0", 0.22, 14,  6, 6),
  orange:  shadow("#F97316", 0.40, 18,  8, 8),
  pill:    shadow("#1650D0", 0.38, 14,  5, 9),
  dark:    shadow("#000000", 0.22, 24, 10, 10),
};
