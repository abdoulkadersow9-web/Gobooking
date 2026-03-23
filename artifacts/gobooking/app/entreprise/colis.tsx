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

interface Parcel {
  id: string;
  tracking_code: string;
  sender_name: string;
  recipient_name: string;
  departure_city: string;
  arrival_city: string;
  status: string;
  price: number;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending:    "En attente",
  in_transit: "En transit",
  delivered:  "Livré",
  cancelled:  "Annulé",
};
const STATUS_COLORS: Record<string, string> = {
  pending:    ACCENT,
  in_transit: "#2563eb",
  delivered:  "#16a34a",
  cancelled:  "#dc2626",
};

export default function EntrepriseColis() {
  const { token } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Parcel[]>("/company/parcels", { token: token ?? undefined })
      .then(setParcels)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <Pressable onPress={() => router.replace("/dashboard/company")} style={S.backBtn}>
          <Text style={S.backTxt}>←</Text>
        </Pressable>
        <Text style={S.title}>Colis</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : parcels.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyTxt}>Aucun colis enregistré</Text>
        </View>
      ) : (
        <FlatList
          data={parcels}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const color = STATUS_COLORS[item.status] ?? "#6b7280";
            return (
              <View style={S.card}>
                <View style={S.cardRow}>
                  <Text style={S.tracking}># {item.tracking_code}</Text>
                  <View style={[S.badge, { backgroundColor: color + "22" }]}>
                    <Text style={[S.badgeTxt, { color }]}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>
                <Text style={S.route}>
                  {item.departure_city} → {item.arrival_city}
                </Text>
                <View style={S.cardRow}>
                  <Text style={S.names}>
                    {item.sender_name} → {item.recipient_name}
                  </Text>
                  <Text style={S.price}>{item.price.toLocaleString()} FCFA</Text>
                </View>
                <Text style={S.date}>
                  {new Date(item.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: "#F8FAFC" },
  header:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: PRIMARY },
  backBtn:  { padding: 4 },
  backTxt:  { fontSize: 22, color: "white" },
  title:    { fontSize: 20, fontWeight: "700", color: "white" },
  empty:    { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyTxt: { color: "#6b7280", fontSize: 16 },
  card:     { backgroundColor: "white", borderRadius: 12, padding: 16, gap: 8, elevation: 2,
              shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tracking: { fontSize: 13, fontWeight: "700", color: PRIMARY, fontFamily: "monospace" },
  route:    { fontSize: 15, fontWeight: "700", color: "#111827" },
  names:    { fontSize: 13, color: "#6b7280", flex: 1 },
  price:    { fontSize: 14, fontWeight: "700", color: ACCENT },
  date:     { fontSize: 12, color: "#9ca3af" },
  badge:    { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt: { fontSize: 12, fontWeight: "600" },
});
