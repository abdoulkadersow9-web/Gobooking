export type SeatStatus = "available" | "reserved" | "occupied" | "sp" | "free" | "released";

export interface SeatColor {
  bg: string;
  border: string;
  text: string;
}

export const SEAT_COLORS: Record<string, SeatColor> = {
  available: { bg: "#F3F4F6", border: "#D1D5DB", text: "#374151" },
  free:      { bg: "#F3F4F6", border: "#D1D5DB", text: "#374151" },
  reserved:  { bg: "#FEF3C7", border: "#D97706", text: "#92400E" },
  occupied:  { bg: "#FEE2E2", border: "#DC2626", text: "#991B1B" },
  released:  { bg: "#DCFCE7", border: "#16A34A", text: "#15803D" },
  sp:        { bg: "#EDE9FE", border: "#7C3AED", text: "#6D28D9" },
  default:   { bg: "#F3F4F6", border: "#D1D5DB", text: "#374151" },
};

export function getSeatColor(status: string): SeatColor {
  return SEAT_COLORS[status] ?? SEAT_COLORS.default;
}

export const SEAT_LEGEND = [
  { status: "available", label: "Libre" },
  { status: "reserved",  label: "Réservé" },
  { status: "occupied",  label: "Vendu" },
  { status: "sp",        label: "SP" },
] as const;
