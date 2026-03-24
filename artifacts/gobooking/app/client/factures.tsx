import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";
import { downloadReceipt, type ReceiptData } from "@/utils/invoicePdf";

interface Receipt {
  id: string;
  bookingRef: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  bagagePrice: number;
  paymentMethod: string;
  createdAt: string;
  trip: {
    from: string;
    to: string;
    date: string;
    departureTime: string;
    arrivalTime: string;
    busName: string;
    busType: string;
  } | null;
  passengers: { name: string; age?: number; seatNumber: string }[];
  seatNumbers: string[];
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
}

const NAVY = "#0B3C5D";
const ORANGE = "#FF6B00";
const GREEN = "#059669";
const RED = "#DC2626";
const AMBER = "#D97706";

function StatusBadge({ status, payStatus }: { status: string; payStatus: string }) {
  const isPaid = payStatus === "paid";
  const isCancelled = status === "annulé" || status === "cancelled";
  const isBoarded = status === "embarqué";

  const bg = isCancelled ? "#FEF2F2" : isBoarded ? "#ECFDF5" : isPaid ? "#EFF6FF" : "#FEF3C7";
  const fg = isCancelled ? RED : isBoarded ? GREEN : isPaid ? NAVY : AMBER;
  const label = isCancelled ? "Annulé" : isBoarded ? "Embarqué" : isPaid ? "Payé" : "En attente";
  const icon = isCancelled ? "x-circle" : isBoarded ? "check-circle" : isPaid ? "credit-card" : "clock";

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Feather name={icon as any} size={11} color={fg} />
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function ReceiptCard({ item, onDownload, downloading }: { item: Receipt; onDownload: () => void; downloading: boolean }) {
  const trip = item.trip;
  const date = trip ? new Date(trip.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const created = new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.cardHeader}>
        <View style={styles.refRow}>
          <Feather name="file-text" size={14} color={NAVY} />
          <Text style={styles.refText}>#{item.bookingRef}</Text>
        </View>
        <StatusBadge status={item.status} payStatus={item.paymentStatus} />
      </View>

      {/* Route */}
      {trip ? (
        <View style={styles.routeRow}>
          <Text style={styles.city}>{trip.from}</Text>
          <View style={styles.routeArrow}>
            <View style={styles.routeLine} />
            <Feather name="chevron-right" size={14} color="#94A3B8" />
          </View>
          <Text style={styles.city}>{trip.to}</Text>
        </View>
      ) : (
        <Text style={{ color: "#94A3B8", fontSize: 13, marginTop: 8 }}>Trajet indisponible</Text>
      )}

      {/* Details */}
      <View style={styles.detailsRow}>
        {trip && (
          <>
            <View style={styles.detail}>
              <Feather name="calendar" size={12} color="#94A3B8" />
              <Text style={styles.detailText}>{date}</Text>
            </View>
            <View style={styles.detail}>
              <Feather name="clock" size={12} color="#94A3B8" />
              <Text style={styles.detailText}>{trip.departureTime}</Text>
            </View>
            <View style={styles.detail}>
              <Feather name="users" size={12} color="#94A3B8" />
              <Text style={styles.detailText}>{item.passengers.length} pass.</Text>
            </View>
          </>
        )}
        <View style={styles.detail}>
          <Feather name="calendar" size={12} color="#94A3B8" />
          <Text style={styles.detailText}>Le {created}</Text>
        </View>
      </View>

      {/* Amount + Download */}
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.amountLabel}>Total payé</Text>
          <Text style={styles.amount}>{item.totalAmount.toLocaleString()} FCFA</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.downloadBtn, pressed && { opacity: 0.75 }, downloading && { opacity: 0.6 }]}
          onPress={onDownload}
          disabled={downloading}
        >
          {downloading
            ? <ActivityIndicator size={14} color="#fff" />
            : <Feather name="download" size={14} color="#fff" />}
          <Text style={styles.downloadBtnText}>{downloading ? "Génération…" : "Télécharger"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function FacturesClientScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<Receipt[]>("/bookings/my-receipts", { token });
      setReceipts(data);
    } catch { /* silently fail */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (item: Receipt) => {
    if (!item.trip) return;
    setDownloadingId(item.id);
    const baseAmount = item.totalAmount - (item.bagagePrice || 0);
    const receiptData: ReceiptData = {
      bookingRef: item.bookingRef,
      transactionId: item.id,
      clientName: item.clientName,
      clientEmail: item.clientEmail,
      clientPhone: item.clientPhone,
      trip: item.trip,
      passengers: item.passengers,
      seatNumbers: item.seatNumbers,
      baseAmount,
      bagageAmount: item.bagagePrice || 0,
      totalAmount: item.totalAmount,
      paymentMethod: item.paymentMethod,
      paymentStatus: item.paymentStatus,
      status: item.status,
      createdAt: item.createdAt,
    };
    await downloadReceipt(receiptData);
    setDownloadingId(null);
  };

  const paid = receipts.filter(r => r.paymentStatus === "paid");
  const totalSpent = paid.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/client/home")} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={NAVY} />
        </Pressable>
        <Text style={styles.headerTitle}>Mes Factures</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{receipts.length}</Text>
        </View>
      </View>

      {/* Summary strip */}
      {receipts.length > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{paid.length}</Text>
            <Text style={styles.summaryLabel}>Réservations payées</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalSpent.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>FCFA dépensés</Text>
          </View>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={NAVY} size="large" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={NAVY} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Feather name="file-text" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>Aucune facture</Text>
              <Text style={styles.emptySub}>Vos reçus apparaîtront ici après vos réservations.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ReceiptCard
              item={item}
              onDownload={() => handleDownload(item)}
              downloading={downloadingId === item.id}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#94A3B8" },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: NAVY },
  headerBadge: { backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  headerBadgeText: { fontSize: 13, fontWeight: "700", color: NAVY },

  summaryStrip: { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 16, paddingHorizontal: 24 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 20, fontWeight: "800", color: "#fff" },
  summaryLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 16 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  refRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  refText: { fontSize: 14, fontWeight: "700", color: NAVY },

  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  routeRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  city: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  routeArrow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2 },
  routeLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },

  detailsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  detail: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F8FAFC", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  detailText: { fontSize: 11, color: "#64748B", fontWeight: "500" },

  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12 },
  amountLabel: { fontSize: 11, color: "#94A3B8", marginBottom: 2 },
  amount: { fontSize: 18, fontWeight: "800", color: NAVY },

  downloadBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: NAVY, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  downloadBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  emptySub: { fontSize: 13, color: "#94A3B8", textAlign: "center", maxWidth: 260 },
});
