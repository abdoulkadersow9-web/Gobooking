import React, { useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

/* ── constants ─────────────────────────────────────────────── */
const W = Math.min(Dimensions.get("window").width - 32, 420);
const H = 180;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;
const INNER_W = W - PAD_L - PAD_R;
const INNER_H = H - PAD_T - PAD_B;

const PRIMARY = "#0B3C5D";
const GREEN   = "#059669";

interface DailyPoint { date: string; count: number; revenue: number }
interface Props {
  dailyBookings: DailyPoint[];
  accentColor?: string;
  showRevenue?: boolean;
}

type ChartMode = "reservations" | "revenus";

const SHORT_DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
function toLabel(s: string) {
  try { return SHORT_DAYS[new Date(s).getDay()]; } catch { return s.slice(5); }
}

/* ── helpers ────────────────────────────────────────────────── */
function scaleX(i: number, total: number) {
  return PAD_L + (i / (total - 1)) * INNER_W;
}
function scaleY(v: number, max: number) {
  return PAD_T + INNER_H - (v / (max || 1)) * INNER_H;
}

function linePath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur  = pts[i];
    const cpx  = (prev.x + cur.x) / 2;
    d += ` C${cpx.toFixed(1)},${prev.y.toFixed(1)} ${cpx.toFixed(1)},${cur.y.toFixed(1)} ${cur.x.toFixed(1)},${cur.y.toFixed(1)}`;
  }
  return d;
}

/* ── LineChart component ───────────────────────────────────── */
function LineChartSvg({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({ x: scaleX(i, data.length), y: scaleY(v, max) }));
  const path = smoothPath(pts);

  /* filled area */
  const areaPath =
    path +
    ` L${pts[pts.length - 1].x.toFixed(1)},${(PAD_T + INNER_H).toFixed(1)}` +
    ` L${pts[0].x.toFixed(1)},${(PAD_T + INNER_H).toFixed(1)} Z`;

  /* Y grid lines */
  const ticks = 4;
  const gridYs = Array.from({ length: ticks + 1 }, (_, i) => ({
    y: PAD_T + (i / ticks) * INNER_H,
    label: Math.round(max - (i / ticks) * max),
  }));

  return (
    <Svg width={W} height={H}>
      <Defs>
        <SvgGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0.02" />
        </SvgGradient>
      </Defs>

      {/* Grid */}
      {gridYs.map((g, i) => (
        <React.Fragment key={i}>
          <Line
            x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y}
            stroke="rgba(255,255,255,0.07)" strokeWidth={1}
          />
          <SvgText
            x={PAD_L - 4} y={g.y + 4}
            fontSize={9} fill="rgba(255,255,255,0.45)"
            textAnchor="end"
          >
            {g.label >= 1000 ? `${(g.label / 1000).toFixed(0)}k` : g.label}
          </SvgText>
        </React.Fragment>
      ))}

      {/* X axis */}
      <Line x1={PAD_L} y1={PAD_T + INNER_H} x2={W - PAD_R} y2={PAD_T + INNER_H}
        stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

      {/* Area fill */}
      <Path d={areaPath} fill="url(#lineArea)" />

      {/* Line */}
      <Path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />

      {/* Dots */}
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} stroke="#072D47" strokeWidth={1.5} />
      ))}
    </Svg>
  );
}

/* ── BarChart component ────────────────────────────────────── */
function BarChartSvg({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const barW = Math.max(4, (INNER_W / data.length) * 0.55);
  const gap  = INNER_W / data.length;

  const ticks = 4;
  const gridYs = Array.from({ length: ticks + 1 }, (_, i) => ({
    y: PAD_T + (i / ticks) * INNER_H,
    label: Math.round(max - (i / ticks) * max),
  }));

  return (
    <Svg width={W} height={H}>
      <Defs>
        <SvgGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor={color} stopOpacity="0.5" />
        </SvgGradient>
      </Defs>

      {gridYs.map((g, i) => (
        <React.Fragment key={i}>
          <Line
            x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y}
            stroke="rgba(255,255,255,0.07)" strokeWidth={1}
          />
          <SvgText
            x={PAD_L - 4} y={g.y + 4}
            fontSize={9} fill="rgba(255,255,255,0.45)"
            textAnchor="end"
          >
            {g.label >= 1000 ? `${(g.label / 1000).toFixed(0)}k` : g.label}
          </SvgText>
        </React.Fragment>
      ))}

      <Line x1={PAD_L} y1={PAD_T + INNER_H} x2={W - PAD_R} y2={PAD_T + INNER_H}
        stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

      {data.map((v, i) => {
        const bh = (v / max) * INNER_H;
        const bx = PAD_L + i * gap + (gap - barW) / 2;
        const by = PAD_T + INNER_H - bh;
        return (
          <Rect
            key={i}
            x={bx} y={by} width={barW} height={bh}
            rx={3} fill="url(#barGrad)"
          />
        );
      })}
    </Svg>
  );
}

/* ── X-axis labels ─────────────────────────────────────────── */
function XLabels({ labels, color }: { labels: string[]; color: string }) {
  return (
    <View style={[S.xLabels, { width: W }]}>
      {labels.map((l, i) => (
        <Text key={i} style={[S.xLabel, { color }]}>{l}</Text>
      ))}
    </View>
  );
}

/* ── Main export ────────────────────────────────────────────── */
export default function DashboardCharts({ dailyBookings, accentColor = "#FF6B00", showRevenue = true }: Props) {
  const [mode, setMode] = useState<ChartMode>("reservations");

  if (!dailyBookings?.length) return null;

  const slice   = dailyBookings.slice(-7);
  const labels  = slice.map((d) => toLabel(d.date));
  const counts  = slice.map((d) => d.count);
  const revs    = slice.map((d) => Math.round(d.revenue / 1000)); // k FCFA

  const totalBookings = counts.reduce((s, v) => s + v, 0);
  const totalRevenue  = slice.reduce((s, d) => s + d.revenue, 0);
  const avg           = Math.round(totalBookings / slice.length);

  const tabs: { key: ChartMode; label: string; color: string }[] = [
    { key: "reservations", label: "Réservations",    color: accentColor },
    ...(showRevenue ? [{ key: "revenus" as ChartMode, label: "Revenus (k FCFA)", color: GREEN }] : []),
  ];
  const activeTab = tabs.find((t) => t.key === mode)!;

  return (
    <View style={S.wrapper}>
      {/* Header */}
      <View style={S.header}>
        <Text style={S.title}>Activité — 7 derniers jours</Text>
      </View>

      {/* Tabs */}
      <View style={S.tabs}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[S.tab, mode === t.key && { borderBottomColor: t.color, borderBottomWidth: 2 }]}
            onPress={() => setMode(t.key)}
          >
            <Text style={[S.tabTxt, mode === t.key && { color: t.color, fontWeight: "700" }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Chart on dark bg */}
      <View style={S.chartBg}>
        {mode === "reservations" ? (
          <LineChartSvg data={counts} color={accentColor} />
        ) : (
          <BarChartSvg data={revs} color={GREEN} />
        )}
        <XLabels labels={labels} color="rgba(255,255,255,0.5)" />
      </View>

      {/* Summary chips */}
      <View style={S.chips}>
        <View style={[S.chip, { borderColor: accentColor + "44" }]}>
          <Text style={[S.chipVal, { color: accentColor }]}>{totalBookings}</Text>
          <Text style={S.chipLbl}>Réservations</Text>
        </View>
        <View style={[S.chip, { borderColor: "#05996944" }]}>
          <Text style={[S.chipVal, { color: GREEN }]}>{avg}/j</Text>
          <Text style={S.chipLbl}>Moy. / jour</Text>
        </View>
        {showRevenue && (
          <View style={[S.chip, { borderColor: "#0891b244" }]}>
            <Text style={[S.chipVal, { color: "#0891b2" }]}>
              {(totalRevenue / 1_000_000).toFixed(1)} M
            </Text>
            <Text style={S.chipLbl}>FCFA</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  wrapper:  { backgroundColor: "white", borderRadius: 20, overflow: "hidden",
              shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  header:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  title:    { fontSize: 15, fontWeight: "700", color: PRIMARY },
  tabs:     { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
              marginHorizontal: 16 },
  tab:      { flex: 1, paddingVertical: 10, alignItems: "center",
              borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabTxt:   { fontSize: 13, color: "#6b7280" },
  chartBg:  { backgroundColor: "#072D47", marginHorizontal: 0 },
  xLabels:  { flexDirection: "row", justifyContent: "space-between",
              paddingHorizontal: PAD_L, paddingBottom: 8, backgroundColor: "#072D47" },
  xLabel:   { fontSize: 9, textAlign: "center" },
  chips:    { flexDirection: "row", padding: 12, gap: 10 },
  chip:     { flex: 1, backgroundColor: "#fafafa", borderRadius: 12, padding: 10,
              alignItems: "center", borderWidth: 1 },
  chipVal:  { fontSize: 16, fontWeight: "800" },
  chipLbl:  { fontSize: 11, color: "#6b7280", marginTop: 2, textAlign: "center" },
});
