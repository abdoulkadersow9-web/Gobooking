import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  clearSyncedHistory,
  clearScannedCodes,
  getHistory,
  type OfflineItem,
} from "@/utils/offline";

/* ── Design tokens ───────────────────────────────────────────── */
const PRIMARY   = "#1A56DB";
const G         = "#059669";
const AMBER     = "#D97706";
const GRAY      = "#6B7280";
const BG        = "#F9FAFB";

/* ── Helpers ─────────────────────────────────────────────────── */
const TYPE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  scan:           { label: "Scan billet",       icon: "qr-code",          color: PRIMARY,  bg: "#EEF2FF" },
  reservation:    { label: "Réservation",        icon: "ticket",           color: AMBER,    bg: "#FEF3C7" },
  colis_arrive:   { label: "Arrivée colis",      icon: "cube",             color: G,        bg: "#ECFDF5" },
  en_route_board: { label: "Embarquement route", icon: "bus",              color: "#7C3AED", bg: "#F5F3FF" },
};

function formatTs(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function describePayload(item: OfflineItem): string {
  if (item.type === "scan")           return `Réservation #${item.payload.reservationId}`;
  if (item.type === "reservation")    return `${item.payload.passengerName} · ${item.payload.passengerCount} place(s)`;
  if (item.type === "colis_arrive")   return `Colis ${item.payload.trackingRef}`;
  if (item.type === "en_route_board") return `Passager en route #${item.payload.requestId}`;
  return "Action inconnue";
}

/* ── Screen ──────────────────────────────────────────────────── */
export default function OfflineHistoryScreen() {
  const [history, setHistory]     = useState<OfflineItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const all = await getHistory();
    /* newest first */
    setHistory([...all].sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending  = history.filter(i => !i.synced);
  const synced   = history.filter(i =>  i.synced);

  const handleClearSynced = () => {
    Alert.alert(
      "Effacer l'historique",
      `Supprimer les ${synced.length} action${synced.length > 1 ? "s" : ""} déjà synchronisée${synced.length > 1 ? "s" : ""} ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Effacer", style: "destructive", onPress: async () => {
          await clearSyncedHistory();
          load();
        }},
      ]
    );
  };

  const handleClearScanned = () => {
    Alert.alert(
      "Réinitialiser scans",
      "Effacer la mémoire des codes scannés ? (utile en début de nouvelle session)",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Réinitialiser", style: "destructive", onPress: async () => {
          await clearScannedCodes();
          Alert.alert("Fait", "Codes scannés effacés.");
        }},
      ]
    );
  };

  const renderItem = ({ item }: { item: OfflineItem }) => {
    const meta = TYPE_META[item.type] ?? { label: item.type, icon: "alert-circle", color: GRAY, bg: "#F3F4F6" };
    return (
      <View style={[S.card, item.synced && S.cardSynced]}>
        <View style={[S.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as any} size={18} color={meta.color} />
        </View>
        <View style={S.cardBody}>
          <View style={S.cardRow}>
            <Text style={S.cardType}>{meta.label}</Text>
            <View style={[S.badge, { backgroundColor: item.synced ? "#ECFDF5" : "#FEF3C7" }]}>
              <Text style={[S.badgeText, { color: item.synced ? G : AMBER }]}>
                {item.synced ? "Synchronisé" : "En attente"}
              </Text>
            </View>
          </View>
          <Text style={S.cardDesc}>{describePayload(item)}</Text>
          <View style={S.cardMeta}>
            <Feather name="clock" size={10} color={GRAY} />
            <Text style={S.cardMetaText}>Créé {formatTs(item.createdAt)}</Text>
            {item.synced && item.syncedAt ? (
              <>
                <Text style={S.cardMetaDot}>·</Text>
                <Feather name="check" size={10} color={G} />
                <Text style={[S.cardMetaText, { color: G }]}>Sync {formatTs(item.syncedAt)}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={S.headerTitle}>Historique offline</Text>
          <Text style={S.headerSub}>
            {pending.length} en attente · {synced.length} synchronisé{synced.length > 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={S.statsRow}>
        <View style={[S.stat, { borderColor: AMBER }]}>
          <Text style={[S.statNum, { color: AMBER }]}>{pending.length}</Text>
          <Text style={S.statLabel}>En attente</Text>
        </View>
        <View style={[S.stat, { borderColor: G }]}>
          <Text style={[S.statNum, { color: G }]}>{synced.length}</Text>
          <Text style={S.statLabel}>Synchronisé</Text>
        </View>
        <View style={[S.stat, { borderColor: PRIMARY }]}>
          <Text style={[S.statNum, { color: PRIMARY }]}>{history.length}</Text>
          <Text style={S.statLabel}>Total</Text>
        </View>
      </View>

      {/* Actions row */}
      <View style={S.actionsRow}>
        {synced.length > 0 && (
          <TouchableOpacity style={S.actionBtn} onPress={handleClearSynced} activeOpacity={0.8}>
            <Feather name="trash-2" size={13} color="#DC2626" />
            <Text style={[S.actionBtnText, { color: "#DC2626" }]}>Effacer historique sync</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={S.actionBtn} onPress={handleClearScanned} activeOpacity={0.8}>
          <Feather name="refresh-ccw" size={13} color={GRAY} />
          <Text style={[S.actionBtnText, { color: GRAY }]}>Réinitialiser scans</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator color={PRIMARY} size="large" />
        </View>
      ) : history.length === 0 ? (
        <View style={S.center}>
          <Ionicons name="cloud-offline-outline" size={56} color="#D1D5DB" />
          <Text style={S.emptyTitle}>Aucune action offline</Text>
          <Text style={S.emptySub}>Les actions enregistrées hors connexion apparaîtront ici.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={S.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
          ListHeaderComponent={pending.length > 0 ? (
            <View style={S.sectionHeader}>
              <Feather name="alert-circle" size={13} color={AMBER} />
              <Text style={[S.sectionLabel, { color: AMBER }]}>Actions en attente de synchronisation</Text>
            </View>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: BG },
  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: 17, fontWeight: "700", color: "#111827" },
  headerSub:     { fontSize: 12, color: GRAY, marginTop: 1 },
  statsRow:      { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  stat:          { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, backgroundColor: "#fff" },
  statNum:       { fontSize: 22, fontWeight: "800" },
  statLabel:     { fontSize: 10, color: GRAY, marginTop: 2, fontWeight: "600" },
  actionsRow:    { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  actionBtn:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB" },
  actionBtnText: { fontSize: 12, fontWeight: "600" },
  list:          { padding: 16, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  sectionLabel:  { fontSize: 12, fontWeight: "700" },
  card:          { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", gap: 12, borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  cardSynced:    { opacity: 0.75 },
  iconWrap:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cardBody:      { flex: 1 },
  cardRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  cardType:      { fontSize: 13, fontWeight: "700", color: "#111827" },
  badge:         { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeText:     { fontSize: 10, fontWeight: "700" },
  cardDesc:      { fontSize: 13, color: "#374151", marginBottom: 5 },
  cardMeta:      { flexDirection: "row", alignItems: "center", gap: 4 },
  cardMetaText:  { fontSize: 11, color: GRAY },
  cardMetaDot:   { fontSize: 11, color: GRAY },
  center:        { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyTitle:    { fontSize: 16, fontWeight: "700", color: "#374151" },
  emptySub:      { fontSize: 13, color: GRAY, textAlign: "center", lineHeight: 19 },
});
