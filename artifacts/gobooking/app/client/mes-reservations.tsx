import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";
import { openWhatsApp, WA_TEMPLATES } from "@/utils/whatsapp";

const PRIMARY = "#1A56DB";
const AMBER   = "#D97706";

interface Booking {
  id: string;
  bookingRef: string;
  trip: {
    from: string;
    to: string;
    departureTime: string;
    date: string;
    busName: string;
  } | null;
  seatNumbers: string[];
  totalAmount: number;
  contactPhone?: string;
  status: "pending" | "confirmed" | "boarded" | "cancelled" | "completed";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  createdAt: string;
}

type DisplayState = "en_attente" | "confirmé" | "payé" | "embarqué" | "annulé";

function computeState(b: Booking): DisplayState {
  if (b.status === "cancelled") return "annulé";
  if (b.status === "boarded" || b.status === "completed") return "embarqué";
  if (b.status === "confirmed" && b.paymentStatus === "paid") return "payé";
  if (b.status === "confirmed") return "confirmé";
  return "en_attente";
}

const STATE: Record<DisplayState, { color: string; bg: string; label: string; icon: string }> = {
  en_attente: { color: "#B45309", bg: "#FFFBEB", label: "En attente",  icon: "clock"        },
  confirmé:   { color: "#0B3C5D", bg: "#E0F2FE", label: "Confirmé",   icon: "check"        },
  payé:       { color: "#047857", bg: "#ECFDF5", label: "Payé",       icon: "check-circle" },
  embarqué:   { color: "#6D28D9", bg: "#F5F3FF", label: "Embarqué",   icon: "user-check"   },
  annulé:     { color: "#DC2626", bg: "#FEF2F2", label: "Annulé",     icon: "x-circle"     },
};

function BookingCard({ item }: { item: Booking }) {
  const state = computeState(item);
  const cfg   = STATE[state];
  const trip  = item.trip;

  return (
    <Pressable
      style={S.card}
      onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/booking/[id]", params: { id: item.id } }); }}
    >
      <View style={S.cardTop}>
        <View style={S.routeWrap}>
          <Text style={S.routeFrom} numberOfLines={1}>{trip?.from ?? "—"}</Text>
          <Feather name="arrow-right" size={14} color="#94A3B8" style={{ marginHorizontal: 4 }} />
          <Text style={S.routeTo} numberOfLines={1}>{trip?.to ?? "—"}</Text>
        </View>
        <View style={[S.badge, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon as any} size={11} color={cfg.color} />
          <Text style={[S.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={S.cardMid}>
        <View style={S.metaItem}>
          <Feather name="calendar" size={13} color="#94A3B8" />
          <Text style={S.metaText}>{trip?.date ?? "—"} · {trip?.departureTime ?? ""}</Text>
        </View>
        {item.seatNumbers?.length > 0 && (
          <View style={S.metaItem}>
            <Feather name="tag" size={13} color="#94A3B8" />
            <Text style={S.metaText}>Siège(s) : {item.seatNumbers.join(", ")}</Text>
          </View>
        )}
      </View>

      <View style={S.cardBot}>
        <Text style={S.ref}>#{item.bookingRef}</Text>
        <Text style={S.amount}>{item.totalAmount.toLocaleString("fr-CI")} FCFA</Text>
      </View>

      {/* WhatsApp share */}
      <Pressable
        style={({ pressed }) => [S.waBtn, pressed && { opacity: 0.85 }]}
        onPress={(e) => {
          e.stopPropagation?.();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const phone = item.contactPhone ?? "";
          if (!phone) return;
          openWhatsApp(phone, WA_TEMPLATES.reservationConfirmee({
            clientName: "vous",
            bookingRef: item.bookingRef,
            from: trip?.from ?? "",
            to: trip?.to ?? "",
            date: trip?.date ?? "",
            heure: trip?.departureTime ?? "",
            montant: item.totalAmount,
          }));
        }}
      >
        <Feather name="message-circle" size={16} color="#25D366" />
        <Text style={S.waBtnText}>Partager sur WhatsApp</Text>
      </Pressable>
    </Pressable>
  );
}

export default function MesReservationsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const data = await apiFetch<Booking[]>("/bookings", { token: token ?? undefined });
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[mes-reservations] erreur:", err);
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      <LinearGradient colors={[PRIMARY, "#0F3BA0"]} style={S.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/bookings")} style={S.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Mes Réservations</Text>
          <Text style={S.headerSub}>{bookings.length} réservation{bookings.length !== 1 ? "s" : ""}</Text>
        </View>
        <Pressable onPress={onRefresh} style={S.refreshBtn}>
          <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </LinearGradient>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={S.loadTxt}>Chargement de vos réservations…</Text>
        </View>
      ) : bookings.length === 0 ? (
        <View style={S.center}>
          <View style={S.emptyIcon}>
            <Feather name="calendar" size={36} color="#CBD5E1" />
          </View>
          <Text style={S.emptyTitle}>Aucune réservation</Text>
          <Text style={S.emptySub}>Recherchez un trajet et cliquez sur "Réserver"</Text>
          <Pressable
            style={S.ctaBtn}
            onPress={() => router.replace("/(tabs)")}
          >
            <Feather name="search" size={16} color="#fff" />
            <Text style={S.ctaBtnText}>Chercher un trajet</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <BookingCard item={item} />}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
          ListFooterComponent={<View style={{ height: 32 }} />}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={true}
          showsVerticalScrollIndicator={false}
        />
      )}

      {!loading && (
        <View style={[S.fab, { bottom: insets.bottom + 16 }]}>
          <Pressable
            style={S.fabBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/(tabs)"); }}
          >
            <Feather name="plus" size={22} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadTxt: { fontSize: 14, color: "#94A3B8", marginTop: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  emptySub: { fontSize: 14, color: "#94A3B8", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  ctaBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: PRIMARY, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  ctaBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  routeWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  routeFrom: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1 },
  routeTo: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1, textAlign: "right" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  cardMid: { gap: 5, marginBottom: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 12, color: "#64748B" },

  cardBot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  ref: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  amount: { fontSize: 16, fontWeight: "800", color: AMBER },

  fab: { position: "absolute", right: 20 },
  fabBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: AMBER, alignItems: "center", justifyContent: "center", shadowColor: AMBER, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },

  waBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#25D366",
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 10,
    shadowColor: "#25D366",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  waIcon: { fontSize: 15 },
  waBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
