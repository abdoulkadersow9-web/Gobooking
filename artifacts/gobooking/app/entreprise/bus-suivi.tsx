import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const AMBER       = "#D97706";
const AMBER_LIGHT = "#FFFBEB";

type LogisticStatus = "en_attente" | "en_service" | "en_route" | "arrivé" | "hors_service";

const STATUS_META: Record<LogisticStatus, { label: string; bg: string; text: string; border: string; icon: string; dot: string }> = {
  en_attente:   { label: "En attente",   bg: "#FEF3C7", text: "#92400E", border: "#FDE68A", icon: "clock",       dot: "#F59E0B" },
  en_service:   { label: "En service",   bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE", icon: "check-circle", dot: "#3B82F6" },
  en_route:     { label: "En route",     bg: "#DCFCE7", text: "#166534", border: "#BBF7D0", icon: "navigation",   dot: "#22C55E" },
  arrivé:       { label: "Arrivé",       bg: "#EDE9FE", text: "#5B21B6", border: "#DDD6FE", icon: "flag",         dot: "#8B5CF6" },
  hors_service: { label: "Hors service", bg: "#FEE2E2", text: "#991B1B", border: "#FECACA", icon: "alert-circle", dot: "#EF4444" },
};

const ALL_STATUSES: LogisticStatus[] = ["en_attente", "en_service", "en_route", "arrivé", "hors_service"];

interface BusTracking {
  id: string;
  busName: string;
  plateNumber: string;
  busType: string;
  capacity: number;
  status: string;
  logisticStatus: LogisticStatus;
  currentLocation: string | null;
  currentTripId: string | null;
  tripFrom: string | null;
  tripTo: string | null;
  tripDate: string | null;
  tripDepartureTime: string | null;
  tripStatus: string | null;
}

function DotPulse({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 14, height: 14, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: color, transform: [{ scale }],
      }} />
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[S.statCard, { borderTopColor: color }]}>
      <Text style={[S.statValue, { color }]}>{value}</Text>
      <Text style={S.statLabel}>{label}</Text>
    </View>
  );
}

function BusTrackingCard({
  bus, onUpdate,
}: {
  bus: BusTracking;
  onUpdate: (bus: BusTracking) => void;
}) {
  const sm = STATUS_META[bus.logisticStatus] ?? STATUS_META.en_attente;
  const isMoving = bus.logisticStatus === "en_route";

  return (
    <View style={[S.card, { borderLeftColor: sm.dot, borderLeftWidth: 4 }]}>
      <View style={S.cardHeader}>
        <View style={S.busIconWrap}>
          <Text style={{ fontSize: 24 }}>🚌</Text>
        </View>
        <View style={S.cardInfo}>
          <Text style={S.cardName}>{bus.busName}</Text>
          <Text style={S.cardPlate}>{bus.plateNumber}</Text>
          <Text style={S.cardType}>{bus.busType} · {bus.capacity} places</Text>
        </View>
        <View style={[S.statusBadge, { backgroundColor: sm.bg, borderColor: sm.border }]}>
          {isMoving
            ? <DotPulse color={sm.dot} />
            : <Feather name={sm.icon as any} size={11} color={sm.text} />
          }
          <Text style={[S.statusText, { color: sm.text }]}>{sm.label}</Text>
        </View>
      </View>

      {(bus.currentLocation || bus.tripFrom) && (
        <View style={S.infoBlock}>
          {bus.currentLocation ? (
            <View style={S.infoRow}>
              <Feather name="map-pin" size={13} color="#64748B" />
              <Text style={S.infoText} numberOfLines={1}>{bus.currentLocation}</Text>
            </View>
          ) : null}
          {bus.tripFrom && (
            <View style={S.infoRow}>
              <Feather name="navigation" size={13} color="#64748B" />
              <Text style={S.infoText}>{bus.tripFrom} → {bus.tripTo}</Text>
              {bus.tripDepartureTime ? (
                <Text style={S.infoTime}>{bus.tripDepartureTime}</Text>
              ) : null}
            </View>
          )}
        </View>
      )}

      {!bus.currentLocation && !bus.tripFrom && (
        <View style={S.noInfoRow}>
          <Text style={S.noInfoText}>Aucune information de position disponible</Text>
        </View>
      )}

      <Pressable style={S.updateBtn} onPress={() => onUpdate(bus)}>
        <Feather name="edit-3" size={13} color={AMBER} />
        <Text style={S.updateBtnText}>Mettre à jour</Text>
      </Pressable>
    </View>
  );
}

export default function BusSuiviScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [buses, setBuses] = useState<BusTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<LogisticStatus | "all">("all");

  const [editBus, setEditBus] = useState<BusTracking | null>(null);
  const [editStatus, setEditStatus] = useState<LogisticStatus>("en_attente");
  const [editLocation, setEditLocation] = useState("");
  const [editTripId, setEditTripId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchBuses = useCallback(async () => {
    if (!token) { setLoading(false); setRefreshing(false); return; }
    try {
      const data = await apiFetch("/company/buses/suivi", { token: token ?? undefined });
      console.log("[bus-suivi] API response:", JSON.stringify(data).substring(0, 200));
      setBuses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[bus-suivi] fetch error:", err);
      setBuses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBuses();
    const id = setInterval(fetchBuses, 30000);
    return () => clearInterval(id);
  }, [fetchBuses]);

  const onRefresh = () => { setRefreshing(true); fetchBuses(); };

  const openEdit = (bus: BusTracking) => {
    setEditBus(bus);
    setEditStatus(bus.logisticStatus ?? "en_attente");
    setEditLocation(bus.currentLocation ?? "");
    setEditTripId(bus.currentTripId ?? "");
  };

  const saveEdit = async () => {
    if (!editBus) return;
    setSaving(true);
    try {
      await apiFetch(`/company/buses/${editBus.id}/suivi`, {
        method: "PATCH",
        token: token!,
        body: {
          logisticStatus: editStatus,
          currentLocation: editLocation.trim() || null,
          currentTripId: editTripId.trim() || null,
        },
      });
      setEditBus(null);
      fetchBuses();
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour ce bus.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = filterStatus === "all"
    ? buses
    : buses.filter(b => b.logisticStatus === filterStatus);

  const counts = {
    en_attente:   buses.filter(b => b.logisticStatus === "en_attente").length,
    en_service:   buses.filter(b => b.logisticStatus === "en_service").length,
    en_route:     buses.filter(b => b.logisticStatus === "en_route").length,
    arrivé:       buses.filter(b => b.logisticStatus === "arrivé").length,
    hors_service: buses.filter(b => b.logisticStatus === "hors_service").length,
  };

  return (
    <SafeAreaView style={S.root} edges={["bottom"]}>
      <LinearGradient colors={["#0B3C5D", "#1E5F8A"]} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <View style={S.headerRow}>
          <Pressable onPress={() => router.back()} style={S.backBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle}>Suivi des Engins</Text>
            <Text style={S.headerSub}>{buses.length} véhicule{buses.length !== 1 ? "s" : ""} · actualisation 30s</Text>
          </View>
          <Pressable onPress={onRefresh} style={S.refreshBtn}>
            <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.statsRow} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
          <StatCard label="En attente"  value={counts.en_attente}   color="#F59E0B" />
          <StatCard label="En service"  value={counts.en_service}   color="#3B82F6" />
          <StatCard label="En route"    value={counts.en_route}     color="#22C55E" />
          <StatCard label="Arrivés"     value={counts.arrivé}       color="#8B5CF6" />
          <StatCard label="Hors service" value={counts.hors_service} color="#EF4444" />
        </ScrollView>
      </LinearGradient>

      <View style={S.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {(["all", ...ALL_STATUSES] as const).map((s) => {
            const active = filterStatus === s;
            const sm = s !== "all" ? STATUS_META[s] : null;
            return (
              <Pressable
                key={s}
                style={[S.filterChip, active && { backgroundColor: sm?.bg ?? "#EEF2FF", borderColor: sm?.border ?? "#C7D2FE" }]}
                onPress={() => setFilterStatus(s)}
              >
                {s !== "all" && sm && <Feather name={sm.icon as any} size={12} color={active ? sm.text : "#64748B"} />}
                <Text style={[S.filterChipText, active && { color: sm?.text ?? "#3730A3", fontWeight: "700" }]}>
                  {s === "all" ? "Tous" : sm!.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={AMBER} />
          <Text style={S.loadingText}>Chargement du suivi…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={S.center}>
          <View style={S.emptyIcon}>
            <Text style={{ fontSize: 40 }}>🚌</Text>
          </View>
          <Text style={S.emptyTitle}>Aucun engin trouvé</Text>
          <Text style={S.emptySub}>
            {filterStatus !== "all"
              ? "Aucun bus avec ce statut pour le moment."
              : "Ajoutez des bus dans la gestion de la flotte."}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AMBER} />}
        >
          {filtered.map(bus => (
            <BusTrackingCard key={bus.id} bus={bus} onUpdate={openEdit} />
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={!!editBus} transparent animationType="slide" onRequestClose={() => setEditBus(null)}>
        <Pressable style={S.modalOverlay} onPress={() => setEditBus(null)}>
          <Pressable style={S.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={S.modalHandle} />
            <Text style={S.modalTitle}>Mettre à jour — {editBus?.busName}</Text>
            <Text style={S.modalPlate}>{editBus?.plateNumber}</Text>

            <Text style={S.modalLabel}>Statut logistique</Text>
            <View style={S.statusGrid}>
              {ALL_STATUSES.map(s => {
                const sm = STATUS_META[s];
                const selected = editStatus === s;
                return (
                  <Pressable
                    key={s}
                    style={[S.statusOption, selected && { backgroundColor: sm.bg, borderColor: sm.dot }]}
                    onPress={() => setEditStatus(s)}
                  >
                    <Feather name={sm.icon as any} size={14} color={selected ? sm.text : "#94A3B8"} />
                    <Text style={[S.statusOptionText, selected && { color: sm.text, fontWeight: "700" }]}>
                      {sm.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={S.modalLabel}>Localisation actuelle</Text>
            <View style={S.inputWrap}>
              <Feather name="map-pin" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={S.input}
                placeholder="Ex: Autoroute du Nord, km 12"
                placeholderTextColor="#CBD5E1"
                value={editLocation}
                onChangeText={setEditLocation}
              />
            </View>

            <Text style={S.modalLabel}>ID du trajet assigné (optionnel)</Text>
            <View style={S.inputWrap}>
              <Feather name="navigation" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={S.input}
                placeholder="ID du trajet en cours"
                placeholderTextColor="#CBD5E1"
                value={editTripId}
                onChangeText={setEditTripId}
                autoCapitalize="none"
              />
            </View>

            <View style={S.modalBtns}>
              <Pressable style={S.cancelBtn} onPress={() => setEditBus(null)}>
                <Text style={S.cancelBtnText}>Annuler</Text>
              </Pressable>
              <Pressable style={[S.saveBtn, saving && { opacity: 0.6 }]} onPress={saveEdit} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Feather name="check" size={15} color="#fff" /><Text style={S.saveBtnText}>Enregistrer</Text></>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 },

  statsRow: { marginHorizontal: -16, paddingLeft: 16 },
  statCard: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: 10, minWidth: 80, alignItems: "center", borderTopWidth: 3 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2, textAlign: "center" },

  filterBar: { paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  filterChipText: { fontSize: 12, color: "#64748B", fontWeight: "500" },

  list: { padding: 16, gap: 12 },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  busIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  cardPlate: { fontSize: 13, color: "#475569", marginTop: 1 },
  cardType: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700" },

  infoBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9", gap: 6 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { flex: 1, fontSize: 13, color: "#475569" },
  infoTime: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  noInfoRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  noInfoText: { fontSize: 12, color: "#CBD5E1", fontStyle: "italic" },

  updateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: "#FDE68A", backgroundColor: AMBER_LIGHT },
  updateBtnText: { fontSize: 13, fontWeight: "600", color: AMBER },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { fontSize: 14, color: "#94A3B8", marginTop: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  emptySub: { fontSize: 14, color: "#94A3B8", textAlign: "center", lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 2 },
  modalPlate: { fontSize: 13, color: "#94A3B8", marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },

  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusOption: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  statusOptionText: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },

  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 12 },
  input: { flex: 1, fontSize: 14, color: "#0F172A" },

  modalBtns: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: AMBER, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  saveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

