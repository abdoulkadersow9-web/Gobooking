export const Brand = {
  primary:      "#1650D0",
  primaryDark:  "#1030B4",
  primaryDeep:  "#0A1C84",
  primaryLight: "#EEF4FF",
  primaryBorder:"#D1DFF8",

  bg:           "#EDEEF5",
  bgCard:       "#FFFFFF",
  bgSection:    "#E8EAF4",

  success:      "#059669",
  successLight: "#ECFDF5",
  successDark:  "#065F46",

  warning:      "#D97706",
  warningLight: "#FFFBEB",

  error:        "#DC2626",
  errorLight:   "#FEF2F2",

  text:         "#0F172A",
  textSec:      "#475569",
  textMuted:    "#94A3B8",

  cardShadow: {
    shadowColor:  "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 22,
    elevation: 7,
  },

  cardShadowSm: {
    shadowColor:  "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold" as const,
    color: "#0F172A",
    letterSpacing: -0.3 as number,
    borderLeftWidth: 4,
    borderLeftColor: "#1650D0",
    paddingLeft: 10,
    marginBottom: 14,
  },

  gradientHeader: ["#1650D0", "#1030B4", "#0A1C84"] as [string, string, string],
  gradientGreen:  ["#059669", "#047857", "#065F46"] as [string, string, string],
  gradientOrange: ["#F97316", "#E05500"] as [string, string],
  gradientDark:   ["#0B1628", "#1E2D4A"] as [string, string],

  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 22,
    xxl: 28,
  },
};
