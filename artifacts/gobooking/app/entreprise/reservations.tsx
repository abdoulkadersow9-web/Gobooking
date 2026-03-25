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

interface Booking {
  id: string;
  passenger_name: string;
  departure_city: string;
  arrival_city: string;
  departure_time: string;
  status: string;
  total_price: number;
}

export default function EntrepriseReservations() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    apiFetch<Booking[]>("/company/bookings", { token: token ?? undefined })
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const statusColor = (s: string) =>
    s === "confirmed" ? "#16a34a" : s === "pending" ? ACCENT : "#6b7280";
  const statusLabel = (s: string) =>
    s === "confirmed" ? "Confirmé" : s === "pending" ? "En attente" : s;

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <Pressable onPress={() => router.replace("/dashboard/company")} style={S.backBtn}>
          <Text style={S.backTxt}>←</Text>
        </Pressable>
        <Text style={S.title}>Réservations</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : bookings.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyTxt}>Aucune réservation</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View style={S.card}>
              <View style={S.cardRow}>
                <Text style={S.route}>
                  {item.departure_city} → {item.arrival_city}
                </Text>
                <View style={[S.badge, { backgroundColor: statusColor(item.status) + "22" }]}>
                  <Text style={[S.badgeTxt, { color: statusColor(item.status) }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <Text style={S.passenger}>{item.passenger_name}</Text>
              <View style={S.cardRow}>
                <Text style={S.date}>
                  {item.departure_time
                    ? new Date(item.departure_time).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })
                    : "—"}
                </Text>
                <Text style={S.price}>{(item.total_price ?? 0).toLocaleString()} FCFA</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: "#F8FAFC" },
  header:    { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: PRIMARY },
  backBtn:   { padding: 4 },
  backTxt:   { fontSize: 22, color: "white" },
  title:     { fontSize: 20, fontWeight: "700", color: "white" },
  empty:     { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyTxt:  { color: "#6b7280", fontSize: 16 },
  card:      { backgroundColor: "white", borderRadius: 12, padding: 16, gap: 8, elevation: 2,
               shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  route:     { fontSize: 16, fontWeight: "700", color: PRIMARY },
  passenger: { fontSize: 14, color: "#374151" },
  date:      { fontSize: 13, color: "#6b7280" },
  price:     { fontSize: 14, fontWeight: "700", color: ACCENT },
  badge:     { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt:  { fontSize: 12, fontWeight: "600" },
});
