import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const PRIMARY = "#0B3C5D";
const ACCENT  = "#FF6B00";

interface Trip {
  id: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  price: number;
  available_seats: number;
  total_seats: number;
  status: string;
}

export default function EntrepriseTrajets() {
  const { token } = useAuth();
  const [trips, setTrips]   = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Trip[]>("/company/trips", { token: token ?? undefined })
      .then(setTrips)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const occupancy = (t: Trip) =>
    Math.round(((t.total_seats - t.available_seats) / t.total_seats) * 100);

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <Pressable onPress={() => router.replace("/dashboard/company")} style={S.backBtn}>
          <Text style={S.backTxt}>←</Text>
        </Pressable>
        <Text style={S.title}>Trajets</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : trips.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyTxt}>Aucun trajet programmé</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const pct = occupancy(item);
            return (
              <View style={S.card}>
                <View style={S.cardRow}>
                  <Text style={S.route}>
                    {item.departure_city} → {item.arrival_city}
                  </Text>
                  <Text style={S.price}>{item.price.toLocaleString()} FCFA</Text>
                </View>
                <Text style={S.date}>
                  {new Date(item.departure_time).toLocaleDateString("fr-FR", {
                    weekday: "short", day: "2-digit", month: "short",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </Text>
                <View style={S.occRow}>
                  <Text style={S.occTxt}>
                    {item.total_seats - item.available_seats}/{item.total_seats} places
                  </Text>
                  <Text style={[S.occPct, { color: pct > 80 ? "#16a34a" : ACCENT }]}>
                    {pct}%
                  </Text>
                </View>
                <View style={S.bar}>
                  <View style={[S.barFill, { width: `${pct}%` as any,
                    backgroundColor: pct > 80 ? "#16a34a" : ACCENT }]} />
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: "#F8FAFC" },
  header:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: PRIMARY },
  backBtn: { padding: 4 },
  backTxt: { fontSize: 22, color: "white" },
  title:   { fontSize: 20, fontWeight: "700", color: "white" },
  empty:   { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyTxt:{ color: "#6b7280", fontSize: 16 },
  card:    { backgroundColor: "white", borderRadius: 12, padding: 16, gap: 10, elevation: 2,
             shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  route:   { fontSize: 16, fontWeight: "700", color: PRIMARY },
  price:   { fontSize: 15, fontWeight: "700", color: ACCENT },
  date:    { fontSize: 13, color: "#6b7280" },
  occRow:  { flexDirection: "row", justifyContent: "space-between" },
  occTxt:  { fontSize: 13, color: "#374151" },
  occPct:  { fontSize: 13, fontWeight: "700" },
  bar:     { height: 6, backgroundColor: "#e5e7eb", borderRadius: 99, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 99 },
});
