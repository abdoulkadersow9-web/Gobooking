import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal, FlatList,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/utils/api";
import OfflineBanner from "@/components/OfflineBanner";
import { useNetworkStatus } from "@/utils/offline";

const AMBER   = "#D97706";
const A_LIGHT = "#FFFBEB";
const A_DARK  = "#92400E";
const BLUE    = "#0369A1";
const GREEN   = "#059669";
const RED     = "#DC2626";

interface Stop {
  id: string;
  routeId: string;
  name: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  order: number;
}

interface Route {
  id: string;
  name: string;
  companyId: string;
  status: string;
  stops: Stop[];
}

/* ─── Helper ──────────────────────────────────────────────────────── */
function StopBadge({ order }: { order: number }) {
  return (
    <View style={ss.orderBadge}>
      <Text style={ss.orderTxt}>{order + 1}</Text>
    </View>
  );
}

/* ─── Main ────────────────────────────────────────────────────────── */
export default function RoutesScreen() {
  const { token } = useAuth();
  const insets    = useSafeAreaInsets();
  const networkStatus = useNetworkStatus(BASE_URL);

  const [routes,  setRoutes]  = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /* modals */
  const [showCreateRoute, setShowCreateRoute] = useState(false);
  const [showCreateStop,  setShowCreateStop]  = useState(false);
  const [showEditStop,    setShowEditStop]     = useState(false);
  const [activeRoute,     setActiveRoute]      = useState<Route | null>(null);
  const [editStop,        setEditStop]         = useState<Stop | null>(null);

  /* form */
  const [routeName,  setRouteName]  = useState("");
  const [stopName,   setStopName]   = useState("");
  const [stopCity,   setStopCity]   = useState("");
  const [stopLat,    setStopLat]    = useState("");
  const [stopLon,    setStopLon]    = useState("");

  const [saving, setSaving] = useState(false);

  /* ── fetch ── */
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<Route[]>("/company/routes", { token });
      setRoutes(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  /* ── toggle expand ── */
  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* ── create route ── */
  async function createRoute() {
    if (!routeName.trim()) { Alert.alert("Erreur", "Le nom est requis"); return; }
    setSaving(true);
    try {
      const r = await apiFetch<Route>("/company/routes", {
        token: token ?? undefined, method: "POST", body: { name: routeName.trim() },
      });
      setRoutes(prev => [...prev, { ...r, stops: [] }]);
      setRouteName("");
      setShowCreateRoute(false);
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Erreur création");
    } finally { setSaving(false); }
  }

  /* ── create stop ── */
  async function createStop() {
    if (!activeRoute) return;
    if (!stopName.trim() || !stopCity.trim()) {
      Alert.alert("Erreur", "Nom et ville sont requis"); return;
    }
    setSaving(true);
    try {
      const s = await apiFetch<Stop>(`/company/routes/${activeRoute.id}/stops`, {
        token: token ?? undefined, method: "POST",
        body: {
          name:      stopName.trim(),
          city:      stopCity.trim(),
          latitude:  stopLat  ? parseFloat(stopLat)  : null,
          longitude: stopLon ? parseFloat(stopLon) : null,
        },
      });
      setRoutes(prev => prev.map(r =>
        r.id === activeRoute.id ? { ...r, stops: [...r.stops, s] } : r,
      ));
      resetStopForm();
      setShowCreateStop(false);
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Erreur ajout arrêt");
    } finally { setSaving(false); }
  }

  /* ── update stop ── */
  async function updateStop() {
    if (!editStop) return;
    setSaving(true);
    try {
      const s = await apiFetch<Stop>(`/company/stops/${editStop.id}`, {
        token: token ?? undefined, method: "PUT",
        body: {
          name:      stopName.trim() || editStop.name,
          city:      stopCity.trim() || editStop.city,
          latitude:  stopLat  ? parseFloat(stopLat)  : editStop.latitude,
          longitude: stopLon ? parseFloat(stopLon) : editStop.longitude,
        },
      });
      setRoutes(prev => prev.map(r => ({
        ...r, stops: r.stops.map(st => st.id === s.id ? s : st),
      })));
      resetStopForm();
      setShowEditStop(false);
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Erreur mise à jour");
    } finally { setSaving(false); }
  }

  /* ── delete stop ── */
  async function deleteStop(stop: Stop) {
    Alert.alert("Supprimer l'arrêt", `Supprimer "${stop.name}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/company/stops/${stop.id}`, { token: token ?? undefined, method: "DELETE" });
            setRoutes(prev => prev.map(r => ({
              ...r, stops: r.stops.filter(s => s.id !== stop.id),
            })));
          } catch (e: any) { Alert.alert("Erreur", e.message); }
        },
      },
    ]);
  }

  /* ── delete route ── */
  async function deleteRoute(r: Route) {
    Alert.alert("Désactiver la route", `Désactiver "${r.name}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Désactiver", style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/company/routes/${r.id}`, { token: token ?? undefined, method: "DELETE" });
            setRoutes(prev => prev.map(x => x.id === r.id ? { ...x, status: "inactive" } : x));
          } catch (e: any) { Alert.alert("Erreur", e.message); }
        },
      },
    ]);
  }

  function resetStopForm() {
    setStopName(""); setStopCity(""); setStopLat(""); setStopLon("");
  }

  function openAddStop(route: Route) {
    setActiveRoute(route);
    resetStopForm();
    setShowCreateStop(true);
  }

  function openEditStop(stop: Stop) {
    setEditStop(stop);
    setStopName(stop.name);
    setStopCity(stop.city);
    setStopLat(stop.latitude?.toString() ?? "");
    setStopLon(stop.longitude?.toString() ?? "");
    setShowEditStop(true);
  }

  /* ── stats ── */
  const totalStops    = routes.reduce((s, r) => s + r.stops.length, 0);
  const activeRoutes  = routes.filter(r => r.status === "active").length;

  /* ────────────────────────────────── render ── */
  return (
    <View style={ss.root}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: AMBER }}>
        <View style={ss.header}>
          <Pressable onPress={() => router.back()} style={ss.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={ss.headerTitle}>Routes & Arrêts</Text>
          <Pressable style={ss.headerAdd} onPress={() => setShowCreateRoute(true)}>
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* KPI strip */}
      <View style={ss.kpiRow}>
        <View style={ss.kpi}>
          <Text style={ss.kpiNum}>{routes.length}</Text>
          <Text style={ss.kpiLabel}>Routes</Text>
        </View>
        <View style={ss.kpiDiv} />
        <View style={ss.kpi}>
          <Text style={ss.kpiNum}>{activeRoutes}</Text>
          <Text style={ss.kpiLabel}>Actives</Text>
        </View>
        <View style={ss.kpiDiv} />
        <View style={ss.kpi}>
          <Text style={ss.kpiNum}>{totalStops}</Text>
          <Text style={ss.kpiLabel}>Arrêts</Text>
        </View>
      </View>

      <OfflineBanner status={networkStatus} />

      {loading ? (
        <ActivityIndicator size="large" color={AMBER} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}>
          {routes.length === 0 && (
            <View style={ss.empty}>
              <Feather name="map" size={40} color="#D1D5DB" />
              <Text style={ss.emptyTxt}>Aucune route créée</Text>
              <Pressable style={ss.emptyBtn} onPress={() => setShowCreateRoute(true)}>
                <Text style={ss.emptyBtnTxt}>Créer une route</Text>
              </Pressable>
            </View>
          )}

          {routes.map(route => {
            const open = expanded.has(route.id);
            const isActive = route.status === "active";
            return (
              <View key={route.id} style={[ss.card, !isActive && { opacity: 0.55 }]}>
                {/* header row */}
                <Pressable style={ss.cardHead} onPress={() => toggleExpand(route.id)}>
                  <View style={ss.routeIcon}>
                    <Feather name="map-pin" size={18} color={AMBER} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ss.routeName}>{route.name}</Text>
                    <Text style={ss.routeMeta}>{route.stops.length} arrêt{route.stops.length !== 1 ? "s" : ""}</Text>
                  </View>
                  <View style={[ss.statusPill, { backgroundColor: isActive ? "#D1FAE5" : "#F3F4F6" }]}>
                    <Text style={[ss.statusTxt, { color: isActive ? GREEN : "#6B7280" }]}>
                      {isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                  <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color="#9CA3AF" style={{ marginLeft: 8 }} />
                </Pressable>

                {open && (
                  <View style={ss.stopsSection}>
                    {/* itinerary */}
                    {route.stops.length === 0 ? (
                      <Text style={ss.noStops}>Aucun arrêt configuré</Text>
                    ) : (
                      route.stops.map((stop, idx) => (
                        <View key={stop.id} style={ss.stopRow}>
                          {/* vertical line */}
                          <View style={ss.lineCol}>
                            <StopBadge order={stop.order} />
                            {idx < route.stops.length - 1 && <View style={ss.connector} />}
                          </View>
                          <View style={ss.stopInfo}>
                            <Text style={ss.stopName}>{stop.name}</Text>
                            <Text style={ss.stopCity}>{stop.city}</Text>
                            {(stop.latitude && stop.longitude) ? (
                              <Text style={ss.stopGps}>
                                <Feather name="navigation" size={10} color={BLUE} /> {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                              </Text>
                            ) : null}
                          </View>
                          <View style={ss.stopActions}>
                            <Pressable onPress={() => openEditStop(stop)} style={ss.iconBtn}>
                              <Feather name="edit-2" size={14} color={BLUE} />
                            </Pressable>
                            <Pressable onPress={() => deleteStop(stop)} style={ss.iconBtn}>
                              <Feather name="trash-2" size={14} color={RED} />
                            </Pressable>
                          </View>
                        </View>
                      ))
                    )}

                    {/* actions */}
                    <View style={ss.cardActions}>
                      <Pressable style={ss.addStopBtn} onPress={() => openAddStop(route)}>
                        <Feather name="plus" size={14} color={AMBER} />
                        <Text style={ss.addStopTxt}>Ajouter un arrêt</Text>
                      </Pressable>
                      {isActive && (
                        <Pressable style={ss.deactivateBtn} onPress={() => deleteRoute(route)}>
                          <Text style={ss.deactivateTxt}>Désactiver</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Modal: Create Route ── */}
      <Modal visible={showCreateRoute} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={ss.modalOverlay}>
          <View style={ss.modal}>
            <Text style={ss.modalTitle}>Nouvelle Route</Text>
            <Text style={ss.modalLabel}>Nom de la route</Text>
            <TextInput
              style={ss.input}
              placeholder="Ex: Abidjan → Bouaké"
              value={routeName}
              onChangeText={setRouteName}
              autoFocus
            />
            <View style={ss.modalRow}>
              <Pressable style={ss.modalCancel} onPress={() => { setShowCreateRoute(false); setRouteName(""); }}>
                <Text style={ss.modalCancelTxt}>Annuler</Text>
              </Pressable>
              <Pressable style={[ss.modalConfirm, saving && { opacity: 0.6 }]} onPress={createRoute} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={ss.modalConfirmTxt}>Créer</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Create Stop ── */}
      <Modal visible={showCreateStop} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={ss.modalOverlay}>
          <View style={ss.modal}>
            <Text style={ss.modalTitle}>Ajouter un arrêt</Text>
            {activeRoute && <Text style={ss.modalSub}>{activeRoute.name}</Text>}
            <Text style={ss.modalLabel}>Nom de l'arrêt *</Text>
            <TextInput style={ss.input} placeholder="Ex: Gare de Cocody" value={stopName} onChangeText={setStopName} />
            <Text style={ss.modalLabel}>Ville *</Text>
            <TextInput style={ss.input} placeholder="Ex: Abidjan" value={stopCity} onChangeText={setStopCity} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={ss.modalLabel}>Latitude</Text>
                <TextInput style={ss.input} placeholder="5.3600" value={stopLat} onChangeText={setStopLat} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.modalLabel}>Longitude</Text>
                <TextInput style={ss.input} placeholder="-4.0083" value={stopLon} onChangeText={setStopLon} keyboardType="numeric" />
              </View>
            </View>
            <View style={ss.modalRow}>
              <Pressable style={ss.modalCancel} onPress={() => { setShowCreateStop(false); resetStopForm(); }}>
                <Text style={ss.modalCancelTxt}>Annuler</Text>
              </Pressable>
              <Pressable style={[ss.modalConfirm, saving && { opacity: 0.6 }]} onPress={createStop} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={ss.modalConfirmTxt}>Ajouter</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Edit Stop ── */}
      <Modal visible={showEditStop} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={ss.modalOverlay}>
          <View style={ss.modal}>
            <Text style={ss.modalTitle}>Modifier l'arrêt</Text>
            <Text style={ss.modalLabel}>Nom de l'arrêt</Text>
            <TextInput style={ss.input} value={stopName} onChangeText={setStopName} autoFocus />
            <Text style={ss.modalLabel}>Ville</Text>
            <TextInput style={ss.input} value={stopCity} onChangeText={setStopCity} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={ss.modalLabel}>Latitude</Text>
                <TextInput style={ss.input} value={stopLat} onChangeText={setStopLat} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.modalLabel}>Longitude</Text>
                <TextInput style={ss.input} value={stopLon} onChangeText={setStopLon} keyboardType="numeric" />
              </View>
            </View>
            <View style={ss.modalRow}>
              <Pressable style={ss.modalCancel} onPress={() => { setShowEditStop(false); resetStopForm(); }}>
                <Text style={ss.modalCancelTxt}>Annuler</Text>
              </Pressable>
              <Pressable style={[ss.modalConfirm, saving && { opacity: 0.6 }]} onPress={updateStop} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={ss.modalConfirmTxt}>Enregistrer</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */
const ss = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#F9FAFB" },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4, backgroundColor: AMBER },
  backBtn:      { padding: 6, marginRight: 8 },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: "700", color: "#fff" },
  headerAdd:    { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, padding: 8 },
  kpiRow:       { flexDirection: "row", backgroundColor: "#fff", paddingVertical: 14, borderBottomWidth: 1, borderColor: "#F3F4F6" },
  kpi:          { flex: 1, alignItems: "center" },
  kpiNum:       { fontSize: 22, fontWeight: "800", color: AMBER },
  kpiLabel:     { fontSize: 11, color: "#6B7280", marginTop: 2 },
  kpiDiv:       { width: 1, backgroundColor: "#E5E7EB", marginVertical: 4 },
  card:         { backgroundColor: "#fff", borderRadius: 12, marginBottom: 12, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardHead:     { flexDirection: "row", alignItems: "center", padding: 14 },
  routeIcon:    { width: 36, height: 36, borderRadius: 10, backgroundColor: A_LIGHT, alignItems: "center", justifyContent: "center", marginRight: 10 },
  routeName:    { fontSize: 15, fontWeight: "700", color: "#111827" },
  routeMeta:    { fontSize: 12, color: "#6B7280", marginTop: 2 },
  statusPill:   { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusTxt:    { fontSize: 11, fontWeight: "600" },
  stopsSection: { borderTopWidth: 1, borderColor: "#F3F4F6", paddingHorizontal: 14, paddingBottom: 10 },
  noStops:      { color: "#9CA3AF", fontSize: 13, paddingVertical: 12, textAlign: "center" },
  stopRow:      { flexDirection: "row", alignItems: "flex-start", paddingVertical: 6 },
  lineCol:      { width: 32, alignItems: "center" },
  orderBadge:   { width: 24, height: 24, borderRadius: 12, backgroundColor: AMBER, alignItems: "center", justifyContent: "center" },
  orderTxt:     { fontSize: 11, fontWeight: "800", color: "#fff" },
  connector:    { width: 2, flex: 1, minHeight: 20, backgroundColor: "#FDE68A", marginTop: 2 },
  stopInfo:     { flex: 1, paddingLeft: 10 },
  stopName:     { fontSize: 14, fontWeight: "600", color: "#111827" },
  stopCity:     { fontSize: 12, color: "#6B7280" },
  stopGps:      { fontSize: 11, color: BLUE, marginTop: 2 },
  stopActions:  { flexDirection: "row", gap: 6, paddingTop: 2 },
  iconBtn:      { padding: 6, borderRadius: 6, backgroundColor: "#F9FAFB" },
  cardActions:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10 },
  addStopBtn:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: A_LIGHT, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addStopTxt:   { fontSize: 13, fontWeight: "600", color: AMBER },
  deactivateBtn:{ paddingHorizontal: 10, paddingVertical: 8 },
  deactivateTxt:{ fontSize: 12, color: RED },
  empty:        { alignItems: "center", marginTop: 60, gap: 12 },
  emptyTxt:     { fontSize: 16, color: "#9CA3AF" },
  emptyBtn:     { backgroundColor: AMBER, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyBtnTxt:  { color: "#fff", fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 8 },
  modalTitle:   { fontSize: 18, fontWeight: "800", color: "#111827" },
  modalSub:     { fontSize: 13, color: "#6B7280", marginTop: -4 },
  modalLabel:   { fontSize: 13, fontWeight: "600", color: "#374151" },
  input:        { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: "#F9FAFB" },
  modalRow:     { flexDirection: "row", gap: 10, marginTop: 6 },
  modalCancel:  { flex: 1, padding: 14, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center" },
  modalCancelTxt: { fontWeight: "600", color: "#374151" },
  modalConfirm: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: AMBER, alignItems: "center" },
  modalConfirmTxt: { fontWeight: "700", color: "#fff" },
});
