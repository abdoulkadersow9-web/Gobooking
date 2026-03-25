import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { BASE_URL } from "@/utils/api";

const BLUE   = "#0369A1";
const BLUE_D = "#075985";
const BLUE_L = "#E0F2FE";

function authHeader(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ── Status maps ─────────────────────────────────────────────────── */
const STATUS_BUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  en_attente: { label: "En attente",  color: "#D97706", bg: "#FEF3C7", icon: "time-outline" },
  programmé:  { label: "Programmé",   color: "#0369A1", bg: "#E0F2FE", icon: "calendar-outline" },
  en_route:   { label: "En route",    color: "#166534", bg: "#DCFCE7", icon: "navigate-outline" },
  arrivé:     { label: "Arrivé",      color: "#0369A1", bg: "#DBEAFE", icon: "checkmark-circle-outline" },
  en_panne:   { label: "En panne",    color: "#DC2626", bg: "#FEE2E2", icon: "warning-outline" },
};
function getBusStatus(s: string) {
  return STATUS_BUS[s] ?? { label: s, color: "#64748B", bg: "#F1F5F9", icon: "bus-outline" };
}

const STATUS_DEP: Record<string, { label: string; color: string; bg: string }> = {
  "programmé": { label: "Programmé",  color: "#0369A1", bg: "#E0F2FE" },
  "en route":  { label: "En route",   color: "#166534", bg: "#DCFCE7" },
  "terminé":   { label: "Terminé",    color: "#64748B", bg: "#F1F5F9" },
  "annulé":    { label: "Annulé",     color: "#DC2626", bg: "#FEE2E2" },
};
function getDepStatus(s: string) {
  return STATUS_DEP[s] ?? { label: s, color: "#64748B", bg: "#F1F5F9" };
}

const BUS_STATUTS = [
  { value: "en_attente", label: "En attente",  icon: "time-outline",             color: "#D97706" },
  { value: "programmé",  label: "Programmé",   icon: "calendar-outline",         color: "#0369A1" },
  { value: "en_route",   label: "En route",    icon: "navigate-outline",         color: "#166534" },
  { value: "arrivé",     label: "Arrivé",      icon: "checkmark-circle-outline", color: "#0369A1" },
  { value: "en_panne",   label: "En panne",    icon: "warning-outline",          color: "#DC2626" },
];
const DEP_STATUTS = ["programmé", "en route", "terminé", "annulé"];

/* ── Types ───────────────────────────────────────────────────────── */
interface BusStat { busesEnRoute: number; busesEnAttente: number; busesEnPanne: number; colisEnAttente: number; ticketsVendusAuj: number }
interface BusItem { id: string; busName: string; plateNumber: string; busType: string; capacity: number; logisticStatus: string; currentLocation?: string; condition: string }
interface TripItem { id: string; from: string; to: string; departureTime: string; status: string; busId?: string; busName?: string }
interface AlertItem { id: string; type: string; busId?: string; message: string; status: string; createdAt: string }
interface DepartureItem {
  id: string; busId?: string; busName?: string; plateNumber?: string;
  villeDepart: string; villeArrivee: string; heureDepart: string;
  chauffeurNom?: string; agentRouteNom?: string; statut: string; createdAt: string;
}
interface Overview { stats: BusStat; buses: BusItem[]; trips: TripItem[]; alerts: AlertItem[] }

/* ══════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ══════════════════════════════════════════════════════════════════ */
export default function LogistiqueScreen() {
  const { user, token, logout } = useAuth();
  const [data,        setData]        = useState<Overview | null>(null);
  const [departures,  setDepartures]  = useState<DepartureItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [actionId,    setActionId]    = useState<string | null>(null);

  /* Departure modal */
  const [showDepModal,  setShowDepModal]  = useState(false);
  const [depForm, setDepForm] = useState({ busId: "", villeDepart: "", villeArrivee: "", heureDepart: "", chauffeurNom: "", agentRouteNom: "" });
  const [savingDep, setSavingDep] = useState(false);

  /* Bus status modal */
  const [statusBus, setStatusBus] = useState<BusItem | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  /* Departure status modal */
  const [statusDep, setStatusDep] = useState<DepartureItem | null>(null);

  const isAgent = user?.role === "agent";

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [overviewRes, depsRes] = await Promise.all([
        fetch(`${BASE_URL}/agent/logistique/overview`, { headers: authHeader(token) }),
        fetch(`${BASE_URL}/agent/logistique/departures`, { headers: authHeader(token) }),
      ]);
      if (overviewRes.ok) setData(await overviewRes.json());
      if (depsRes.ok)     setDepartures(await depsRes.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(true); };

  /* ── Bus quick actions ── */
  const doAction = async (busId: string, action: "mettre-en-route" | "marquer-arrive" | "signaler-panne" | "remettre-en-attente") => {
    if (action === "signaler-panne") {
      Alert.prompt("Signaler une panne", "Décrivez le problème :", async (issue) => {
        setActionId(busId);
        try {
          await fetch(`${BASE_URL}/agent/logistique/buses/${busId}/signaler-panne`, {
            method: "POST",
            headers: { ...authHeader(token), "Content-Type": "application/json" },
            body: JSON.stringify({ issue }),
          });
          await load(true);
        } catch {}
        setActionId(null);
      }, "plain-text");
      return;
    }

    const labels: Record<string, string> = {
      "mettre-en-route": "Mettre en route", "marquer-arrive": "Marquer arrivé", "remettre-en-attente": "Remettre en attente",
    };
    Alert.alert(labels[action], "Confirmer cette action ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Confirmer", onPress: async () => {
        setActionId(busId);
        try {
          await fetch(`${BASE_URL}/agent/logistique/buses/${busId}/${action}`, {
            method: "POST", headers: { ...authHeader(token), "Content-Type": "application/json" },
          });
          await load(true);
        } catch { Alert.alert("Erreur", "Action impossible."); }
        setActionId(null);
      }},
    ]);
  };

  /* ── Change bus status directly ── */
  const changeBusStatus = async (busId: string, statut: string) => {
    setSavingStatus(true);
    try {
      await fetch(`${BASE_URL}/agent/logistique/buses/${busId}/statut`, {
        method: "PATCH",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        body: JSON.stringify({ statut }),
      });
      setStatusBus(null);
      await load(true);
    } catch { Alert.alert("Erreur", "Impossible de changer le statut."); }
    setSavingStatus(false);
  };

  /* ── Create departure ── */
  const createDeparture = async () => {
    const { villeDepart, villeArrivee, heureDepart } = depForm;
    if (!villeDepart.trim() || !villeArrivee.trim() || !heureDepart.trim()) {
      Alert.alert("Champs requis", "Ville départ, ville arrivée et heure sont obligatoires."); return;
    }
    setSavingDep(true);
    try {
      const res = await fetch(`${BASE_URL}/agent/logistique/departures`, {
        method: "POST",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          busId:         depForm.busId.trim()         || undefined,
          villeDepart:   depForm.villeDepart.trim(),
          villeArrivee:  depForm.villeArrivee.trim(),
          heureDepart:   depForm.heureDepart.trim(),
          chauffeurNom:  depForm.chauffeurNom.trim()  || undefined,
          agentRouteNom: depForm.agentRouteNom.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowDepModal(false);
        setDepForm({ busId: "", villeDepart: "", villeArrivee: "", heureDepart: "", chauffeurNom: "", agentRouteNom: "" });
        await load(true);
      } else {
        const err = await res.json();
        Alert.alert("Erreur", err.error ?? "Impossible de créer le départ.");
      }
    } catch { Alert.alert("Erreur", "Problème réseau."); }
    setSavingDep(false);
  };

  /* ── Update departure status ── */
  const updateDepStatus = async (dep: DepartureItem, statut: string) => {
    try {
      await fetch(`${BASE_URL}/agent/logistique/departures/${dep.id}`, {
        method: "PATCH",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        body: JSON.stringify({ statut }),
      });
      setStatusDep(null);
      await load(true);
    } catch { Alert.alert("Erreur", "Impossible de mettre à jour."); }
  };

  if (!isAgent) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 14, backgroundColor: "#fff", padding: 32 }}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>Accès non autorisé</Text>
        <TouchableOpacity style={{ backgroundColor: BLUE, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 }}
          onPress={() => router.replace("/agent/home" as never)}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE_D} />

      {/* Header */}
      <View style={S.header}>
        <View style={S.headerRow}>
          <View style={S.headerIcon}><Ionicons name="bus" size={22} color="#fff" /></View>
          <View>
            <Text style={S.headerTitle}>🚛 Logistique</Text>
            <Text style={S.headerSub}>Gestion des bus & départs</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => setShowDepModal(true)} style={S.addBtn}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={S.addBtnTxt}>Départ</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={S.logoutBtn}>
            <Text style={S.logoutTxt}>Déco.</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !data ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={{ marginTop: 12, color: "#64748B" }}>Chargement...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── STATS ── */}
          {data?.stats && (
            <View style={S.section}>
              <Text style={S.sectionTitle}>📊 Tableau de bord</Text>
              <View style={S.statsGrid}>
                <StatCard label="En route"   value={data.stats.busesEnRoute}     color="#166534" bg="#DCFCE7" icon="navigate" />
                <StatCard label="Attente"    value={data.stats.busesEnAttente}   color="#D97706" bg="#FEF3C7" icon="time" />
                <StatCard label="En panne"   value={data.stats.busesEnPanne}     color="#DC2626" bg="#FEE2E2" icon="warning" />
                <StatCard label="Colis"      value={data.stats.colisEnAttente}   color="#7C3AED" bg="#EDE9FE" icon="cube" />
                <StatCard label="Tickets"    value={data.stats.ticketsVendusAuj} color="#0369A1" bg="#E0F2FE" icon="ticket" />
              </View>
            </View>
          )}

          {/* ── ALERTES ── */}
          {!!data?.alerts?.length && (
            <View style={S.section}>
              <Text style={S.sectionTitle}>🚨 Anomalies ({data.alerts.length})</Text>
              {data.alerts.map(a => (
                <View key={a.id} style={S.alertCard}>
                  <Ionicons name="warning" size={20} color="#DC2626" />
                  <Text style={S.alertMsg} numberOfLines={2}>{a.message}</Text>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text style={S.alertTime}>{new Date(a.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</Text>
                    <View style={[S.badge, { backgroundColor: "#FEE2E2" }]}>
                      <Text style={{ fontSize: 9, fontWeight: "700", color: "#DC2626" }}>{a.type.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── DÉPARTS PROGRAMMÉS ── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>🗓️ Départs ({departures.length})</Text>
              <TouchableOpacity style={S.sectionBtn} onPress={() => setShowDepModal(true)}>
                <Feather name="plus" size={13} color={BLUE} />
                <Text style={{ fontSize: 12, color: BLUE, fontWeight: "700" }}>Programmer</Text>
              </TouchableOpacity>
            </View>
            {!departures.length && (
              <View style={S.empty}>
                <Ionicons name="calendar-outline" size={28} color="#CBD5E1" />
                <Text style={S.emptyTxt}>Aucun départ programmé</Text>
                <TouchableOpacity style={[S.sectionBtn, { marginTop: 8 }]} onPress={() => setShowDepModal(true)}>
                  <Text style={{ fontSize: 12, color: BLUE, fontWeight: "700" }}>+ Programmer un départ</Text>
                </TouchableOpacity>
              </View>
            )}
            {departures.map(dep => {
              const st = getDepStatus(dep.statut);
              return (
                <View key={dep.id} style={S.depCard}>
                  <View style={S.depTop}>
                    <View style={S.depIconBox}>
                      <Ionicons name="navigate" size={18} color={BLUE} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.depRoute}>{dep.villeDepart} → {dep.villeArrivee}</Text>
                      <Text style={S.depSub}>🕐 {dep.heureDepart}</Text>
                      {dep.busName && dep.busName !== "—" && <Text style={S.depSub}>🚌 {dep.busName} ({dep.plateNumber})</Text>}
                      {dep.chauffeurNom && <Text style={S.depSub}>👤 Chauffeur : {dep.chauffeurNom}</Text>}
                      {dep.agentRouteNom && <Text style={S.depSub}>📡 Agent route : {dep.agentRouteNom}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => setStatusDep(dep)}>
                      <View style={[S.badge, { backgroundColor: st.bg }]}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: st.color }}>{st.label}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── FLOTTE BUS ── */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🚌 Flotte ({data?.buses?.length ?? 0})</Text>
            {!data?.buses?.length && <View style={S.empty}><Text style={S.emptyTxt}>Aucun bus</Text></View>}
            {data?.buses?.map(bus => {
              const st = getBusStatus(bus.logisticStatus);
              const busy = actionId === bus.id;
              return (
                <View key={bus.id} style={S.busCard}>
                  <View style={S.busTop}>
                    <View style={S.busIconBox}><Ionicons name="bus" size={22} color={BLUE} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={S.busName}>{bus.busName}</Text>
                      <Text style={S.busPlate}>{bus.plateNumber} · {bus.busType} · {bus.capacity} places</Text>
                      {bus.currentLocation && <Text style={S.busLoc}>📍 {bus.currentLocation}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => setStatusBus(bus)} style={[S.statusBadge, { backgroundColor: st.bg }]}>
                      <Ionicons name={st.icon as any} size={12} color={st.color} />
                      <Text style={[S.statusTxt, { color: st.color }]}>{st.label}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={S.busActions}>
                    {bus.logisticStatus !== "en_route" && bus.logisticStatus !== "en_panne" && (
                      <ActionBtn label="Mettre en route" icon="navigate-outline" color="#166534" bg="#DCFCE7" busy={busy} onPress={() => doAction(bus.id, "mettre-en-route")} />
                    )}
                    {bus.logisticStatus === "en_route" && (
                      <ActionBtn label="Marquer arrivé" icon="checkmark-circle-outline" color="#0369A1" bg="#E0F2FE" busy={busy} onPress={() => doAction(bus.id, "marquer-arrive")} />
                    )}
                    {bus.logisticStatus !== "en_panne" && (
                      <ActionBtn label="Signaler panne" icon="warning-outline" color="#DC2626" bg="#FEE2E2" busy={busy} onPress={() => doAction(bus.id, "signaler-panne")} />
                    )}
                    {bus.logisticStatus === "en_panne" && (
                      <ActionBtn label="Remettre en attente" icon="refresh-outline" color="#D97706" bg="#FEF3C7" busy={busy} onPress={() => doAction(bus.id, "remettre-en-attente")} />
                    )}
                    <ActionBtn label="Changer statut" icon="swap-horizontal-outline" color="#475569" bg="#F1F5F9" busy={false} onPress={() => setStatusBus(bus)} />
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── TRAJETS DU JOUR ── */}
          <View style={S.section}>
            <Text style={S.sectionTitle}>🗺️ Trajets du jour ({data?.trips?.length ?? 0})</Text>
            {!data?.trips?.length && <View style={S.empty}><Text style={S.emptyTxt}>Aucun trajet aujourd'hui</Text></View>}
            {data?.trips?.map(trip => (
              <View key={trip.id} style={S.tripCard}>
                <View style={{ flex: 1 }}>
                  <Text style={S.tripRoute}>{trip.from} → {trip.to}</Text>
                  <Text style={S.tripSub}>{trip.departureTime} · {trip.busName ?? "Bus"}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Suivi link */}
          <TouchableOpacity style={S.suiviBtn} onPress={() => router.push("/agent/suivi" as never)}>
            <Ionicons name="radio-outline" size={18} color="#fff" />
            <Text style={S.suiviBtnTxt}>Ouvrir Suivi & Alertes temps réel</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ══ MODAL: Programmer départ ══ */}
      <Modal visible={showDepModal} transparent animationType="slide">
        <View style={S.modalBg}>
          <View style={S.modalBox}>
            <View style={S.modalTitleRow}>
              <Text style={S.modalTitle}>🗓️ Programmer un départ</Text>
              <TouchableOpacity onPress={() => setShowDepModal(false)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
              <Text style={S.fieldLabel}>Ville de départ *</Text>
              <TextInput style={S.input} placeholder="Ex: Abidjan" value={depForm.villeDepart}
                onChangeText={v => setDepForm(f => ({ ...f, villeDepart: v }))} />

              <Text style={S.fieldLabel}>Ville d'arrivée *</Text>
              <TextInput style={S.input} placeholder="Ex: Bouaké" value={depForm.villeArrivee}
                onChangeText={v => setDepForm(f => ({ ...f, villeArrivee: v }))} />

              <Text style={S.fieldLabel}>Heure de départ *</Text>
              <TextInput style={S.input} placeholder="Ex: 06:30" value={depForm.heureDepart}
                onChangeText={v => setDepForm(f => ({ ...f, heureDepart: v }))} keyboardType="numbers-and-punctuation" />

              <Text style={S.fieldLabel}>Nom du chauffeur</Text>
              <TextInput style={S.input} placeholder="Ex: Koné Mamadou" value={depForm.chauffeurNom}
                onChangeText={v => setDepForm(f => ({ ...f, chauffeurNom: v }))} />

              <Text style={S.fieldLabel}>Nom de l'agent en route</Text>
              <TextInput style={S.input} placeholder="Ex: Touré Awa" value={depForm.agentRouteNom}
                onChangeText={v => setDepForm(f => ({ ...f, agentRouteNom: v }))} />

              <Text style={S.fieldLabel}>Bus assigné (nom ou plaque)</Text>
              {data?.buses?.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
                    {data.buses.map(b => (
                      <TouchableOpacity key={b.id}
                        style={[S.busChip, depForm.busId === b.id && { backgroundColor: BLUE_L, borderColor: BLUE }]}
                        onPress={() => setDepForm(f => ({ ...f, busId: f.busId === b.id ? "" : b.id }))}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: depForm.busId === b.id ? BLUE : "#475569" }}>
                          {b.busName}
                        </Text>
                        <Text style={{ fontSize: 9, color: "#94A3B8" }}>{b.plateNumber}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              ) : null}
            </ScrollView>

            <View style={S.modalActions}>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: "#F1F5F9" }]}
                onPress={() => setShowDepModal(false)}>
                <Text style={{ fontWeight: "700", color: "#475569" }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.modalBtn, { backgroundColor: BLUE }]}
                onPress={createDeparture} disabled={savingDep}>
                {savingDep ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ fontWeight: "700", color: "#fff" }}>Créer départ</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ MODAL: Changer statut bus ══ */}
      <Modal visible={!!statusBus} transparent animationType="slide">
        <View style={S.modalBg}>
          <View style={[S.modalBox, { gap: 14 }]}>
            <View style={S.modalTitleRow}>
              <Text style={S.modalTitle}>🚌 Changer statut — {statusBus?.busName}</Text>
              <TouchableOpacity onPress={() => setStatusBus(null)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            {BUS_STATUTS.map(opt => (
              <TouchableOpacity key={opt.value}
                style={[S.statusOption, statusBus?.logisticStatus === opt.value && { borderColor: opt.color, backgroundColor: STATUS_BUS[opt.value]?.bg ?? "#F8FAFC" }]}
                onPress={() => statusBus && changeBusStatus(statusBus.id, opt.value)}
                disabled={savingStatus}
              >
                <Ionicons name={opt.icon as any} size={20} color={opt.color} />
                <Text style={[S.statusOptionTxt, { color: opt.color }]}>{opt.label}</Text>
                {statusBus?.logisticStatus === opt.value && <Ionicons name="checkmark-circle" size={18} color={opt.color} style={{ marginLeft: "auto" }} />}
              </TouchableOpacity>
            ))}
            {savingStatus && <ActivityIndicator color={BLUE} />}
          </View>
        </View>
      </Modal>

      {/* ══ MODAL: Changer statut départ ══ */}
      <Modal visible={!!statusDep} transparent animationType="slide">
        <View style={S.modalBg}>
          <View style={[S.modalBox, { gap: 14 }]}>
            <View style={S.modalTitleRow}>
              <Text style={S.modalTitle}>🗓️ Changer statut départ</Text>
              <TouchableOpacity onPress={() => setStatusDep(null)}>
                <Feather name="x" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: "#64748B", fontSize: 13 }}>
              {statusDep?.villeDepart} → {statusDep?.villeArrivee} à {statusDep?.heureDepart}
            </Text>
            {DEP_STATUTS.map(s => {
              const st = getDepStatus(s);
              return (
                <TouchableOpacity key={s}
                  style={[S.statusOption, statusDep?.statut === s && { borderColor: st.color, backgroundColor: st.bg }]}
                  onPress={() => statusDep && updateDepStatus(statusDep, s)}
                >
                  <Text style={[S.statusOptionTxt, { color: st.color }]}>{st.label}</Text>
                  {statusDep?.statut === s && <Ionicons name="checkmark-circle" size={18} color={st.color} style={{ marginLeft: "auto" }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Sub-components ───────────────────────────────────────────────── */
function StatCard({ label, value, color, bg, icon }: { label: string; value: number; color: string; bg: string; icon: string }) {
  return (
    <View style={[S.statCard, { backgroundColor: bg, borderColor: color + "40" }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[S.statValue, { color }]}>{value}</Text>
      <Text style={S.statLabel}>{label}</Text>
    </View>
  );
}
function ActionBtn({ label, icon, color, bg, busy, onPress }: { label: string; icon: string; color: string; bg: string; busy: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[S.actionBtn, { backgroundColor: bg, borderColor: color + "50" }]} onPress={onPress} disabled={busy} activeOpacity={0.7}>
      {busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon as any} size={14} color={color} />}
      <Text style={[S.actionBtnTxt, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Styles ───────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#F0F9FF" },
  header:      { backgroundColor: BLUE_D, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon:  { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub:   { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 1 },
  addBtn:      { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnTxt:   { color: "#fff", fontSize: 12, fontWeight: "700" },
  logoutBtn:   { backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  logoutTxt:   { color: "#fff", fontSize: 12, fontWeight: "700" },

  section:       { gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle:  { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  sectionBtn:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: BLUE_L, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard:  { flex: 1, minWidth: "28%", borderRadius: 12, padding: 12, alignItems: "center", gap: 4, borderWidth: 1 },
  statValue: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, color: "#475569", textAlign: "center", fontWeight: "600" },

  alertCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF1F2", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FECDD3" },
  alertMsg:  { flex: 1, fontSize: 12, color: "#991B1B", fontWeight: "600" },
  alertTime: { fontSize: 10, color: "#DC2626", fontWeight: "600" },

  depCard:   { backgroundColor: "#fff", borderRadius: 13, padding: 13, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  depTop:    { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  depIconBox:{ width: 38, height: 38, borderRadius: 10, backgroundColor: BLUE_L, justifyContent: "center", alignItems: "center" },
  depRoute:  { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  depSub:    { fontSize: 11, color: "#64748B", marginTop: 2 },

  busCard:    { backgroundColor: "#fff", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 12 },
  busTop:     { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  busIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: BLUE_L, justifyContent: "center", alignItems: "center" },
  busName:    { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  busPlate:   { fontSize: 11, color: "#64748B", marginTop: 1 },
  busLoc:     { fontSize: 11, color: "#64748B", marginTop: 2 },
  statusBadge:{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTxt:  { fontSize: 10, fontWeight: "700" },
  busActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionBtn:  { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  actionBtnTxt: { fontSize: 11, fontWeight: "700" },

  tripCard:  { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 12, gap: 10 },
  tripRoute: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  tripSub:   { fontSize: 11, color: "#64748B", marginTop: 2 },

  badge:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  empty:     { backgroundColor: "#fff", borderRadius: 12, padding: 24, alignItems: "center", gap: 6 },
  emptyTxt:  { color: "#94A3B8", fontSize: 14 },

  suiviBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#7C3AED", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20 },
  suiviBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "800", flex: 1, textAlign: "center" },

  modalBg:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox:     { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, maxHeight: "90%" },
  modalTitleRow:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle:   { fontSize: 17, fontWeight: "900", color: "#0F172A", flex: 1 },
  modalActions: { flexDirection: "row", gap: 10 },
  modalBtn:     { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12 },

  fieldLabel:   { fontSize: 12, fontWeight: "700", color: "#475569", marginBottom: 4 },
  input:        { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A", backgroundColor: "#F8FAFC", marginBottom: 12 },
  busChip:      { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC", alignItems: "center", gap: 2 },

  statusOption:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: "#E2E8F0" },
  statusOptionTxt: { flex: 1, fontSize: 14, fontWeight: "700" },
});
