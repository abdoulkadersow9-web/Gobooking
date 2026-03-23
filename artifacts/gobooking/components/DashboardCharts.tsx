import React, { useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarChart, LineChart } from "react-native-chart-kit";

const SCREEN_W = Dimensions.get("window").width;
const CHART_W  = Math.min(SCREEN_W - 32, 420); // padding 16 each side
const CHART_H  = 200;

const PRIMARY = "#0B3C5D";
const ACCENT  = "#FF6B00";
const GREEN   = "#059669";

interface DailyPoint {
  date: string;
  count: number;
  revenue: number;
}

interface Props {
  dailyBookings: DailyPoint[];
  accentColor?: string;
  showRevenue?: boolean;
}

const SHORT_DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function toLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return SHORT_DAYS[d.getDay()];
  } catch {
    return dateStr.slice(5);
  }
}

type ChartType = "reservations" | "revenus";

export default function DashboardCharts({
  dailyBookings,
  accentColor = ACCENT,
  showRevenue = true,
}: Props) {
  const [active, setActive] = useState<ChartType>("reservations");

  if (!dailyBookings || dailyBookings.length === 0) return null;

  /* Take last 7 days */
  const slice = dailyBookings.slice(-7);
  const labels = slice.map((d) => toLabel(d.date));

  const bookingData = {
    labels,
    datasets: [{ data: slice.map((d) => d.count) }],
  };

  const revenueData = {
    labels,
    datasets: [{ data: slice.map((d) => Math.round(d.revenue / 1000)) }], // en milliers
  };

  /* ── shared chart config ── */
  const chartConfig = (color: string) => ({
    backgroundColor: PRIMARY,
    backgroundGradientFrom: PRIMARY,
    backgroundGradientTo: "#072D47",
    decimalPlaces: 0,
    color: () => color,
    labelColor: () => "rgba(255,255,255,0.7)",
    style: { borderRadius: 16 },
    propsForDots: {
      r: "5",
      strokeWidth: "2",
      stroke: color,
    },
    propsForBackgroundLines: {
      stroke: "rgba(255,255,255,0.08)",
    },
  });

  /* ── tabs ── */
  const tabs: { key: ChartType; label: string; color: string }[] = [
    { key: "reservations", label: "Réservations", color: accentColor },
    ...(showRevenue
      ? [{ key: "revenus" as ChartType, label: "Revenus (k FCFA)", color: GREEN }]
      : []),
  ];

  const activeTab = tabs.find((t) => t.key === active)!;

  /* summary metrics */
  const totalBookings = slice.reduce((s, d) => s + d.count, 0);
  const totalRevenue  = slice.reduce((s, d) => s + d.revenue, 0);
  const avgBookings   = Math.round(totalBookings / slice.length);

  return (
    <View style={S.wrapper}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.title}>Activité — 7 derniers jours</Text>
      </View>

      {/* Tab selector */}
      <View style={S.tabs}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[S.tab, active === t.key && { borderBottomColor: t.color, borderBottomWidth: 2 }]}
            onPress={() => setActive(t.key)}
          >
            <Text style={[S.tabTxt, active === t.key && { color: t.color, fontWeight: "700" }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Chart */}
      <View style={S.chartWrap}>
        {active === "reservations" ? (
          <LineChart
            data={bookingData}
            width={CHART_W}
            height={CHART_H}
            chartConfig={chartConfig(accentColor)}
            bezier
            style={S.chart}
            withInnerLines={true}
            withOuterLines={false}
            fromZero
            yAxisSuffix=""
          />
        ) : (
          <BarChart
            data={revenueData}
            width={CHART_W}
            height={CHART_H}
            chartConfig={chartConfig(GREEN)}
            style={S.chart}
            withInnerLines={true}
            fromZero
            yAxisSuffix="k"
            yAxisLabel=""
            showValuesOnTopOfBars
          />
        )}
      </View>

      {/* Summary chips */}
      <View style={S.chips}>
        <View style={[S.chip, { borderColor: accentColor + "44" }]}>
          <Text style={[S.chipVal, { color: accentColor }]}>{totalBookings}</Text>
          <Text style={S.chipLbl}>Réservations</Text>
        </View>
        <View style={[S.chip, { borderColor: "#05996944" }]}>
          <Text style={[S.chipVal, { color: GREEN }]}>{avgBookings}/j</Text>
          <Text style={S.chipLbl}>Moyenne/jour</Text>
        </View>
        {showRevenue && (
          <View style={[S.chip, { borderColor: "#0891b244" }]}>
            <Text style={[S.chipVal, { color: "#0891b2" }]}>
              {(totalRevenue / 1_000_000).toFixed(1)} M
            </Text>
            <Text style={S.chipLbl}>FCFA revenus</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  wrapper:   { backgroundColor: "white", borderRadius: 20, overflow: "hidden",
               shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10,
               shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  header:    { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  title:     { fontSize: 15, fontWeight: "700", color: PRIMARY },
  tabs:      { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
               marginHorizontal: 16 },
  tab:       { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2,
               borderBottomColor: "transparent" },
  tabTxt:    { fontSize: 13, color: "#6b7280" },
  chartWrap: { alignItems: "center", paddingTop: 12 },
  chart:     { borderRadius: 16 },
  chips:     { flexDirection: "row", padding: 16, gap: 10 },
  chip:      { flex: 1, backgroundColor: "#fafafa", borderRadius: 12, padding: 10,
               alignItems: "center", borderWidth: 1 },
  chipVal:   { fontSize: 16, fontWeight: "800" },
  chipLbl:   { fontSize: 11, color: "#6b7280", marginTop: 2, textAlign: "center" },
});
