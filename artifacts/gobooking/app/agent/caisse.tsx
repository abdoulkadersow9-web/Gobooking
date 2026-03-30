/**
 * Ma Caisse — Écran adaptatif selon le rôle de l'agent
 *
 * Rôles avec caisse par DÉPART  : agent_ticket, agent_bagage, agent_route
 * Rôles avec caisse JOURNALIÈRE : agent_colis
 * Rôles SANS caisse             : agent_embarquement, logistique
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, Modal, TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ── Couleurs par catégorie ── */
const COLORS: Record<string, { primary: string; light: string; border: string }> = {
  ticket: { primary: "#D97706", light: "#FEF3C7", border: "#FBBF24" },
  bagage: { primary: "#92400E", light: "#FEF9C3", border: "#FBBF24" },
  route:  { primary: "#059669", light: "#ECFDF5", border: "#6EE7B7" },
  colis:  { primary: "#7C3AED", light: "#EDE9FE", border: "#A78BFA" },
  none:   { primary: "#6B7280", light: "#F3F4F6", border: "#D1D5DB" },
};

const ROLE_TO_CAT: Record<string, string> = {
  agent_ticket: "ticket", guichet: "ticket", vente: "ticket", agent_guichet: "ticket",
  agent_bagage: "bagage", bagage: "bagage",
  agent_route: "route", route: "route",
  agent_colis: "colis", colis: "colis", reception_colis: "colis",
};

const CAT_LABEL: Record<string, string> = {
  ticket: "Agent Guichet",
  bagage: "Agent Bagage",
  route:  "Agent En Route",
  colis:  "Agent Colis",
};

const PAYMENT_ICONS: Record<string, string> = {
  espèces: "cash", cash: "cash", wave: "phone-portrait", mtn: "phone-portrait",
  orange: "phone-portrait", moov: "phone-portrait", visa: "card",
};

function fmtMoney(n: number) {
  return n.toLocaleString("fr-FR") + " FCFA";
}
function fmtDate(d: any) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) +
    " " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* ────────────────────────────────────────────────────────────────────── */
export default function CaisseScreen() {
  const { token, user } = useAuth();
  const agentRole = user?.agentRole ?? "";
  const category  = ROLE_TO_CAT[agentRole] ?? "none";
  const C         = COLORS[category] ?? COLORS.none;

  /* ── Onglets ── */
  const [tab, setTab] = useState<"caisse" | "historique">("caisse");

  /* ── Sélection de trajet (pour ticket / bagage / route) ── */
  const [trips,          setTrips]          = useState<any[]>([]);
  const [selectedTrip,   setSelectedTrip]   = useState<any | null>(null);
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [tripsLoading,   setTripsLoading]   = useState(false);

  /* ── Données caisse en cours ── */
  const [summary,         setSummary]         = useState<any | null>(null);
  const [summaryLoading,  setSummaryLoading]  = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);

  /* ── Historique ── */
  const [history,         setHistory]         = useState<any[]>([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);

  /* ── Fermeture de caisse ── */
  const [showClose,   setShowClose]   = useState(false);
  const [comment,     setComment]     = useState("");
  const [closing,     setClosing]     = useState(false);

  /* ── Modale détail transaction ── */
  const [detailTx, setDetailTx] = useState<any | null>(null);

  /* ── Date (pour colis) ── */
  const [selectedDate, setSelectedDate] = useState(todayStr());

  /* ════════════════════════════════════════════════════════════════
     Chargements
     ════════════════════════════════════════════════════════════════ */
  const loadTrips = useCallback(async () => {
    if (category === "colis" || category === "none") return;
    setTripsLoading(true);
    try {
      const data = await apiFetch<any>("/agent/caisse/trips", { token: token ?? undefined });
      setTrips(data.trips ?? []);
      if (!selectedTrip && data.trips?.length > 0) {
        const first = data.trips.find((t: any) => !t.caisseAlreadySent) ?? data.trips[0];
        setSelectedTrip(first);
      }
    } catch {
      /* silent */
    } finally {
      setTripsLoading(false);
    }
  }, [category, token]);

  const loadSummary = useCallback(async () => {
    if (category === "none") return;
    const needsTrip = category !== "colis";
    if (needsTrip && !selectedTrip) return;

    setSummaryLoading(true);
    try {
      const params: Record<string, string> = {};
      if (needsTrip) params.tripId = selectedTrip!.id;
      if (category === "colis") params.date = selectedDate;

      const qs = new URLSearchParams(params).toString();
      const data = await apiFetch<any>(`/agent/caisse/summary?${qs}`, { token: token ?? undefined });
      setSummary(data);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de charger la caisse");
    } finally {
      setSummaryLoading(false);
    }
  }, [category, selectedTrip, selectedDate, token]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<any>("/agent/caisse/history", { token: token ?? undefined });
      setHistory(data.sessions ?? []);
    } catch {
      /* silent */
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => { loadTrips(); }, [loadTrips]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (tab === "historique") loadHistory(); }, [tab, loadHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSummary();
    if (tab === "historique") await loadHistory();
    setRefreshing(false);
  };

  /* ════════════════════════════════════════════════════════════════
     Fermeture de caisse
     ════════════════════════════════════════════════════════════════ */
  const handleClose = async () => {
    if (!summary) return;
    setClosing(true);
    try {
      const payload: any = {
        comment,
        totalAmount:      summary.totalAmount ?? 0,
        transactionCount: summary.transactionCount ?? 0,
        breakdown:        summary.byPayment ?? {},
        transactions:     summary.transactions ?? [],
        tripFrom:         summary.trip?.from ?? selectedTrip?.from,
        tripTo:           summary.trip?.to   ?? selectedTrip?.to,
        tripDeparture:    summary.trip?.departureTime ?? selectedTrip?.departureTime,
      };
      if (category !== "colis") payload.tripId = selectedTrip?.id;
      else payload.sessionDate = selectedDate;

      await apiFetch("/agent/caisse/close", {
        token: token ?? undefined,
        method: "POST",
        body: payload,
      });
      setShowClose(false);
      setComment("");
      Alert.alert("✅ Caisse soumise", "Vos points ont été envoyés au chef d'agence pour validation.");
      await loadSummary();
      await loadHistory();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de soumettre la caisse");
    } finally {
      setClosing(false);
    }
  };

  /* ════════════════════════════════════════════════════════════════
     Rendu — agent sans caisse
     ════════════════════════════════════════════════════════════════ */
  if (category === "none") {
    return (
      <SafeAreaView style={[S.root, { backgroundColor: "#F3F4F6" }]} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
        <View style={S.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={S.topTitle}>Ma Caisse</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Feather name="info" size={48} color="#9CA3AF" />
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 16, textAlign: "center" }}>
            Pas de caisse pour votre rôle
          </Text>
          <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 8, textAlign: "center" }}>
            Les agents embarquement et logistique n'ont pas de module caisse.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     Rendu principal
     ════════════════════════════════════════════════════════════════ */
  const txList = (summary?.transactions ?? []) as any[];
  const alreadySent = selectedTrip?.caisseAlreadySent;

  return (
    <SafeAreaView style={[S.root, { backgroundColor: "#F9FAFB" }]} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* ── Barre haute ── */}
      <View style={S.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={S.topTitle}>Ma Caisse</Text>
        <TouchableOpacity onPress={onRefresh} hitSlop={8}>
          <Feather name="refresh-cw" size={18} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Badge rôle ── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={[S.roleBadge, { backgroundColor: C.light, borderColor: C.border }]}>
          <Text style={[S.roleBadgeText, { color: C.primary }]}>{CAT_LABEL[category] ?? agentRole}</Text>
        </View>
      </View>

      {/* ── Onglets ── */}
      <View style={S.tabs}>
        {(["caisse", "historique"] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[S.tab, tab === t && { borderBottomColor: C.primary, borderBottomWidth: 2 }]}>
            <Text style={[S.tabText, tab === t && { color: C.primary, fontWeight: "700" }]}>
              {t === "caisse" ? "Ma Caisse" : "Historique"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ══════════════════════════════════════════════════
            TAB: MA CAISSE
            ══════════════════════════════════════════════════ */}
        {tab === "caisse" && (
          <View>
            {/* ── Sélecteur de trajet (non-colis) ── */}
            {category !== "colis" && (
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={S.sectionLabel}>DÉPART</Text>
                <TouchableOpacity
                  style={[S.tripSelector, { borderColor: C.border }]}
                  onPress={() => setShowTripPicker(true)}
                >
                  {tripsLoading ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : selectedTrip ? (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
                        {selectedTrip.from} → {selectedTrip.to}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                        {selectedTrip.date} · {selectedTrip.departureTime} · {selectedTrip.status}
                        {selectedTrip.caisseAlreadySent ? " · ✅ déjà soumise" : ""}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: "#9CA3AF" }}>Sélectionner un départ…</Text>
                  )}
                  <Feather name="chevron-down" size={18} color={C.primary} />
                </TouchableOpacity>
              </View>
            )}

            {/* ── Sélecteur de date (colis) ── */}
            {category === "colis" && (
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text style={S.sectionLabel}>DATE DE CAISSE</Text>
                <View style={[S.tripSelector, { borderColor: C.border }]}>
                  <Feather name="calendar" size={16} color={C.primary} />
                  <Text style={{ flex: 1, marginLeft: 8, fontSize: 15, fontWeight: "600", color: "#111827" }}>
                    {selectedDate === todayStr() ? `Aujourd'hui (${selectedDate})` : selectedDate}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Résumé ── */}
            {summaryLoading ? (
              <View style={{ paddingTop: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={{ marginTop: 12, color: "#6B7280" }}>Calcul de la caisse…</Text>
              </View>
            ) : !summary || (!selectedTrip && category !== "colis") ? (
              <View style={{ padding: 32, alignItems: "center" }}>
                <Feather name="inbox" size={40} color="#D1D5DB" />
                <Text style={{ marginTop: 12, color: "#9CA3AF", textAlign: "center" }}>
                  {category !== "colis" ? "Sélectionnez un départ pour voir la caisse" : "Aucune donnée pour cette date"}
                </Text>
              </View>
            ) : (
              <View>
                {/* ── Carte total ── */}
                <View style={[S.totalCard, { backgroundColor: C.light, borderColor: C.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.totalLabel, { color: C.primary }]}>TOTAL ENCAISSÉ</Text>
                    <Text style={[S.totalAmount, { color: C.primary }]}>{fmtMoney(summary.totalAmount ?? 0)}</Text>
                    <Text style={[S.totalSub, { color: C.primary }]}>
                      {summary.transactionCount ?? 0} transaction{(summary.transactionCount ?? 0) > 1 ? "s" : ""}
                      {summary.passengerCount ? ` · ${summary.passengerCount} passager${summary.passengerCount > 1 ? "s" : ""}` : ""}
                    </Text>
                  </View>
                  <View style={[S.totalIcon, { backgroundColor: C.primary }]}>
                    <Feather name="dollar-sign" size={28} color="#fff" />
                  </View>
                </View>

                {/* ── Répartition par moyen de paiement ── */}
                {summary.byPayment && Object.keys(summary.byPayment).length > 0 && (
                  <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <Text style={S.sectionLabel}>RÉPARTITION PAR MOYEN DE PAIEMENT</Text>
                    <View style={S.payCard}>
                      {Object.entries(summary.byPayment).map(([pm, amt]) => (
                        <View key={pm} style={S.payRow}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Ionicons
                              name={PAYMENT_ICONS[pm.toLowerCase()] as any ?? "card"}
                              size={16} color={C.primary}
                            />
                            <Text style={{ fontSize: 14, color: "#374151", textTransform: "capitalize" }}>{pm}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>
                            {fmtMoney(amt as number)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* ── Statistiques colis spécifiques ── */}
                {category === "colis" && (
                  <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <Text style={S.sectionLabel}>ÉTAT DES COLIS DU JOUR</Text>
                    <View style={S.payCard}>
                      <View style={S.statRow}>
                        <View style={[S.statDot, { backgroundColor: "#F59E0B" }]} />
                        <Text style={S.statLabel}>En attente</Text>
                        <Text style={S.statVal}>{summary.enAttenteCount ?? 0}</Text>
                      </View>
                      <View style={S.statRow}>
                        <View style={[S.statDot, { backgroundColor: "#3B82F6" }]} />
                        <Text style={S.statLabel}>Embarqués</Text>
                        <Text style={S.statVal}>{summary.embarquésCount ?? 0}</Text>
                      </View>
                      <View style={S.statRow}>
                        <View style={[S.statDot, { backgroundColor: "#10B981" }]} />
                        <Text style={S.statLabel}>Livrés / Retirés</Text>
                        <Text style={S.statVal}>{summary.livrésCount ?? 0}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* ── Trajet info ── */}
                {summary.trip && (
                  <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <Text style={S.sectionLabel}>DÉPART CONCERNÉ</Text>
                    <View style={[S.tripInfoCard, { borderLeftColor: C.primary }]}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
                        {summary.trip.from} → {summary.trip.to}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                        {summary.trip.date} · {summary.trip.departureTime} · {summary.trip.status}
                      </Text>
                    </View>
                  </View>
                )}

                {/* ── Bouton fermer caisse ── */}
                {!alreadySent && (
                  <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                    <TouchableOpacity
                      style={[S.closeBtn, { backgroundColor: C.primary }]}
                      onPress={() => setShowClose(true)}
                    >
                      <Feather name="check-circle" size={18} color="#fff" />
                      <Text style={S.closeBtnText}>Valider & Envoyer ma caisse</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {alreadySent && (
                  <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                    <View style={[S.closeBtn, { backgroundColor: "#6B7280" }]}>
                      <Feather name="send" size={18} color="#fff" />
                      <Text style={S.closeBtnText}>Déjà soumise au chef d'agence</Text>
                    </View>
                  </View>
                )}

                {/* ── Liste transactions ── */}
                <View style={{ paddingHorizontal: 16 }}>
                  <Text style={S.sectionLabel}>
                    DÉTAIL ({txList.length} transaction{txList.length !== 1 ? "s" : ""})
                  </Text>
                  {txList.length === 0 ? (
                    <View style={S.emptyTx}>
                      <Feather name="inbox" size={32} color="#D1D5DB" />
                      <Text style={{ color: "#9CA3AF", marginTop: 8 }}>Aucune transaction</Text>
                    </View>
                  ) : (
                    txList.map(tx => (
                      <TouchableOpacity key={tx.id} style={S.txRow} onPress={() => setDetailTx(tx)}>
                        <View style={[S.txIconBox, { backgroundColor: C.light }]}>
                          <Feather
                            name={tx.type === "billet_route" ? "map-pin" : tx.type === "colis" ? "package" : tx.type === "valise" ? "briefcase" : "credit-card"}
                            size={16} color={C.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={S.txLabel} numberOfLines={1}>{tx.label ?? tx.ref}</Text>
                          <Text style={S.txSub}>{tx.ref} · {tx.payment}</Text>
                          {tx.seatNumbers && Array.isArray(tx.seatNumbers) && tx.seatNumbers.length > 0 && (
                            <Text style={S.txSub}>Siège(s): {(tx.seatNumbers as string[]).join(", ")}</Text>
                          )}
                          {tx.route && <Text style={S.txSub}>{tx.route}</Text>}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[S.txAmount, { color: C.primary }]}>{fmtMoney(tx.amount ?? 0)}</Text>
                          <Text style={S.txDate}>{fmtDate(tx.date)}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: HISTORIQUE
            ══════════════════════════════════════════════════ */}
        {tab === "historique" && (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={[S.sectionLabel, { marginTop: 8 }]}>MES CAISSES SOUMISES</Text>
            {historyLoading ? (
              <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
            ) : history.length === 0 ? (
              <View style={S.emptyTx}>
                <Feather name="clock" size={40} color="#D1D5DB" />
                <Text style={{ color: "#9CA3AF", marginTop: 12, textAlign: "center" }}>
                  Aucune caisse soumise pour l'instant
                </Text>
              </View>
            ) : (
              history.map(s => {
                const statusColor = s.status === "validated" ? "#059669" : s.status === "rejected" ? "#DC2626" : "#D97706";
                const statusLabel = s.status === "validated" ? "Validée ✅" : s.status === "rejected" ? "Rejetée ❌" : "En attente ⏳";
                return (
                  <View key={s.id} style={S.histCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={S.histTitle}>
                          {s.tripFrom && s.tripTo ? `${s.tripFrom} → ${s.tripTo}` : s.sessionDate ?? fmtDate(s.createdAt)}
                        </Text>
                        {s.tripDeparture && <Text style={S.histSub}>Départ: {s.tripDeparture}</Text>}
                        <Text style={S.histSub}>Soumis le {fmtDate(s.sentAt ?? s.createdAt)}</Text>
                        {s.agentComment && (
                          <Text style={S.histSub}>💬 Mon commentaire: {s.agentComment}</Text>
                        )}
                        {s.chefComment && (
                          <Text style={[S.histSub, { color: statusColor, fontWeight: "600" }]}>
                            Chef: {s.chefComment}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
                          {fmtMoney(s.totalAmount ?? 0)}
                        </Text>
                        <View style={[S.statusBadge, { backgroundColor: statusColor + "20", borderColor: statusColor }]}>
                          <Text style={[S.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                          {s.transactionCount ?? 0} op.
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Modal sélection trajet ── */}
      <Modal visible={showTripPicker} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Choisir un départ</Text>
              <TouchableOpacity onPress={() => setShowTripPicker(false)}>
                <Feather name="x" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {trips.map(trip => (
                <TouchableOpacity
                  key={trip.id}
                  style={[S.tripOption, selectedTrip?.id === trip.id && { backgroundColor: C.light, borderColor: C.border }]}
                  onPress={() => { setSelectedTrip(trip); setShowTripPicker(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>
                      {trip.from} → {trip.to}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                      {trip.date} · {trip.departureTime} · {trip.status}
                    </Text>
                  </View>
                  {trip.caisseAlreadySent && (
                    <View style={[S.sentBadge]}>
                      <Text style={{ fontSize: 10, color: "#059669", fontWeight: "600" }}>✅ Soumise</Text>
                    </View>
                  )}
                  {selectedTrip?.id === trip.id && (
                    <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                  )}
                </TouchableOpacity>
              ))}
              {trips.length === 0 && (
                <Text style={{ padding: 24, color: "#9CA3AF", textAlign: "center" }}>Aucun départ trouvé</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal fermeture caisse ── */}
      <Modal visible={showClose} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={[S.modalSheet, { maxHeight: "70%" }]}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Fermer ma caisse</Text>
              <TouchableOpacity onPress={() => setShowClose(false)}>
                <Feather name="x" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Résumé */}
              <View style={[S.closeRecap, { backgroundColor: C.light, borderColor: C.border }]}>
                <Text style={{ fontSize: 14, color: "#6B7280" }}>Total à reverser</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: C.primary, marginTop: 4 }}>
                  {fmtMoney(summary?.totalAmount ?? 0)}
                </Text>
                <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                  {summary?.transactionCount ?? 0} transaction{(summary?.transactionCount ?? 0) > 1 ? "s" : ""}
                  {category !== "colis" && selectedTrip ? ` · ${selectedTrip.from} → ${selectedTrip.to}` : ""}
                  {category === "colis" ? ` · ${selectedDate}` : ""}
                </Text>
              </View>

              {/* Commentaire */}
              <Text style={[S.sectionLabel, { marginTop: 16 }]}>COMMENTAIRE (optionnel)</Text>
              <TextInput
                style={S.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Ex: RAS, tout en ordre"
                multiline
                numberOfLines={3}
              />

              {/* Bouton valider */}
              <TouchableOpacity
                style={[S.closeBtn, { backgroundColor: C.primary, marginTop: 16 }]}
                onPress={handleClose}
                disabled={closing}
              >
                {closing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="send" size={18} color="#fff" />
                    <Text style={S.closeBtnText}>Envoyer au chef d'agence</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 8 }}>
                Le chef d'agence recevra vos points pour validation.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal détail transaction ── */}
      <Modal visible={!!detailTx} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={[S.modalSheet, { maxHeight: "60%" }]}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Détail transaction</Text>
              <TouchableOpacity onPress={() => setDetailTx(null)}>
                <Feather name="x" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
            {detailTx && (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {[
                  ["Référence",    detailTx.ref],
                  ["Client",       detailTx.label],
                  ["Montant",      fmtMoney(detailTx.amount ?? 0)],
                  ["Paiement",     detailTx.payment],
                  ["Siège(s)",     Array.isArray(detailTx.seatNumbers) ? detailTx.seatNumbers.join(", ") : null],
                  ["Trajet",       detailTx.route],
                  ["Statut",       detailTx.status],
                  ["Date",         fmtDate(detailTx.date)],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <View key={k as string} style={S.detailRow}>
                    <Text style={S.detailKey}>{k}</Text>
                    <Text style={S.detailVal}>{v as string}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  root:          { flex: 1 },
  topBar:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  topTitle:      { fontSize: 18, fontWeight: "800", color: "#111827" },
  roleBadge:     { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  roleBadgeText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  tabs:          { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", marginHorizontal: 16 },
  tab:           { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabText:       { fontSize: 14, color: "#6B7280" },
  sectionLabel:  { fontSize: 11, fontWeight: "800", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  tripSelector:  { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  totalCard:     { marginHorizontal: 16, marginVertical: 12, borderRadius: 16, borderWidth: 1.5, padding: 20, flexDirection: "row", alignItems: "center" },
  totalLabel:    { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  totalAmount:   { fontSize: 32, fontWeight: "900", marginTop: 4 },
  totalSub:      { fontSize: 13, marginTop: 4, opacity: 0.7 },
  totalIcon:     { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  payCard:       { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
  payRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  statRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  statDot:       { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statLabel:     { flex: 1, fontSize: 14, color: "#374151" },
  statVal:       { fontSize: 14, fontWeight: "700", color: "#111827" },
  tripInfoCard:  { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: "#E5E7EB" },
  closeBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  closeBtnText:  { fontSize: 15, fontWeight: "800", color: "#fff" },
  emptyTx:       { alignItems: "center", paddingVertical: 40 },
  txRow:         { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB", gap: 10 },
  txIconBox:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txLabel:       { fontSize: 14, fontWeight: "600", color: "#111827" },
  txSub:         { fontSize: 11, color: "#6B7280", marginTop: 2 },
  txAmount:      { fontSize: 14, fontWeight: "800" },
  txDate:        { fontSize: 11, color: "#9CA3AF" },
  histCard:      { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  histTitle:     { fontSize: 15, fontWeight: "700", color: "#111827" },
  histSub:       { fontSize: 12, color: "#6B7280", marginTop: 2 },
  statusBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, marginTop: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet:    { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  modalHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  modalTitle:    { fontSize: 17, fontWeight: "800", color: "#111827" },
  tripOption:    { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", borderWidth: 1, borderColor: "transparent", margin: 4, borderRadius: 10 },
  sentBadge:     { backgroundColor: "#ECFDF5", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 },
  closeRecap:    { borderRadius: 14, borderWidth: 1.5, padding: 16, alignItems: "center" },
  commentInput:  { borderWidth: 1.5, borderColor: "#D1D5DB", borderRadius: 12, padding: 12, fontSize: 14, color: "#111827", minHeight: 80, textAlignVertical: "top", backgroundColor: "#fff" },
  detailRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  detailKey:     { fontSize: 13, color: "#6B7280", flex: 1 },
  detailVal:     { fontSize: 13, fontWeight: "600", color: "#111827", flex: 2, textAlign: "right" },
});
