import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const INDIGO  = "#3730A3";
const INDIGO2 = "#4F46E5";
const LIGHT   = "#EEF2FF";

const CI_CITIES = [
  "Abidjan","Bouaké","Yamoussoukro","Korhogo","San Pedro","Daloa","Man","Gagnoa",
  "Divo","Dimbokro","Abengourou","Bondoukou","Ferké","Touba","Soubré","Agboville",
  "Aboisso","Sassandra","Tabou","Guiglo","Odienné","Séguéla","Katiola","Tiassalé",
];

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

type Trip = {
  id: string; from_city: string; to_city: string; date: string;
  departure_time: string; arrival_time: string; status: string; price: number;
  bus_name: string; bus_id: string | null; total_seats: number;
  passenger_count: number; parcel_count: number;
};
type Bus = {
  id: string; bus_name: string; plate_number: string; bus_type: string;
  capacity: number; availability_status: string;
};

type FormState = {
  from: string; to: string; date: string;
  departureTime: string; arrivalTime: string;
  price: string; busId: string;
};

function today() { return new Date().toISOString().slice(0, 10); }

export default function ChefTrips() {
  const { token } = useAuth();
  const authToken = token ?? "";

  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    from: "", to: "", date: today(), departureTime: "07:00",
    arrivalTime: "12:00", price: "", busId: "",
  });

  const load = useCallback(async () => {
    try {
      const [t, b] = await Promise.all([
        apiFetch<{ trips: Trip[] }>("/agent/chef/trips", { token: authToken }),
        apiFetch<{ buses: Bus[] }>("/agent/chef/available-buses", { token: authToken }),
      ]);
      setTrips(t.trips ?? []);
      setBuses((b.buses ?? []).filter(b => b.availability_status === "disponible"));
    } catch (e: any) {
      console.error("[chef-trips]", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  function openCreate() {
    setEditId(null);
    setForm({ from: "", to: "", date: today(), departureTime: "07:00", arrivalTime: "12:00", price: "", busId: "" });
    setShowForm(true);
  }

  function openEdit(trip: Trip) {
    setEditId(trip.id);
    setForm({
      from: trip.from_city, to: trip.to_city, date: trip.date,
      departureTime: trip.departure_time, arrivalTime: trip.arrival_time,
      price: String(trip.price ?? ""), busId: trip.bus_id ?? "",
    });
    setShowForm(true);
  }

  async function saveTrip() {
    if (!form.from || !form.to || !form.date || !form.departureTime) {
      Alert.alert("Champs manquants", "Veuillez remplir : départ, destination, date et heure.");
      return;
    }
    if (form.from === form.to) {
      Alert.alert("Erreur", "La ville de départ et d'arrivée doivent être différentes.");
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await apiFetch(`/agent/chef/trips/${editId}`, {
          method: "PUT", token: authToken,
          body: JSON.stringify({
            departureTime: form.departureTime,
            arrivalTime: form.arrivalTime,
            price: form.price ? Number(form.price) : undefined,
            busId: form.busId || undefined,
          }),
        });
        Alert.alert("Succès", "Départ modifié avec succès.");
      } else {
        await apiFetch("/agent/chef/trips", {
          method: "POST", token: authToken,
          body: JSON.stringify({
            from: form.from, to: form.to, date: form.date,
            departureTime: form.departureTime, arrivalTime: form.arrivalTime,
            price: form.price ? Number(form.price) : 0,
            busId: form.busId || undefined,
          }),
        });
        Alert.alert("Départ programmé ✅", `${form.from} → ${form.to} le ${form.date} à ${form.departureTime}.\nLes agents de l'agence ont été notifiés.`);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Une erreur s'est produite.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelTrip(tripId: string, route: string) {
    Alert.alert(
      "Confirmer l'annulation",
      `Annuler le départ ${route} ? Les passagers seront notifiés par SMS.`,
      [
        { text: "Non", style: "cancel" },
        {
          text: "Annuler le départ", style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/agent/chef/trips/${tripId}`, { method: "DELETE", token: authToken });
              load();
            } catch (e: any) {
              Alert.alert("Erreur", e.message ?? "Impossible d'annuler ce départ.");
            }
          },
        },
      ]
    );
  }

  function tripStatusInfo(s: string) {
    if (s === "scheduled") return { label: "Programmé", color: "#D97706", bg: "#FEF3C7" };
    if (s === "en_route")  return { label: "En route",  color: "#166534", bg: "#DCFCE7" };
    if (s === "completed") return { label: "Arrivé",    color: "#6B7280", bg: "#F3F4F6" };
    if (s === "cancelled") return { label: "Annulé",    color: "#DC2626", bg: "#FEE2E2" };
    return { label: s, color: "#6B7280", bg: "#F3F4F6" };
  }

  const grouped: { [date: string]: Trip[] } = {};
  trips.filter(t => t.status !== "cancelled").forEach(t => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });
  const sortedDates = Object.keys(grouped).sort();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFF" }}>
        <ActivityIndicator size="large" color={INDIGO2} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFF" }} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={INDIGO} />

      {/* Header */}
      <LinearGradient colors={[INDIGO, INDIGO2]} style={s.header}>
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color="white" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Gestion des départs</Text>
            <Text style={s.headerSub}>{trips.filter(t => t.status !== "cancelled").length} trajet(s) en vue</Text>
          </View>
          <Pressable style={s.addBtn} onPress={openCreate}>
            <Feather name="plus" size={20} color={INDIGO2} />
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INDIGO2} />}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
      >
        {sortedDates.length === 0 ? (
          <View style={s.emptyState}>
            <Feather name="calendar" size={48} color="#9CA3AF" />
            <Text style={s.emptyTitle}>Aucun départ programmé</Text>
            <Text style={s.emptyText}>Programmez votre premier départ en appuyant sur le bouton ci-dessous.</Text>
            <Pressable style={s.emptyBtn} onPress={openCreate}>
              <Feather name="plus-circle" size={16} color="white" />
              <Text style={s.emptyBtnText}>Programmer un départ</Text>
            </Pressable>
          </View>
        ) : (
          sortedDates.map(dateKey => {
            const dateLabel = dateKey === today()
              ? "Aujourd'hui — " + new Date(dateKey).toLocaleDateString("fr-CI", { day: "numeric", month: "long" })
              : new Date(dateKey).toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long" });
            return (
              <View key={dateKey} style={{ marginTop: 16, paddingHorizontal: 16 }}>
                <Text style={s.dateHeader}>{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</Text>
                {grouped[dateKey].map(trip => {
                  const st = tripStatusInfo(trip.status);
                  const pct = trip.total_seats > 0 ? (trip.passenger_count / trip.total_seats) * 100 : 0;
                  const canEdit   = trip.status === "scheduled";
                  const canCancel = trip.status === "scheduled";
                  return (
                    <View key={trip.id} style={s.tripCard}>
                      <View style={s.tripTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.tripRoute}>{trip.from_city} → {trip.to_city}</Text>
                          <View style={s.tripMeta}>
                            <Feather name="clock" size={12} color="#6B7280" />
                            <Text style={s.tripMetaText}>{trip.departure_time}</Text>
                            <Feather name="truck" size={12} color="#6B7280" />
                            <Text style={s.tripMetaText}>{trip.bus_name}</Text>
                          </View>
                        </View>
                        <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                          <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                        </View>
                      </View>

                      {/* Stats */}
                      <View style={s.tripStats}>
                        <View style={s.tripStatItem}>
                          <Feather name="users" size={14} color={INDIGO2} />
                          <Text style={s.tripStatVal}>{trip.passenger_count}</Text>
                          <Text style={s.tripStatLabel}>passagers</Text>
                        </View>
                        <View style={s.tripStatItem}>
                          <Feather name="package" size={14} color="#7C3AED" />
                          <Text style={s.tripStatVal}>{trip.parcel_count}</Text>
                          <Text style={s.tripStatLabel}>colis</Text>
                        </View>
                        <View style={s.tripStatItem}>
                          <Feather name="bar-chart-2" size={14} color="#166534" />
                          <Text style={s.tripStatVal}>{trip.total_seats - trip.passenger_count}</Text>
                          <Text style={s.tripStatLabel}>places libres</Text>
                        </View>
                      </View>

                      {/* Barre remplissage */}
                      <View style={s.fillBg}>
                        <View style={[s.fillBar, {
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: pct >= 90 ? "#DC2626" : pct >= 60 ? "#D97706" : "#166534",
                        }]} />
                      </View>
                      <Text style={s.fillLabel}>{Math.round(pct)}% rempli</Text>

                      {/* Actions */}
                      {(canEdit || canCancel) && (
                        <View style={s.tripActions}>
                          {canEdit && (
                            <Pressable style={[s.actionBtn, { backgroundColor: LIGHT, borderColor: INDIGO2 }]} onPress={() => openEdit(trip)}>
                              <Feather name="edit-2" size={14} color={INDIGO2} />
                              <Text style={[s.actionBtnText, { color: INDIGO2 }]}>Modifier</Text>
                            </Pressable>
                          )}
                          {canCancel && (
                            <Pressable style={[s.actionBtn, { backgroundColor: "#FEE2E2", borderColor: "#DC2626" }]}
                              onPress={() => cancelTrip(trip.id, `${trip.from_city} → ${trip.to_city}`)}>
                              <Feather name="x-circle" size={14} color="#DC2626" />
                              <Text style={[s.actionBtnText, { color: "#DC2626" }]}>Annuler</Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable style={s.fab} onPress={openCreate}>
        <Feather name="plus" size={24} color="white" />
      </Pressable>

      {/* ── Modal formulaire départ ── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFF" }} edges={["top"]}>
          <LinearGradient colors={[INDIGO, INDIGO2]} style={s.modalHeader}>
            <Pressable onPress={() => setShowForm(false)} style={{ padding: 4 }}>
              <Feather name="x" size={22} color="white" />
            </Pressable>
            <Text style={s.modalTitle}>{editId ? "Modifier le départ" : "Programmer un départ"}</Text>
            <View style={{ width: 30 }} />
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

            {/* Ville de départ */}
            {!editId && (
              <>
                <Text style={s.label}>Ville de départ *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {CI_CITIES.map(c => (
                      <Pressable key={c}
                        style={[s.cityChip, form.from === c && s.cityChipActive]}
                        onPress={() => setForm(f => ({ ...f, from: c }))}>
                        <Text style={[s.cityChipText, form.from === c && s.cityChipActiveText]}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                {/* Ville d'arrivée */}
                <Text style={s.label}>Destination *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {CI_CITIES.filter(c => c !== form.from).map(c => (
                      <Pressable key={c}
                        style={[s.cityChip, form.to === c && s.cityChipActive]}
                        onPress={() => setForm(f => ({ ...f, to: c }))}>
                        <Text style={[s.cityChipText, form.to === c && s.cityChipActiveText]}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                {/* Date */}
                <Text style={s.label}>Date du départ *</Text>
                <TextInput
                  style={s.input} value={form.date} placeholder="AAAA-MM-JJ"
                  placeholderTextColor="#9CA3AF"
                  onChangeText={v => setForm(f => ({ ...f, date: v }))}
                />
              </>
            )}

            {/* Heure de départ */}
            <Text style={s.label}>Heure de départ *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["05:00","06:00","07:00","08:00","09:00","10:00","12:00","13:00","14:00","15:00","16:00","18:00","20:00"].map(h => (
                  <Pressable key={h}
                    style={[s.timeChip, form.departureTime === h && s.timeChipActive]}
                    onPress={() => setForm(f => ({ ...f, departureTime: h }))}>
                    <Text style={[s.timeChipText, form.departureTime === h && { color: "white" }]}>{h}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Heure d'arrivée */}
            <Text style={s.label}>Heure d'arrivée estimée</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["06:00","07:00","08:00","09:00","10:00","11:00","12:00","14:00","16:00","18:00","20:00","22:00"].map(h => (
                  <Pressable key={h}
                    style={[s.timeChip, form.arrivalTime === h && s.timeChipActive]}
                    onPress={() => setForm(f => ({ ...f, arrivalTime: h }))}>
                    <Text style={[s.timeChipText, form.arrivalTime === h && { color: "white" }]}>{h}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Prix */}
            <Text style={s.label}>Tarif (FCFA)</Text>
            <TextInput
              style={s.input} value={form.price} placeholder="Ex : 2500"
              placeholderTextColor="#9CA3AF" keyboardType="number-pad"
              onChangeText={v => setForm(f => ({ ...f, price: v }))}
            />

            {/* Car */}
            <Text style={s.label}>Car affecté</Text>
            {buses.length === 0 ? (
              <View style={[s.input, { justifyContent: "center" }]}>
                <Text style={{ color: "#9CA3AF" }}>Aucun car disponible — tous sont en service</Text>
              </View>
            ) : (
              <>
                <Pressable
                  style={[s.input, { justifyContent: "center" }]}
                  onPress={() => setForm(f => ({ ...f, busId: "" }))}>
                  <Text style={{ color: !form.busId ? INDIGO2 : "#9CA3AF" }}>
                    {form.busId ? buses.find(b => b.id === form.busId)?.bus_name ?? "Sélectionner un car"
                      : "— Pas de car pour l'instant —"}
                  </Text>
                </Pressable>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {buses.map(b => (
                      <Pressable key={b.id}
                        style={[s.busChip, form.busId === b.id && s.busChipActive]}
                        onPress={() => setForm(f => ({ ...f, busId: b.id }))}>
                        <Feather name="truck" size={13} color={form.busId === b.id ? "white" : INDIGO2} />
                        <Text style={[s.busChipText, form.busId === b.id && { color: "white" }]}>
                          {b.bus_name} · {b.capacity} places
                        </Text>
                        <Text style={[{ fontSize: 10, color: form.busId === b.id ? "#C7D2FE" : "#9CA3AF" }]}>
                          {b.plate_number}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Résumé */}
            {!editId && form.from && form.to && form.date && (
              <View style={s.summary}>
                <Feather name="navigation" size={16} color={INDIGO2} />
                <Text style={s.summaryText}>
                  {form.from} → {form.to}{"  "}
                  le {form.date}{"  "}
                  à {form.departureTime}
                  {form.busId && `\nCar : ${buses.find(b => b.id === form.busId)?.bus_name}`}
                </Text>
              </View>
            )}

            {/* Bouton save */}
            <Pressable style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={saveTrip} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color="white" />
                  <Text style={s.saveBtnText}>{editId ? "Enregistrer les modifications" : "Programmer ce départ"}</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { padding: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "white" },
  headerSub: { fontSize: 12, color: "#A5B4FC", marginTop: 1 },
  addBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "white", justifyContent: "center", alignItems: "center",
  },

  dateHeader: { fontSize: 13, fontWeight: "700", color: INDIGO2, marginBottom: 8, textTransform: "capitalize" },

  tripCard: {
    backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: "#E0E7FF",
    shadowColor: INDIGO, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  tripTop: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  tripRoute: { fontSize: 16, fontWeight: "800", color: "#111827" },
  tripMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  tripMetaText: { fontSize: 12, color: "#6B7280", marginRight: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: "700" },

  tripStats: { flexDirection: "row", gap: 16, marginBottom: 10 },
  tripStatItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  tripStatVal: { fontSize: 14, fontWeight: "700", color: "#111827" },
  tripStatLabel: { fontSize: 11, color: "#9CA3AF" },

  fillBg: { height: 5, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" },
  fillBar: { height: 5, borderRadius: 4 },
  fillLabel: { fontSize: 10, color: "#9CA3AF", marginTop: 3 },

  tripActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  actionBtnText: { fontSize: 12, fontWeight: "700" },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 12 },
  emptyText: { fontSize: 14, color: "#9CA3AF", textAlign: "center", marginTop: 6, lineHeight: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: INDIGO2, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 20 },
  emptyBtnText: { color: "white", fontWeight: "700", fontSize: 14 },

  fab: {
    position: "absolute", bottom: 28, right: 20,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: INDIGO2, justifyContent: "center", alignItems: "center",
    shadowColor: INDIGO, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },

  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "white" },

  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: {
    backgroundColor: "white", borderWidth: 1.5, borderColor: "#E5E7EB",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: "#111827", marginBottom: 16,
  },

  cityChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "white", borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  cityChipActive: { backgroundColor: INDIGO2, borderColor: INDIGO2 },
  cityChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  cityChipActiveText: { color: "white" },

  timeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "white", borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  timeChipActive: { backgroundColor: INDIGO2, borderColor: INDIGO2 },
  timeChipText: { fontSize: 13, fontWeight: "700", color: "#374151" },

  busChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: LIGHT, borderWidth: 1.5, borderColor: "#C7D2FE",
    gap: 5, alignItems: "flex-start",
  },
  busChipActive: { backgroundColor: INDIGO2, borderColor: INDIGO },
  busChipText: { fontSize: 13, fontWeight: "700", color: INDIGO2 },

  summary: {
    backgroundColor: LIGHT, borderRadius: 14, padding: 14,
    flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 16,
    borderWidth: 1, borderColor: "#C7D2FE",
  },
  summaryText: { fontSize: 14, color: INDIGO, fontWeight: "600", lineHeight: 20, flex: 1 },

  saveBtn: {
    backgroundColor: INDIGO2, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16, borderRadius: 16, marginTop: 8,
  },
  saveBtnText: { color: "white", fontSize: 16, fontWeight: "800" },
});
