import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const AMBER  = "#D97706";
const AMBER_LIGHT = "#FFFBEB";
const AMBER_BORDER = "#FDE68A";

interface Bus {
  id: string;
  busName: string;
  plateNumber: string;
  busType: string;
  capacity: number;
  status: "active" | "maintenance" | "inactive";
}

const BUS_TYPES = ["Standard", "Premium", "VIP", "Minibus", "Articulé"];

const STATUS_META: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  active:      { label: "Actif",        bg: "#DCFCE7", text: "#166534", icon: "check-circle" },
  maintenance: { label: "Maintenance",  bg: "#FEF3C7", text: "#92400E", icon: "tool" },
  inactive:    { label: "Inactif",      bg: "#F1F5F9", text: "#64748B", icon: "pause-circle" },
};

function BusCard({ bus, onEdit, onDelete }: { bus: Bus; onEdit: () => void; onDelete: () => void }) {
  const sm = STATUS_META[bus.status] ?? STATUS_META.inactive;
  return (
    <View style={S.card}>
      <View style={S.cardTop}>
        <View style={S.busIconWrap}>
          <Ionicons name="bus" size={26} color={AMBER} />
        </View>
        <View style={S.cardInfo}>
          <Text style={S.cardName}>{bus.busName}</Text>
          <Text style={S.cardPlate}>{bus.plateNumber}</Text>
          <View style={S.metaRow}>
            <Text style={S.cardMeta}>{bus.busType}</Text>
            <Text style={S.dot}>·</Text>
            <Text style={S.cardMeta}>{bus.capacity} places</Text>
          </View>
        </View>
        <View style={[S.statusBadge, { backgroundColor: sm.bg }]}>
          <Feather name={sm.icon as any} size={11} color={sm.text} />
          <Text style={[S.statusText, { color: sm.text }]}>{sm.label}</Text>
        </View>
      </View>
      <View style={S.cardActions}>
        <Pressable style={S.cardActionBtn} onPress={onEdit}>
          <Feather name="edit-2" size={14} color={AMBER} />
          <Text style={[S.cardActionText, { color: AMBER }]}>Modifier</Text>
        </Pressable>
        <View style={S.actionDivider} />
        <Pressable style={S.cardActionBtn} onPress={onDelete}>
          <Feather name="trash-2" size={14} color="#EF4444" />
          <Text style={[S.cardActionText, { color: "#EF4444" }]}>Supprimer</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function BusesScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [buses, setBuses]       = useState<Bus[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editBus, setEditBus]   = useState<Bus | null>(null);

  const [form, setForm] = useState({
    busName:     "",
    plateNumber: "",
    busType:     "Standard",
    capacity:    "44",
    status:      "active" as Bus["status"],
  });

  const loadBuses = useCallback(async () => {
    try {
      const data = await apiFetch<Bus[]>("/company/buses", { token: token ?? undefined });
      setBuses(data);
    } catch {
      setBuses([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadBuses(); }, [loadBuses]);

  const openCreate = () => {
    setEditBus(null);
    setForm({ busName: "", plateNumber: "", busType: "Standard", capacity: "44", status: "active" });
    setShowModal(true);
  };

  const openEdit = (bus: Bus) => {
    setEditBus(bus);
    setForm({ busName: bus.busName, plateNumber: bus.plateNumber, busType: bus.busType, capacity: String(bus.capacity), status: bus.status });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.busName.trim() || !form.plateNumber.trim()) {
      Alert.alert("Erreur", "Nom et numéro de plaque sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      if (editBus) {
        await apiFetch(`/company/buses/${editBus.id}`, {
          token: token ?? undefined, method: "PATCH",
          body: { busName: form.busName, plateNumber: form.plateNumber, busType: form.busType, capacity: Number(form.capacity), status: form.status },
        });
      } else {
        await apiFetch("/company/buses", {
          token: token ?? undefined, method: "POST",
          body: { busName: form.busName, plateNumber: form.plateNumber, busType: form.busType, capacity: Number(form.capacity) },
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowModal(false);
      setLoading(true);
      await loadBuses();
    } catch (err: any) {
      Alert.alert("Erreur", err?.message ?? "Impossible de sauvegarder le bus.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (bus: Bus) => {
    Alert.alert("Supprimer ce bus ?", `${bus.busName} (${bus.plateNumber}) sera supprimé définitivement.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/company/buses/${bus.id}`, { token: token ?? undefined, method: "DELETE" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setBuses(prev => prev.filter(b => b.id !== bus.id));
          } catch (err: any) {
            Alert.alert("Erreur", err?.message ?? "Impossible de supprimer le bus.");
          }
        },
      },
    ]);
  };

  const activeBuses = buses.filter(b => b.status === "active").length;
  const totalCapacity = buses.filter(b => b.status === "active").reduce((s, b) => s + b.capacity, 0);

  return (
    <SafeAreaView style={S.safe} edges={["bottom"]}>
      <View style={[S.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={S.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Mes Bus</Text>
          <Text style={S.headerSub}>{buses.length} bus{buses.length !== 1 ? "" : ""} enregistré{buses.length !== 1 ? "s" : ""}</Text>
        </View>
        <Pressable style={S.addBtn} onPress={openCreate}>
          <Feather name="plus" size={18} color="white" />
          <Text style={S.addBtnText}>Ajouter</Text>
        </Pressable>
      </View>

      {/* Stats strip */}
      <View style={S.statsRow}>
        <View style={S.statCard}>
          <Text style={S.statValue}>{buses.length}</Text>
          <Text style={S.statLabel}>Total</Text>
        </View>
        <View style={S.statCard}>
          <Text style={[S.statValue, { color: "#059669" }]}>{activeBuses}</Text>
          <Text style={S.statLabel}>Actifs</Text>
        </View>
        <View style={S.statCard}>
          <Text style={[S.statValue, { color: "#D97706" }]}>{buses.filter(b => b.status === "maintenance").length}</Text>
          <Text style={S.statLabel}>Maintenance</Text>
        </View>
        <View style={S.statCard}>
          <Text style={[S.statValue, { color: "#0B3C5D" }]}>{totalCapacity}</Text>
          <Text style={S.statLabel}>Places actives</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={AMBER} size="large" style={{ marginTop: 60 }} />
      ) : buses.length === 0 ? (
        <View style={S.empty}>
          <Ionicons name="bus" size={48} color={AMBER} style={{ marginBottom: 12 }} />
          <Text style={S.emptyTitle}>Aucun bus enregistré</Text>
          <Text style={S.emptySub}>Ajoutez votre premier bus pour commencer à planifier vos trajets.</Text>
          <Pressable style={S.emptyBtn} onPress={openCreate}>
            <Feather name="plus" size={16} color="white" />
            <Text style={S.emptyBtnText}>Ajouter un bus</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          {buses.map((bus) => (
            <BusCard key={bus.id} bus={bus} onEdit={() => openEdit(bus)} onDelete={() => handleDelete(bus)} />
          ))}
        </ScrollView>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={S.modalSafe}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>{editBus ? "Modifier le bus" : "Nouveau bus"}</Text>
            <Pressable onPress={() => setShowModal(false)} style={S.closeBtn}>
              <Feather name="x" size={20} color="#374151" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={S.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={S.label}>Nom du bus *</Text>
            <TextInput style={S.input} value={form.busName} onChangeText={v => setForm(p => ({ ...p, busName: v }))} placeholder="Ex: Express Abidjan 01" placeholderTextColor="#9CA3AF" />

            <Text style={S.label}>Numéro de plaque *</Text>
            <TextInput style={S.input} value={form.plateNumber} onChangeText={v => setForm(p => ({ ...p, plateNumber: v }))} placeholder="Ex: 0258 AB 01" placeholderTextColor="#9CA3AF" autoCapitalize="characters" />

            <Text style={S.label}>Type de bus</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {BUS_TYPES.map(bt => (
                  <Pressable key={bt} style={[S.typeChip, form.busType === bt && S.typeChipActive]} onPress={() => setForm(p => ({ ...p, busType: bt }))}>
                    <Text style={[S.typeChipText, form.busType === bt && S.typeChipTextActive]}>{bt}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={S.label}>Capacité (places)</Text>
            <TextInput style={S.input} value={form.capacity} onChangeText={v => setForm(p => ({ ...p, capacity: v }))} keyboardType="numeric" placeholder="44" placeholderTextColor="#9CA3AF" />

            {editBus && (
              <>
                <Text style={S.label}>Statut</Text>
                <View style={S.statusRow}>
                  {(["active", "maintenance", "inactive"] as Bus["status"][]).map(s => {
                    const sm = STATUS_META[s];
                    const sel = form.status === s;
                    return (
                      <Pressable key={s} style={[S.statusChip, sel && { backgroundColor: sm.bg, borderColor: sm.text }]} onPress={() => setForm(p => ({ ...p, status: s }))}>
                        <Feather name={sm.icon as any} size={13} color={sel ? sm.text : "#9CA3AF"} />
                        <Text style={[S.statusChipText, sel && { color: sm.text }]}>{sm.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <Pressable style={[S.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={S.saveBtnText}>{editBus ? "Enregistrer les modifications" : "Ajouter le bus"}</Text>}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: AMBER, paddingHorizontal: 16, paddingBottom: 16,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 1 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },

  statsRow: { flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 12 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0B3C5D" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },

  card: { backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  busIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: AMBER_LIGHT, justifyContent: "center", alignItems: "center" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  cardPlate: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748B", marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  dot: { color: "#CBD5E1", fontSize: 12 },
  cardMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardActions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  cardActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  cardActionText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  actionDivider: { width: 1, backgroundColor: "#F1F5F9" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 8, textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", marginBottom: 24, lineHeight: 22 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: AMBER, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },

  modalSafe: { flex: 1, backgroundColor: "white" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  modalBody: { padding: 20, gap: 4, paddingBottom: 40 },

  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: "#0F172A", backgroundColor: "#FAFAFA" },

  typeChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "white" },
  typeChipActive: { backgroundColor: AMBER_LIGHT, borderColor: AMBER },
  typeChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  typeChipTextActive: { color: AMBER, fontFamily: "Inter_700Bold" },

  statusRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statusChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "white" },
  statusChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#9CA3AF" },

  saveBtn: { backgroundColor: AMBER, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "white" },
});
