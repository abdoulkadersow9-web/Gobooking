import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type BusCondition = "bon" | "panne" | "maintenance";

const CONDITION_META: Record<BusCondition, {
  label: string; bg: string; text: string; border: string; icon: string; dot: string;
}> = {
  bon:         { label: "Bon état",     bg: "#DCFCE7", text: "#166534", border: "#BBF7D0", icon: "check-circle", dot: "#22C55E" },
  maintenance: { label: "Maintenance",  bg: "#FEF3C7", text: "#92400E", border: "#FDE68A", icon: "tool",         dot: "#F59E0B" },
  panne:       { label: "En panne",     bg: "#FEE2E2", text: "#991B1B", border: "#FECACA", icon: "alert-circle", dot: "#EF4444" },
};

const ALL_CONDITIONS: BusCondition[] = ["bon", "maintenance", "panne"];

interface BusMaintenance {
  id: string;
  busName: string;
  plateNumber: string;
  busType: string;
  capacity: number;
  condition: BusCondition;
  issue: string | null;
  lastMaintenanceDate: string | null;
}

function formatDate(d: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysSince(d: string | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function BusCard({ bus, onUpdate }: { bus: BusMaintenance; onUpdate: () => void }) {
  const cm = CONDITION_META[bus.condition] ?? CONDITION_META.bon;
  const days = daysSince(bus.lastMaintenanceDate);

  return (
    <View style={[S.card, { borderLeftColor: cm.dot, borderLeftWidth: 4 }]}>
      <View style={S.cardHeader}>
        <View style={S.busIcon}>
          <Ionicons name="bus" size={22} color="#64748B" />
        </View>
        <View style={S.cardInfo}>
          <Text style={S.cardName}>{bus.busName}</Text>
          <Text style={S.cardPlate}>{bus.plateNumber}</Text>
          <Text style={S.cardMeta}>{bus.busType} · {bus.capacity} places</Text>
        </View>
        <View style={[S.condBadge, { backgroundColor: cm.bg, borderColor: cm.border }]}>
          <Feather name={cm.icon as any} size={11} color={cm.text} />
          <Text style={[S.condText, { color: cm.text }]}>{cm.label}</Text>
        </View>
      </View>

      {bus.issue ? (
        <View style={S.issueBlock}>
          <Feather name="alert-triangle" size={13} color="#DC2626" />
          <Text style={S.issueText} numberOfLines={2}>{bus.issue}</Text>
        </View>
      ) : null}

      <View style={S.dateRow}>
        <Feather name="calendar" size={13} color="#94A3B8" />
        {bus.lastMaintenanceDate ? (
          <Text style={S.dateText}>
            Dernière maintenance : <Text style={S.dateVal}>{formatDate(bus.lastMaintenanceDate)}</Text>
            {days !== null ? <Text style={S.daysAgo}> ({days}j)</Text> : null}
          </Text>
        ) : (
          <Text style={[S.dateText, { color: "#CBD5E1", fontStyle: "italic" }]}>Aucune maintenance enregistrée</Text>
        )}
      </View>

      <View style={S.cardActions}>
        {bus.condition !== "panne" && (
          <Pressable style={[S.actionBtn, { borderColor: "#FECACA", backgroundColor: "#FFF5F5" }]} onPress={() => onUpdate()}>
            <Feather name="alert-circle" size={13} color="#DC2626" />
            <Text style={[S.actionBtnText, { color: "#DC2626" }]}>Panne</Text>
          </Pressable>
        )}
        {bus.condition !== "maintenance" && (
          <Pressable style={[S.actionBtn, { borderColor: "#FDE68A", backgroundColor: "#FFFBEB" }]} onPress={() => onUpdate()}>
            <Feather name="tool" size={13} color="#D97706" />
            <Text style={[S.actionBtnText, { color: "#D97706" }]}>Maintenance</Text>
          </Pressable>
        )}
        {bus.condition !== "bon" && (
          <Pressable style={[S.actionBtn, { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }]} onPress={() => onUpdate()}>
            <Feather name="check-circle" size={13} color="#16A34A" />
            <Text style={[S.actionBtnText, { color: "#16A34A" }]}>Bon état</Text>
          </Pressable>
        )}
        <Pressable style={[S.actionBtn, { borderColor: "#E2E8F0", backgroundColor: "#F8FAFC", marginLeft: "auto" as any }]} onPress={() => onUpdate()}>
          <Feather name="edit-3" size={13} color="#64748B" />
          <Text style={[S.actionBtnText, { color: "#64748B" }]}>Modifier</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MaintenanceBusScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [buses, setBuses] = useState<BusMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<BusCondition | "all">("all");

  const [editBus, setEditBus] = useState<BusMaintenance | null>(null);
  const [editCondition, setEditCondition] = useState<BusCondition>("bon");
  const [editIssue, setEditIssue] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchBuses = useCallback(async () => {
    try {
      const data = await apiFetch("/company/buses/maintenance", { token: token! });
      const list = (Array.isArray(data) ? data : []).map((b: any) => ({
        id: b.id,
        busName: b.bus_name ?? b.busName,
        plateNumber: b.plate_number ?? b.plateNumber,
        busType: b.bus_type ?? b.busType,
        capacity: b.capacity,
        condition: (b.condition ?? "bon") as BusCondition,
        issue: b.issue ?? null,
        lastMaintenanceDate: b.last_maintenance_date ?? b.lastMaintenanceDate ?? null,
      }));
      setBuses(list);
    } catch {
      setBuses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchBuses(); }, [fetchBuses]);
  const onRefresh = () => { setRefreshing(true); fetchBuses(); };

  const openEdit = (bus: BusMaintenance) => {
    setEditBus(bus);
    setEditCondition(bus.condition);
    setEditIssue(bus.issue ?? "");
    setEditDate(bus.lastMaintenanceDate ?? "");
  };

  const applyQuickAction = async (bus: BusMaintenance, condition: BusCondition) => {
    const isService = condition === "bon";
    const date = isService ? new Date().toISOString().split("T")[0] : undefined;
    try {
      await apiFetch(`/company/buses/${bus.id}/maintenance`, {
        method: "PATCH", token: token!,
        body: { condition, issue: isService ? null : bus.issue, ...(date ? { lastMaintenanceDate: date } : {}) },
      });
      fetchBuses();
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour cet engin.");
    }
  };

  const saveEdit = async () => {
    if (!editBus) return;
    setSaving(true);
    try {
      await apiFetch(`/company/buses/${editBus.id}/maintenance`, {
        method: "PATCH", token: token!,
        body: {
          condition: editCondition,
          issue: editIssue.trim() || null,
          lastMaintenanceDate: editDate.trim() || null,
        },
      });
      setEditBus(null);
      fetchBuses();
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder les modifications.");
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    bon:         buses.filter(b => b.condition === "bon").length,
    maintenance: buses.filter(b => b.condition === "maintenance").length,
    panne:       buses.filter(b => b.condition === "panne").length,
  };

  const filtered = filter === "all" ? buses : buses.filter(b => b.condition === filter);

  return (
    <SafeAreaView style={S.root} edges={["bottom"]}>
      <LinearGradient colors={["#0B3C5D", "#1E5F8A"]} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <View style={S.headerRow}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={S.backBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle}>Maintenance des Engins</Text>
            <Text style={S.headerSub}>{buses.length} véhicule{buses.length !== 1 ? "s" : ""} au total</Text>
          </View>
          <Pressable onPress={onRefresh} style={S.backBtn}>
            <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>

        <View style={S.statsRow}>
          {[
            { label: "Bon état",    value: counts.bon,         color: "#22C55E" },
            { label: "Maintenance", value: counts.maintenance, color: "#F59E0B" },
            { label: "En panne",    value: counts.panne,       color: "#EF4444" },
          ].map(s => (
            <View key={s.label} style={[S.statCard, { borderTopColor: s.color }]}>
              <Text style={[S.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={S.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={S.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {(["all", ...ALL_CONDITIONS] as const).map(c => {
            const active = filter === c;
            const cm = c !== "all" ? CONDITION_META[c] : null;
            return (
              <Pressable
                key={c}
                style={[S.chip, active && { backgroundColor: cm?.bg ?? "#EEF2FF", borderColor: cm?.border ?? "#C7D2FE" }]}
                onPress={() => setFilter(c)}
              >
                {cm && <Feather name={cm.icon as any} size={12} color={active ? cm.text : "#94A3B8"} />}
                <Text style={[S.chipText, active && { color: cm?.text ?? "#4338CA", fontWeight: "700" }]}>
                  {c === "all" ? "Tous" : cm!.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color="#D97706" />
          <Text style={S.loadingText}>Chargement…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={S.center}>
          <View style={S.emptyIcon}><Feather name="tool" size={36} color="#D97706" /></View>
          <Text style={S.emptyTitle}>Aucun engin trouvé</Text>
          <Text style={S.emptySub}>
            {filter !== "all" ? "Aucun bus avec cette condition." : "Ajoutez des bus dans la gestion de la flotte."}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D97706" />}
        >
          {filtered.map(bus => (
            <BusCard
              key={bus.id}
              bus={bus}
              onUpdate={() => openEdit(bus)}
            />
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={!!editBus} transparent animationType="slide" onRequestClose={() => setEditBus(null)}>
        <Pressable style={S.overlay} onPress={() => setEditBus(null)}>
          <Pressable style={S.sheet} onPress={e => e.stopPropagation()}>
            <View style={S.handle} />
            <Text style={S.sheetTitle}>Modifier — {editBus?.busName}</Text>
            <Text style={S.sheetPlate}>{editBus?.plateNumber}</Text>

            <Text style={S.label}>État du véhicule</Text>
            <View style={S.condGrid}>
              {ALL_CONDITIONS.map(c => {
                const cm = CONDITION_META[c];
                const sel = editCondition === c;
                return (
                  <Pressable
                    key={c}
                    style={[S.condOption, sel && { backgroundColor: cm.bg, borderColor: cm.dot }]}
                    onPress={() => setEditCondition(c)}
                  >
                    <Feather name={cm.icon as any} size={15} color={sel ? cm.text : "#94A3B8"} />
                    <Text style={[S.condOptionText, sel && { color: cm.text, fontWeight: "700" }]}>{cm.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={S.label}>Description du problème</Text>
            <View style={S.inputWrap}>
              <TextInput
                style={[S.input, { minHeight: 72, textAlignVertical: "top" }]}
                placeholder="Ex: Moteur surchauffe, pneu crevé…"
                placeholderTextColor="#CBD5E1"
                value={editIssue}
                onChangeText={setEditIssue}
                multiline
              />
            </View>

            <Text style={S.label}>Date de dernière maintenance (AAAA-MM-JJ)</Text>
            <View style={S.inputWrap}>
              <Feather name="calendar" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={S.input}
                placeholder="Ex: 2026-03-01"
                placeholderTextColor="#CBD5E1"
                value={editDate}
                onChangeText={setEditDate}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={S.sheetBtns}>
              <Pressable style={S.cancelBtn} onPress={() => setEditBus(null)}>
                <Text style={S.cancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={[S.saveBtn, saving && { opacity: 0.6 }]} onPress={saveEdit} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Feather name="check" size={15} color="#fff" /><Text style={S.saveText}>Enregistrer</Text></>
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

  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: 10, alignItems: "center", borderTopWidth: 3 },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2, textAlign: "center" },

  filterBar: { paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  chipText: { fontSize: 12, color: "#64748B", fontWeight: "500" },

  list: { padding: 16, gap: 12 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },

  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  busIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  cardPlate: { fontSize: 13, color: "#475569", marginTop: 1 },
  cardMeta: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  condBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  condText: { fontSize: 11, fontWeight: "700" },

  issueBlock: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  issueText: { flex: 1, fontSize: 13, color: "#991B1B", lineHeight: 18 },

  dateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  dateText: { fontSize: 13, color: "#475569" },
  dateVal: { fontWeight: "700", color: "#0F172A" },
  daysAgo: { color: "#94A3B8", fontWeight: "400" },

  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontWeight: "600" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { fontSize: 14, color: "#94A3B8", marginTop: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  emptySub: { fontSize: 14, color: "#94A3B8", textAlign: "center", lineHeight: 20 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 2 },
  sheetPlate: { fontSize: 13, color: "#94A3B8", marginBottom: 4 },

  label: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },

  condGrid: { flexDirection: "row", gap: 8 },
  condOption: { flex: 1, flexDirection: "column", alignItems: "center", gap: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  condOptionText: { fontSize: 11, color: "#94A3B8", fontWeight: "500", textAlign: "center" },

  inputWrap: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 12 },
  input: { flex: 1, fontSize: 14, color: "#0F172A" },

  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: "#D97706", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  saveText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
