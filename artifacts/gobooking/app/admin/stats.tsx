import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const PURPLE = "#7C3AED";
const ACCENT = "#FF6B00";

interface Stats {
  total_users?: number;
  total_bookings?: number;
  total_revenue?: number;
  total_trips?: number;
  total_parcels?: number;
  total_companies?: number;
  bookings_today?: number;
  revenue_today?: number;
  active_trips?: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}

function StatCard({ label, value, icon, color = PURPLE }: StatCardProps) {
  return (
    <View style={[S.card, { borderLeftColor: color }]}>
      <Text style={S.cardIcon}>{icon}</Text>
      <View style={S.cardBody}>
        <Text style={[S.cardValue, { color }]}>{value}</Text>
        <Text style={S.cardLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function AdminStats() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Stats>("/admin/stats", { token: token ?? undefined })
      .then(setStats)
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, [token]);

  const fmt = (n?: number) =>
    n !== undefined ? n.toLocaleString("fr-FR") : "—";
  const fmtF = (n?: number) =>
    n !== undefined ? `${n.toLocaleString("fr-FR")} FCFA` : "—";

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <Pressable onPress={() => router.replace("/dashboard/super-admin")} style={S.backBtn}>
          <Text style={S.backTxt}>←</Text>
        </Pressable>
        <Text style={S.title}>Statistiques</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={PURPLE} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={S.body}>
          <Text style={S.section}>Aujourd'hui</Text>
          <StatCard label="Réservations du jour" value={fmt(stats?.bookings_today)} icon="🎫" color={ACCENT} />
          <StatCard label="Revenus du jour"       value={fmtF(stats?.revenue_today)} icon="💰" color="#16a34a" />
          <StatCard label="Trajets actifs"        value={fmt(stats?.active_trips)}   icon="🚌" color="#2563eb" />

          <Text style={[S.section, { marginTop: 20 }]}>Global</Text>
          <StatCard label="Utilisateurs"    value={fmt(stats?.total_users)}    icon="👥" />
          <StatCard label="Réservations"    value={fmt(stats?.total_bookings)}  icon="📋" />
          <StatCard label="Colis"           value={fmt(stats?.total_parcels)}   icon="📦" color="#0891b2" />
          <StatCard label="Compagnies"      value={fmt(stats?.total_companies)} icon="🏢" color="#7c3aed" />
          <StatCard label="Revenus totaux"  value={fmtF(stats?.total_revenue)}  icon="💵" color="#16a34a" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: "#F5F3FF" },
  header:    { backgroundColor: PURPLE, flexDirection: "row", alignItems: "center",
               gap: 12, padding: 16 },
  backBtn:   { padding: 4 },
  backTxt:   { fontSize: 22, color: "white" },
  title:     { fontSize: 20, fontWeight: "700", color: "white" },
  body:      { padding: 16, gap: 12, paddingBottom: 40 },
  section:   { fontSize: 14, fontWeight: "700", color: "#6b7280",
               textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  card:      { backgroundColor: "white", borderRadius: 12, padding: 16,
               flexDirection: "row", alignItems: "center", gap: 14,
               borderLeftWidth: 4, elevation: 2,
               shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6,
               shadowOffset: { width: 0, height: 2 } },
  cardIcon:  { fontSize: 28 },
  cardBody:  { flex: 1 },
  cardValue: { fontSize: 22, fontWeight: "800" },
  cardLabel: { fontSize: 13, color: "#6b7280", marginTop: 2 },
});
