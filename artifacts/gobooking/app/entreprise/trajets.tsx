import { Feather } from "@expo/vector-icons";
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

const AMBER        = "#D97706";
const AMBER_LIGHT  = "#FFFBEB";
const AMBER_BORDER = "#FDE68A";
const PRIMARY      = "#0B3C5D";

/* ─── Types ──────────────────────────────────────────────── */
interface Bus {
  id: string; busName: string; plateNumber: string; busType: string; capacity: number; status: string;
}

interface Trip {
  id: string; from: string; to: string; date: string;
  departureTime: string; arrivalTime: string; price: number;
  totalSeats: number; duration: string; status: string;
  busId: string | null; busDisplayName: string | null;
  busPlate: string | null; busCapacity: number | null;
  availableSeats: number; bookedSeats: number;
}

/* ─── Status metadata ─────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  scheduled:  { label: "En attente",  bg: "#FEF3C7", text: "#92400E",  icon: "clock" },
  en_attente: { label: "En attente",  bg: "#FEF3C7", text: "#92400E",  icon: "clock" },
  en_route:   { label: "En cours",    bg: "#DCFCE7", text: "#166534",  icon: "navigation" },
  completed:  { label: "Terminé",     bg: "#F1F5F9", text: "#475569",  icon: "check-circle" },
  terminé:    { label: "Terminé",     bg: "#F1F5F9", text: "#475569",  icon: "check-circle" },
  cancelled:  { label: "Annulé",      bg: "#FEE2E2", text: "#991B1B",  icon: "x-circle" },
};

const FILTER_TABS = [
  { key: "all",       label: "Tous" },
  { key: "waiting",   label: "En attente" },
  { key: "running",   label: "En cours" },
  { key: "done",      label: "Terminés" },
];

const CITIES = ["Abidjan", "Bouaké", "Yamoussoukro", "Korhogo", "San Pedro", "Man", "Daloa", "Gagnoa", "Abengourou", "Divo", "Soubré", "Odienné"];

/* ─── Seat progress bar ──────────────────────────────────── */
function SeatBar({ booked, total }: { booked: number; total: number }) {
  const pct = total > 0 ? Math.min(1, booked / total) : 0;
  const color = pct > 0.85 ? "#EF4444" : pct > 0.6 ? AMBER : "#059669";
  return (
    <View style={SB.wrap}>
      <View style={SB.track}>
        <View style={[SB.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[SB.label, { color }]}>{total - booked} place{total - booked !== 1 ? "s" : ""} libre{total - booked !== 1 ? "s" : ""}</Text>
    </View>
  );
}
const SB = StyleSheet.create({
  wrap: { gap: 4 },
  track: { height: 5, borderRadius: 3, backgroundColor: "#E2E8F0", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium" },
});

/* ─── Trip Card ──────────────────────────────────────────── */
function TripCard({ trip, onStart, onEnd, onDelete }: {
  trip: Trip;
  onStart: () => void;
  onEnd: () => void;
  onDelete: () => void;
}) {
  const sm = STATUS_META[trip.status] ?? STATUS_META.scheduled;
  const isWaiting  = ["scheduled", "en_attente"].includes(trip.status);
  const isRunning  = trip.status === "en_route";

  return (
    <View style={TC.card}>
      {/* Route row */}
      <View style={TC.routeRow}>
        <View style={{ flex: 1 }}>
          <View style={TC.cities}>
            <Text style={TC.city}>{trip.from}</Text>
            <Feather name="arrow-right" size={14} color="#94A3B8" />
            <Text style={TC.city}>{trip.to}</Text>
          </View>
          <Text style={TC.date}>{trip.date} · {trip.departureTime}→{trip.arrivalTime}</Text>
        </View>
        <View style={[TC.badge, { backgroundColor: sm.bg }]}>
          <Feather name={sm.icon as any} size={11} color={sm.text} />
          <Text style={[TC.badgeText, { color: sm.text }]}>{sm.label}</Text>
        </View>
      </View>

      {/* Bus row */}
      <View style={TC.infoRow}>
        <View style={TC.infoChip}>
          <Text style={TC.infoEmoji}>🚌</Text>
          <Text style={TC.infoText} numberOfLines={1}>{trip.busDisplayName ?? trip.to ?? "—"}</Text>
        </View>
        {trip.busPlate && (
          <View style={TC.infoChip}>
            <Feather name="credit-card" size={11} color="#64748B" />
            <Text style={TC.infoText}>{trip.busPlate}</Text>
          </View>
        )}
        <View style={TC.infoChip}>
          <Feather name="tag" size={11} color="#64748B" />
          <Text style={TC.infoText}>{trip.price.toLocaleString()} FCFA</Text>
        </View>
      </View>

      {/* Seat bar */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
        <SeatBar booked={trip.bookedSeats} total={trip.totalSeats} />
        <Text style={TC.seatSub}>{trip.bookedSeats}/{trip.totalSeats} réservé{trip.bookedSeats !== 1 ? "s" : ""}</Text>
      </View>

      {/* Actions */}
      {(isWaiting || isRunning) && (
        <View style={TC.actions}>
          {isWaiting && (
            <Pressable style={[TC.actionBtn, TC.startBtn]} onPress={onStart}>
              <Feather name="play" size={13} color="white" />
              <Text style={TC.startBtnText}>Démarrer le trajet</Text>
            </Pressable>
          )}
          {isRunning && (
            <Pressable style={[TC.actionBtn, TC.endBtn]} onPress={onEnd}>
              <Feather name="stop-circle" size={13} color="white" />
              <Text style={TC.endBtnText}>Terminer le trajet</Text>
            </Pressable>
          )}
          <Pressable style={TC.deleteBtn} onPress={onDelete}>
            <Feather name="trash-2" size={14} color="#EF4444" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
const TC = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 12, overflow: "hidden" },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, paddingBottom: 8 },
  cities: { flexDirection: "row", alignItems: "center", gap: 6 },
  city: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  date: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 3 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  infoChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#F8FAFC", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#E2E8F0" },
  infoEmoji: { fontSize: 12 },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569", maxWidth: 120 },
  seatSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 3 },
  actions: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  startBtn: { backgroundColor: "#059669" },
  endBtn:   { backgroundColor: "#6366F1" },
  startBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },
  endBtnText:   { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },
  deleteBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
});

/* ─── Main Screen ────────────────────────────────────────── */
export default function TrajetsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [trips, setTrips]       = useState<Trip[]>([]);
  const [buses, setBuses]       = useState<Bus[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);

  const [form, setForm] = useState({
    from: "", to: "", date: "", departureTime: "08:00",
    arrivalTime: "12:00", price: "", duration: "4h00", busId: "",
  });

  const loadData = useCallback(async () => {
    try {
      const [tripsData, busesData] = await Promise.all([
        apiFetch<Trip[]>("/company/trips", { token: token ?? undefined }),
        apiFetch<Bus[]>("/company/buses", { token: token ?? undefined }),
      ]);
      setTrips(tripsData);
      setBuses(busesData.filter(b => b.status === "active"));
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const filterTrips = (trips: Trip[]) => {
    switch (filter) {
      case "waiting": return trips.filter(t => ["scheduled", "en_attente"].includes(t.status));
      case "running": return trips.filter(t => t.status === "en_route");
      case "done":    return trips.filter(t => ["completed", "terminé", "cancelled"].includes(t.status));
      default:        return trips;
    }
  };

  const handleCreateTrip = async () => {
    if (!form.from.trim() || !form.to.trim() || !form.date.trim() || !form.departureTime || !form.price) {
      Alert.alert("Erreur", "Remplissez tous les champs obligatoires (trajet, date, heure, prix).");
      return;
    }
    setSaving(true);
    try {
      const newTrip = await apiFetch<Trip>("/company/trips", {
        token: token ?? undefined, method: "POST",
        body: {
          from: form.from, to: form.to, date: form.date,
          departureTime: form.departureTime, arrivalTime: form.arrivalTime,
          price: Number(form.price), duration: form.duration,
          busId: form.busId || null,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowModal(false);
      setTrips(prev => [{ ...newTrip, availableSeats: 0, bookedSeats: 0 } as Trip, ...prev]);
      setForm({ from: "", to: "", date: "", departureTime: "08:00", arrivalTime: "12:00", price: "", duration: "4h00", busId: "" });
    } catch (err: any) {
      Alert.alert("Erreur", err?.message ?? "Impossible de créer le trajet.");
    } finally {
      setSaving(false);
    }
  };

  const handleStart = (trip: Trip) => {
    Alert.alert("Démarrer le trajet ?", `${trip.from} → ${trip.to} sera marqué comme "En cours".`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Démarrer", onPress: async () => {
          try {
            await apiFetch(`/company/trips/${trip.id}/start`, { token: token ?? undefined, method: "POST", body: {} });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTrips(prev => prev.map(t => t.id === trip.id ? { ...t, status: "en_route" } : t));
          } catch (err: any) {
            Alert.alert("Erreur", err?.message ?? "Impossible de démarrer le trajet.");
          }
        },
      },
    ]);
  };

  const handleEnd = (trip: Trip) => {
    Alert.alert("Terminer le trajet ?", `${trip.from} → ${trip.to} sera marqué comme "Terminé".`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Terminer", onPress: async () => {
          try {
            await apiFetch(`/company/trips/${trip.id}/end`, { token: token ?? undefined, method: "POST", body: {} });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTrips(prev => prev.map(t => t.id === trip.id ? { ...t, status: "completed" } : t));
          } catch (err: any) {
            Alert.alert("Erreur", err?.message ?? "Impossible de terminer le trajet.");
          }
        },
      },
    ]);
  };

  const handleDelete = (trip: Trip) => {
    Alert.alert("Supprimer ce trajet ?", `${trip.from} → ${trip.to} (${trip.date}) sera supprimé.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/company/trips/${trip.id}`, { token: token ?? undefined, method: "DELETE" });
            setTrips(prev => prev.filter(t => t.id !== trip.id));
          } catch {
            setTrips(prev => prev.filter(t => t.id !== trip.id));
          }
        },
      },
    ]);
  };

  const visible = filterTrips(trips);
  const countWaiting = trips.filter(t => ["scheduled", "en_attente"].includes(t.status)).length;
  const countRunning = trips.filter(t => t.status === "en_route").length;
  const countDone    = trips.filter(t => ["completed", "terminé", "cancelled"].includes(t.status)).length;

  return (
    <SafeAreaView style={S.safe} edges={["bottom"]}>
      {/* Header */}
      <View style={[S.header, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Planification des trajets</Text>
          <Text style={S.headerSub}>{trips.length} trajet{trips.length !== 1 ? "s" : ""} au total</Text>
        </View>
        <Pressable style={S.addBtn} onPress={() => setShowModal(true)}>
          <Feather name="plus" size={18} color="white" />
          <Text style={S.addBtnText}>Nouveau</Text>
        </Pressable>
      </View>

      {/* Stats strip */}
      <View style={S.statsRow}>
        <View style={S.statCard}>
          <Text style={S.statValue}>{trips.length}</Text>
          <Text style={S.statLabel}>Total</Text>
        </View>
        <View style={S.statCard}>
          <Text style={[S.statValue, { color: "#92400E" }]}>{countWaiting}</Text>
          <Text style={S.statLabel}>En attente</Text>
        </View>
        <View style={S.statCard}>
          <Text style={[S.statValue, { color: "#059669" }]}>{countRunning}</Text>
          <Text style={S.statLabel}>En cours</Text>
        </View>
        <View style={S.statCard}>
          <Text style={[S.statValue, { color: "#475569" }]}>{countDone}</Text>
          <Text style={S.statLabel}>Terminés</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabsScroll} contentContainerStyle={S.tabsContent}>
        {FILTER_TABS.map(tab => (
          <Pressable key={tab.key} style={[S.tab, filter === tab.key && S.tabActive]} onPress={() => setFilter(tab.key)}>
            <Text style={[S.tabText, filter === tab.key && S.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={AMBER} size="large" style={{ marginTop: 60 }} />
      ) : visible.length === 0 ? (
        <View style={S.empty}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🗓️</Text>
          <Text style={S.emptyTitle}>
            {filter === "all" ? "Aucun trajet planifié" : "Aucun trajet dans cette catégorie"}
          </Text>
          <Text style={S.emptySub}>
            {filter === "all" ? "Créez votre premier trajet en sélectionnant un bus et une heure de départ." : "Changez de filtre ou créez un nouveau trajet."}
          </Text>
          {filter === "all" && (
            <Pressable style={S.emptyBtn} onPress={() => setShowModal(true)}>
              <Feather name="plus" size={16} color="white" />
              <Text style={S.emptyBtnText}>Créer un trajet</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {visible.map(trip => (
            <TripCard
              key={trip.id} trip={trip}
              onStart={() => handleStart(trip)}
              onEnd={() => handleEnd(trip)}
              onDelete={() => handleDelete(trip)}
            />
          ))}
        </ScrollView>
      )}

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={S.modalSafe}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>Nouveau trajet</Text>
            <Pressable onPress={() => setShowModal(false)} style={S.closeBtn}>
              <Feather name="x" size={20} color="#374151" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={S.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Route */}
            <Text style={S.sectionLabel}>🗺️ Itinéraire</Text>
            <View style={S.row2}>
              <View style={{ flex: 1 }}>
                <Text style={S.label}>Ville de départ *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {CITIES.map(c => (
                      <Pressable key={c} style={[S.cityChip, form.from === c && S.cityChipActive]} onPress={() => setForm(p => ({ ...p, from: c }))}>
                        <Text style={[S.cityChipText, form.from === c && S.cityChipTextActive]}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
                <TextInput style={S.input} value={form.from} onChangeText={v => setForm(p => ({ ...p, from: v }))} placeholder="Ou tapez une ville…" placeholderTextColor="#9CA3AF" />
              </View>
            </View>

            <View style={{ flex: 1, marginTop: 8 }}>
              <Text style={S.label}>Ville d'arrivée *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {CITIES.filter(c => c !== form.from).map(c => (
                    <Pressable key={c} style={[S.cityChip, form.to === c && S.cityChipActive]} onPress={() => setForm(p => ({ ...p, to: c }))}>
                      <Text style={[S.cityChipText, form.to === c && S.cityChipTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <TextInput style={S.input} value={form.to} onChangeText={v => setForm(p => ({ ...p, to: v }))} placeholder="Ou tapez une ville…" placeholderTextColor="#9CA3AF" />
            </View>

            {/* Date & Times */}
            <Text style={[S.sectionLabel, { marginTop: 20 }]}>📅 Date & Horaires</Text>
            <Text style={S.label}>Date du trajet * (JJ/MM/AAAA)</Text>
            <TextInput style={S.input} value={form.date} onChangeText={v => setForm(p => ({ ...p, date: v }))} placeholder="25/03/2026" placeholderTextColor="#9CA3AF" keyboardType="numeric" />

            <View style={S.row2}>
              <View style={{ flex: 1 }}>
                <Text style={S.label}>Heure départ *</Text>
                <TextInput style={S.input} value={form.departureTime} onChangeText={v => setForm(p => ({ ...p, departureTime: v }))} placeholder="08:00" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.label}>Heure arrivée</Text>
                <TextInput style={S.input} value={form.arrivalTime} onChangeText={v => setForm(p => ({ ...p, arrivalTime: v }))} placeholder="12:00" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
              </View>
            </View>

            <Text style={S.label}>Durée</Text>
            <TextInput style={S.input} value={form.duration} onChangeText={v => setForm(p => ({ ...p, duration: v }))} placeholder="4h00" placeholderTextColor="#9CA3AF" />

            {/* Price */}
            <Text style={[S.sectionLabel, { marginTop: 20 }]}>💵 Tarif</Text>
            <Text style={S.label}>Prix par place (FCFA) *</Text>
            <TextInput style={S.input} value={form.price} onChangeText={v => setForm(p => ({ ...p, price: v }))} placeholder="3500" placeholderTextColor="#9CA3AF" keyboardType="numeric" />

            {/* Bus selector */}
            <Text style={[S.sectionLabel, { marginTop: 20 }]}>🚌 Assignation du bus</Text>
            {buses.length === 0 ? (
              <View style={S.noBusBox}>
                <Feather name="alert-circle" size={16} color="#92400E" />
                <Text style={S.noBusText}>Aucun bus actif disponible. Ajoutez un bus d'abord.</Text>
                <Pressable onPress={() => { setShowModal(false); router.push("/entreprise/buses" as never); }}>
                  <Text style={S.noBusLink}>Gérer les bus →</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={S.label}>Sélectionner un bus</Text>
                {buses.map(bus => {
                  const sel = form.busId === bus.id;
                  return (
                    <Pressable key={bus.id} style={[S.busOption, sel && S.busOptionActive]} onPress={() => setForm(p => ({ ...p, busId: sel ? "" : bus.id }))}>
                      <Text style={{ fontSize: 22 }}>🚌</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[S.busOptionName, sel && { color: AMBER }]}>{bus.busName}</Text>
                        <Text style={S.busOptionSub}>{bus.plateNumber} · {bus.busType} · {bus.capacity} places</Text>
                      </View>
                      {sel && <Feather name="check-circle" size={18} color={AMBER} />}
                    </Pressable>
                  );
                })}
              </>
            )}

            <Pressable style={[S.saveBtn, saving && { opacity: 0.7 }]} onPress={handleCreateTrip} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="white" /> : (
                <>
                  <Feather name="calendar" size={16} color="white" />
                  <Text style={S.saveBtnText}>Planifier le trajet</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },

  header: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: AMBER, paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 1 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },

  statsRow: { flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 12 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },

  tabsScroll: { backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", flexGrow: 0 },
  tabsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "white" },
  tabActive: { backgroundColor: AMBER_LIGHT, borderColor: AMBER },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  tabTextActive: { color: AMBER, fontFamily: "Inter_700Bold" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 8, textAlign: "center" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: AMBER, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },

  modalSafe: { flex: 1, backgroundColor: "white" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  modalBody: { padding: 20, paddingBottom: 60 },

  sectionLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY, marginBottom: 8 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: "#0F172A", backgroundColor: "#FAFAFA" },
  row2: { flexDirection: "row", gap: 12 },

  cityChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "white" },
  cityChipActive: { backgroundColor: AMBER_LIGHT, borderColor: AMBER },
  cityChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748B" },
  cityChipTextActive: { color: AMBER, fontFamily: "Inter_700Bold" },

  noBusBox: { flexDirection: "column", alignItems: "center", gap: 8, backgroundColor: AMBER_LIGHT, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: AMBER_BORDER },
  noBusText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#92400E", textAlign: "center" },
  noBusLink: { fontSize: 13, fontFamily: "Inter_700Bold", color: AMBER, textDecorationLine: "underline" },

  busOption: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "white", marginBottom: 8 },
  busOptionActive: { backgroundColor: AMBER_LIGHT, borderColor: AMBER },
  busOptionName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" },
  busOptionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },

  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: AMBER, borderRadius: 12, paddingVertical: 16, marginTop: 24 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "white" },
});
