/**
 * Agent Validation Départ — Module 3 + 4
 * Validation centralisée des départs + Bordereau PDF automatique
 * - Synthèse: passagers, absents, bagages, colis, dépenses
 * - Ajout de dépenses (péage, ration, autre)
 * - Bouton VALIDER → départ déclaré en route, notifications envoyées
 * - Génération PDF après validation: Version Entreprise (montants) + Version Route (sans montants)
 */
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import AlertBanner from "@/components/AlertBanner";
import { useRealtime } from "@/hooks/useRealtime";
import {
  generateBordereauEntreprise,
  generateBordereauRoute,
  computeAudit,
  type BordereauData as PdfBordereauData,
  type AuditItem,
} from "@/utils/bordereau-pdf";

const P       = "#4338CA";   // Indigo-700 — Agent Validation
const P_LIGHT = "#EEF2FF";
const P_MED   = "#C7D2FE";
const NAVY    = "#0B3C5D";
const GREEN   = "#059669";
const AMBER   = "#D97706";
const RED     = "#DC2626";
const GRAY    = "#64748B";
const BROWN   = "#92400E";

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

/* ─── Types ─── */
interface TripSummary {
  id: string; from: string; to: string; date: string;
  departureTime: string; busName: string; busType: string;
  status: string; totalPassengers: number;
  boardedCount: number; absentCount: number;
  bagageCount: number; colisCount: number;
  expenseTotal: number; isValidated: boolean;
}
interface Passenger {
  bookingId: string; bookingRef: string;
  name: string; phone: string;
  status: string; seatNums: string[];
  price: number; bagageStatus: string | null;
}
interface BagageItem {
  id: string; trackingRef: string; passengerName: string;
  bagageType: string; weightKg: number | null;
  price: number; photoUrl: string | null; status: string;
}
interface Colis {
  id: string; trackingRef: string;
  senderName: string; receiverName: string;
  fromCity: string; toCity: string;
  parcelType: string; weight: number;
  amount: number; photoUrl: string | null; status: string;
}
interface Expense {
  id: string; type: string; amount: number; description: string | null;
}
interface BordereauData {
  trip: { id: string; from: string; to: string; date: string; departureTime: string; busName: string; status: string };
  passengers: Passenger[]; boarded: Passenger[]; absents: Passenger[];
  bagages: BagageItem[]; colis: Colis[]; expenses: Expense[];
  agents?: Array<{ user_id: number; agent_role: string; name: string; contact: string; recorded_at: string }>;
  summary: {
    totalPassengers: number; boardedCount: number; absentCount: number;
    bagageCount: number; colisCount: number;
    totalPassengerRevenue: number; totalBagageRevenue: number;
    totalColisRevenue: number; totalExpenses: number; netRevenue: number;
  };
}

const EXPENSE_TYPES = [
  { key: "péage",    label: "Péage",    icon: "map-pin" as const },
  { key: "ration",   label: "Ration",   icon: "coffee" as const },
  { key: "carburant",label: "Carburant",icon: "droplet" as const },
  { key: "autre",    label: "Autre",    icon: "more-horizontal" as const },
];

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function AgentDepartureValidation() {
  const { user, token: authToken, logoutIfActiveToken } = useAuth();
  const token = authToken ?? "";
  const { preDepartureAlerts, validationAlerts, agentRole: realtimeRole } = useRealtime(token);

  const [tab, setTab] = useState<"departs" | "bordereau">("departs");

  // Trips
  const [trips, setTrips]         = useState<TripSummary[]>([]);
  const [tripsLoading, setTL]     = useState(true);
  const [selectedTrip, setTrip]   = useState<TripSummary | null>(null);
  const [refreshing, setRefr]     = useState(false);

  // Bordereau
  const [bordereau, setBordereau] = useState<BordereauData | null>(null);
  const [bordeLoading, setBL]     = useState(false);

  // Expense modal
  const [showExpModal, setExpModal] = useState(false);
  const [expType, setExpType]       = useState("péage");
  const [expAmount, setExpAmount]   = useState("");
  const [expDesc, setExpDesc]       = useState("");
  const [savingExp, setSavingExp]   = useState(false);

  // Validation
  const [validating, setValidating]     = useState(false);
  const [validated, setValidated]       = useState(false);

  // Transit multi-agence
  const [transitJoining, setTransitJoining] = useState(false);
  const [transitJoined, setTransitJoined]   = useState(false);

  // PDF generation
  const [pdfLoading, setPdfLoading] = useState<"entreprise" | "route" | null>(null);

  /* ─ Load trips ─ */
  const loadTrips = useCallback(async () => {
    if (!token) { setTL(false); return; }
    setTL(true);
    try {
      const r = await fetch(`${API}/agent/validation-depart/trips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) {
        logoutIfActiveToken(token); return;
      }
      const data = await r.json();
      setTrips(Array.isArray(data) ? data : []);
    } catch { setTrips([]); }
    finally { setTL(false); setRefr(false); }
  }, [token, logoutIfActiveToken]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  /* ─ Load bordereau ─ */
  const loadBordereau = useCallback(async (tripId: string) => {
    setBL(true);
    setBordereau(null);
    try {
      const r = await fetch(`${API}/agent/validation-depart/trip/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (r.ok) setBordereau(data);
    } catch {}
    finally { setBL(false); }
  }, [token]);

  const selectTrip = (t: TripSummary) => {
    setTrip(t);
    setValidated(t.isValidated);
    setTransitJoined(false);
    setTab("bordereau");
    loadBordereau(t.id);
  };

  /* ─ Join trip as transit agent ─ */
  const joinTransit = async () => {
    if (!selectedTrip) return;
    setTransitJoining(true);
    try {
      const r = await fetch(`${API}/agent/trips/${selectedTrip.id}/transit-join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (r.ok) {
        setTransitJoined(true);
        Alert.alert(
          "Prise en charge confirmée",
          `Vous êtes enregistré sur ce trajet ${selectedTrip.from} → ${selectedTrip.to}.\nVous pouvez ajouter passagers, bagages et colis.`,
          [{ text: "OK" }]
        );
        loadBordereau(selectedTrip.id);
      } else {
        Alert.alert("Erreur", data.error ?? "Impossible de prendre en charge ce trajet");
      }
    } catch {
      Alert.alert("Erreur réseau");
    } finally {
      setTransitJoining(false);
    }
  };

  /* ─ Add expense ─ */
  const addExpense = async () => {
    if (!selectedTrip || !expAmount) return;
    setSavingExp(true);
    try {
      const r = await fetch(`${API}/agent/validation-depart/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tripId: selectedTrip.id, type: expType, amount: parseInt(expAmount), description: expDesc }),
      });
      if (r.ok) {
        setExpModal(false); setExpAmount(""); setExpDesc(""); setExpType("péage");
        loadBordereau(selectedTrip.id);
      } else Alert.alert("Erreur", "Impossible d'ajouter la dépense");
    } catch { Alert.alert("Erreur réseau"); }
    finally { setSavingExp(false); }
  };

  /* ─ Save audit log ─ */
  const saveAuditLog = async (tripId: string, overrideConfirmed: boolean) => {
    if (!bordereau) return;
    const report = computeAudit({
      trip: bordereau.trip, boarded: bordereau.boarded, absents: bordereau.absents,
      bagages: bordereau.bagages, colis: bordereau.colis, expenses: bordereau.expenses,
      agents: bordereau.agents, summary: bordereau.summary,
    } as PdfBordereauData);
    try {
      await fetch(`${API}/agent/trips/${tripId}/audit-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          has_errors:         report.hasErrors,
          has_warnings:       report.hasWarnings,
          has_critique:       report.hasCritique,
          override_confirmed: overrideConfirmed,
          items:              report.items,
          total_revenue:      report.totalRevenue,
          net_balance:        report.netBalance,
          validated_by:       (user as any)?.name ?? "Agent",
        }),
      });
    } catch { /* non-blocking */ }
  };

  /* ─ Perform validated API call ─ */
  const performValidate = async (overrideConfirmed: boolean) => {
    if (!selectedTrip) return;
    setValidating(true);
    try {
      const r = await fetch(`${API}/agent/validation-depart/validate/${selectedTrip.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (r.ok) {
        await saveAuditLog(selectedTrip.id, overrideConfirmed);
        setValidated(true);
        loadBordereau(selectedTrip.id);
        loadTrips();
      } else Alert.alert("Erreur", data.error ?? "Validation échouée");
    } catch { Alert.alert("Erreur réseau"); }
    finally { setValidating(false); }
  };

  /* ─ VALIDATE departure ─ */
  const handleValidate = () => {
    if (!selectedTrip || !bordereau) return;

    const report    = computeAudit({
      trip: bordereau.trip, boarded: bordereau.boarded, absents: bordereau.absents,
      bagages: bordereau.bagages, colis: bordereau.colis, expenses: bordereau.expenses,
      agents: bordereau.agents, summary: bordereau.summary,
    } as PdfBordereauData);
    const critiques = report.items.filter(i => i.priority === "critique");

    if (critiques.length > 0) {
      /* Anomalies critiques → confirmation spéciale requise */
      const list = critiques.map(c => `• ${c.label}`).join("\n");
      Alert.alert(
        "⛔ Anomalies critiques détectées",
        `Les anomalies suivantes ont été identifiées :\n\n${list}\n\nValider quand même le départ implique votre responsabilité. Continuer ?`,
        [
          { text: "Annuler — Corriger d'abord", style: "cancel" },
          {
            text: "Confirmer malgré les anomalies",
            style: "destructive",
            onPress: () => performValidate(true),
          },
        ]
      );
    } else {
      Alert.alert(
        "Valider le départ",
        `Confirmer le départ ${selectedTrip.from} → ${selectedTrip.to} à ${selectedTrip.departureTime} ?\n\nLe bus sera déclaré en route.`,
        [
          { text: "Annuler", style: "cancel" },
          { text: "Valider le départ", style: "destructive", onPress: () => performValidate(false) },
        ]
      );
    }
  };

  /* ─ Generate PDF ─ */
  const handleGeneratePDF = async (version: "entreprise" | "route") => {
    if (!bordereau || !selectedTrip) return;
    setPdfLoading(version);
    try {
      const pdfData: PdfBordereauData = {
        trip:      bordereau.trip,
        boarded:   bordereau.boarded,
        absents:   bordereau.absents,
        bagages:   bordereau.bagages,
        colis:     bordereau.colis,
        expenses:  bordereau.expenses,
        agents:    bordereau.agents ?? [],
        summary:   bordereau.summary,
        validatedBy: (user as any)?.name ?? "Agent",
        validatedAt: new Date().toISOString(),
      };

      const html = version === "entreprise"
        ? generateBordereauEntreprise(pdfData)
        : generateBordereauRoute(pdfData);

      const { uri } = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const filename = version === "entreprise"
          ? `Bordereau_Entreprise_${selectedTrip.from}_${selectedTrip.to}_${selectedTrip.date}.pdf`
          : `FeuilldeRoute_${selectedTrip.from}_${selectedTrip.to}_${selectedTrip.date}.pdf`;
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Bordereau ${version === "entreprise" ? "Entreprise" : "Agent Route"}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF généré", `Fichier disponible à : ${uri}`);
      }
    } catch (err) {
      console.error("PDF error:", err);
      Alert.alert("Erreur PDF", "Impossible de générer le PDF. Réessayez.");
    } finally {
      setPdfLoading(null);
    }
  };

  /* ══════════════════ RENDERS ══════════════════ */

  const renderTripCard = (t: TripSummary) => {
    const isReady  = t.boardedCount > 0 || t.bagageCount > 0 || t.colisCount > 0;
    const statusC  = t.isValidated ? GREEN : isReady ? P : AMBER;
    const statusL  = t.isValidated ? "En route ✓" : isReady ? "Prêt à valider" : "En attente";
    return (
      <TouchableOpacity key={t.id} style={[SL.tripCard, t.isValidated && { opacity: 0.72 }]}
        onPress={() => selectTrip(t)}>
        <View style={[SL.tripAccent, { backgroundColor: statusC }]} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <Text style={SL.tripRoute}>{t.from} → {t.to}</Text>
            <View style={[SL.badge, { backgroundColor: statusC + "18" }]}>
              <Text style={[SL.badgeText, { color: statusC }]}>{t.departureTime}</Text>
            </View>
          </View>
          <Text style={SL.tripMeta}>{t.busName ?? t.busType} · {t.date}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <View style={[SL.stat, t.boardedCount > 0 && { backgroundColor: GREEN + "10" }]}>
              <Feather name="users" size={11} color={t.boardedCount > 0 ? GREEN : GRAY} />
              <Text style={[SL.statTxt, t.boardedCount > 0 && { color: GREEN, fontWeight: "700" }]}>
                {t.boardedCount} embarqué{t.boardedCount !== 1 ? "s" : ""}
              </Text>
            </View>
            {t.absentCount > 0 && (
              <View style={[SL.stat, { backgroundColor: AMBER + "10" }]}>
                <Feather name="user-x" size={11} color={AMBER} />
                <Text style={[SL.statTxt, { color: AMBER, fontWeight: "700" }]}>{t.absentCount} absent{t.absentCount !== 1 ? "s" : ""}</Text>
              </View>
            )}
            {t.bagageCount > 0 && (
              <View style={[SL.stat, { backgroundColor: BROWN + "10" }]}>
                <Feather name="briefcase" size={11} color={BROWN} />
                <Text style={[SL.statTxt, { color: BROWN, fontWeight: "700" }]}>{t.bagageCount} bagage{t.bagageCount !== 1 ? "s" : ""}</Text>
              </View>
            )}
            {t.colisCount > 0 && (
              <View style={[SL.stat, { backgroundColor: P + "10" }]}>
                <Feather name="package" size={11} color={P} />
                <Text style={[SL.statTxt, { color: P, fontWeight: "700" }]}>{t.colisCount} colis</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <View style={[SL.badge, { backgroundColor: statusC + "18" }]}>
              <Text style={[SL.badgeText, { color: statusC }]}>{statusL}</Text>
            </View>
            {t.expenseTotal > 0 && (
              <Text style={{ fontSize: 11, color: RED, fontWeight: "700" }}>
                Dépenses: {t.expenseTotal.toLocaleString()} FCFA
              </Text>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={P} />
      </TouchableOpacity>
    );
  };

  /* ── Trips tab ── */
  const renderDeparts = () => {
    const pendingTrips = trips.filter(t => !t.isValidated);
    const transitTrips = trips.filter(t => t.isValidated);
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing || tripsLoading} onRefresh={() => { setRefr(true); loadTrips(); }} tintColor={P} />}>

        {tripsLoading ? (
          <ActivityIndicator color={P} style={{ marginTop: 60 }} />
        ) : trips.length === 0 ? (
          <View style={SL.emptyBox}>
            <Feather name="calendar" size={40} color="#CBD5E1" />
            <Text style={SL.emptyTitle}>Aucun départ aujourd'hui</Text>
            <Text style={{ fontSize: 13, color: "#94A3B8", textAlign: "center" }}>Revenez plus tard ou actualisez</Text>
          </View>
        ) : (
          <>
            {/* Section — Départs à valider */}
            {pendingTrips.length > 0 && (
              <>
                <View style={SL.sectionHdr}>
                  <View style={[SL.sectionAccent, { backgroundColor: P }]} />
                  <View style={[SL.sectionIconBox, { backgroundColor: P + "18" }]}>
                    <Feather name="navigation" size={17} color={P} />
                  </View>
                  <Text style={[SL.sectionTitle, { color: P }]}>Départs à valider</Text>
                  <View style={[SL.badge, { backgroundColor: P + "18" }]}>
                    <Text style={[SL.badgeText, { color: P }]}>{pendingTrips.length}</Text>
                  </View>
                </View>
                {pendingTrips.map(renderTripCard)}
              </>
            )}

            {/* Section — Trajets en transit */}
            {transitTrips.length > 0 && (
              <>
                <View style={[SL.sectionHdr, { marginTop: pendingTrips.length > 0 ? 8 : 0 }]}>
                  <View style={[SL.sectionAccent, { backgroundColor: GREEN }]} />
                  <View style={[SL.sectionIconBox, { backgroundColor: GREEN + "18" }]}>
                    <Feather name="truck" size={17} color={GREEN} />
                  </View>
                  <Text style={[SL.sectionTitle, { color: GREEN }]}>Trajets en transit</Text>
                  <View style={[SL.badge, { backgroundColor: GREEN + "18" }]}>
                    <Text style={[SL.badgeText, { color: GREEN }]}>{transitTrips.length}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4, borderWidth: 1, borderColor: GREEN + "33" }}>
                  <Feather name="info" size={13} color={GREEN} style={{ marginTop: 1 }} />
                  <Text style={{ fontSize: 12, color: "#065F46", flex: 1, lineHeight: 17 }}>
                    Ces cars sont en route. Appuyez sur un trajet pour <Text style={{ fontWeight: "700" }}>prendre en charge</Text> et ajouter passagers, bagages ou colis.
                  </Text>
                </View>
                {transitTrips.map(renderTripCard)}
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  /* ── Bordereau tab ── */
  const renderBordereau = () => {
    if (!selectedTrip) return (
      <View style={[SL.emptyBox, { flex: 1, justifyContent: "center" }]}>
        <Feather name="navigation" size={40} color="#CBD5E1" />
        <Text style={SL.emptyTitle}>Aucun départ sélectionné</Text>
        <TouchableOpacity style={[SL.btn, { backgroundColor: P, marginTop: 12 }]} onPress={() => setTab("departs")}>
          <Text style={SL.btnText}>Sélectionner un départ</Text>
        </TouchableOpacity>
      </View>
    );

    if (bordeLoading) return <ActivityIndicator color={P} style={{ marginTop: 80 }} />;
    if (!bordereau) return (
      <View style={[SL.emptyBox, { flex: 1 }]}>
        <Text style={SL.emptyTitle}>Erreur de chargement</Text>
        <TouchableOpacity onPress={() => loadBordereau(selectedTrip.id)} style={[SL.btn, { backgroundColor: P, marginTop: 12 }]}>
          <Text style={SL.btnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );

    const s     = bordereau.summary;
    const audit = computeAudit({
      trip:     bordereau.trip,
      boarded:  bordereau.boarded,
      absents:  bordereau.absents,
      bagages:  bordereau.bagages,
      colis:    bordereau.colis,
      expenses: bordereau.expenses,
      agents:   bordereau.agents,
      summary:  bordereau.summary,
    } as PdfBordereauData);

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
        {/* Trip banner */}
        <View style={[SL.tripBanner, validated && { borderColor: GREEN, backgroundColor: "#F0FDF4" }]}>
          <View style={{ flex: 1 }}>
            <Text style={[SL.tripBannerRoute, validated && { color: GREEN }]}>
              {bordereau.trip.from} → {bordereau.trip.to}
            </Text>
            <Text style={SL.tripBannerMeta}>
              {bordereau.trip.departureTime} · {bordereau.trip.busName} · {bordereau.trip.date}
            </Text>
          </View>
          {validated && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="check-circle" size={18} color={GREEN} />
              <Text style={{ fontSize: 13, fontWeight: "800", color: GREEN }}>En route</Text>
            </View>
          )}
        </View>

        {/* Transit join banner — affiché pour les trajets en route */}
        {validated && (
          transitJoined ? (
            <>
              <View style={{ backgroundColor: "#F0FDF4", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: GREEN }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN, justifyContent: "center", alignItems: "center" }}>
                  <Feather name="user-check" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: GREEN }}>Prise en charge active</Text>
                  <Text style={{ fontSize: 11, color: "#065F46", marginTop: 1 }}>
                    Vous êtes enregistré sur ce trajet. Ajoutez des passagers, bagages ou colis ci-dessous.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: "#F0FDF4", borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: GREEN + "40" }}
                onPress={() => router.push({ pathname: "/agent/waypoints", params: { tripId: selectedTrip.id, tripName: `${selectedTrip.from} → ${selectedTrip.to}` } } as any)}
              >
                <Feather name="map-pin" size={16} color={GREEN} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: GREEN, flex: 1 }}>Voir les escales & places libres</Text>
                <Feather name="chevron-right" size={14} color={GREEN} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ backgroundColor: "#FFFBEB", borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: AMBER + "80", gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="truck" size={16} color={AMBER} />
                <Text style={{ fontSize: 13, fontWeight: "800", color: AMBER, flex: 1 }}>
                  Ce car est en route — Logique multi-agences
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: "#92400E", lineHeight: 17 }}>
                Ce trajet a déjà quitté son agence d'origine. Votre agence peut prendre en charge ce départ pour ajouter des passagers, bagages ou colis au même trajet.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: AMBER, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, opacity: transitJoining ? 0.7 : 1 }}
                onPress={joinTransit}
                disabled={transitJoining}
              >
                {transitJoining
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Feather name="users" size={16} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Prendre en charge ce trajet</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )
        )}

        {/* Summary cards row */}
        <View style={SL.statsRow}>
          <View style={[SL.statCard, { borderTopColor: GREEN }]}>
            <Text style={[SL.statCardVal, { color: GREEN }]}>{s.boardedCount}</Text>
            <Text style={SL.statCardLabel}>Embarqués</Text>
          </View>
          <View style={[SL.statCard, { borderTopColor: AMBER }]}>
            <Text style={[SL.statCardVal, { color: AMBER }]}>{s.absentCount}</Text>
            <Text style={SL.statCardLabel}>Absents</Text>
          </View>
          <View style={[SL.statCard, { borderTopColor: BROWN }]}>
            <Text style={[SL.statCardVal, { color: BROWN }]}>{s.bagageCount}</Text>
            <Text style={SL.statCardLabel}>Bagages</Text>
          </View>
          <View style={[SL.statCard, { borderTopColor: P }]}>
            <Text style={[SL.statCardVal, { color: P }]}>{s.colisCount}</Text>
            <Text style={SL.statCardLabel}>Colis</Text>
          </View>
        </View>

        {/* ── PASSENGERS ── */}
        <View style={SL.sectionHdr}>
          <View style={[SL.sectionAccent, { backgroundColor: GREEN }]} />
          <View style={[SL.sectionIconBox, { backgroundColor: GREEN + "18" }]}>
            <Feather name="users" size={17} color={GREEN} />
          </View>
          <Text style={[SL.sectionTitle, { color: GREEN }]}>
            Passagers embarqués ({s.boardedCount})
          </Text>
        </View>
        {bordereau.boarded.length === 0 ? (
          <Text style={SL.emptyInline}>Aucun passager embarqué</Text>
        ) : (
          bordereau.boarded.map(p => (
            <View key={p.bookingId} style={[SL.row, { borderLeftColor: GREEN }]}>
              <View style={{ flex: 1 }}>
                <Text style={SL.rowName}>{p.name}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                  <Text style={SL.rowMeta}>{p.bookingRef}</Text>
                  {(p.seatNums ?? []).length > 0 && (
                    <Text style={SL.rowMeta}>Siège {(p.seatNums ?? []).join(", ")}</Text>
                  )}
                </View>
              </View>
              <View style={[SL.badge, { backgroundColor: GREEN + "18" }]}>
                <Feather name="check" size={10} color={GREEN} />
                <Text style={[SL.badgeText, { color: GREEN }]}>Embarqué</Text>
              </View>
            </View>
          ))
        )}

        {/* ── ABSENTS ── */}
        {bordereau.absents.length > 0 && (
          <>
            <View style={SL.sectionHdr}>
              <View style={[SL.sectionAccent, { backgroundColor: AMBER }]} />
              <View style={[SL.sectionIconBox, { backgroundColor: AMBER + "18" }]}>
                <Feather name="user-x" size={17} color={AMBER} />
              </View>
              <Text style={[SL.sectionTitle, { color: AMBER }]}>
                Absents ({s.absentCount})
              </Text>
            </View>
            {bordereau.absents.map(p => (
              <View key={p.bookingId} style={[SL.row, { borderLeftColor: AMBER, opacity: 0.8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={SL.rowName}>{p.name}</Text>
                  <Text style={SL.rowMeta}>{p.bookingRef} · {p.phone}</Text>
                </View>
                <View style={[SL.badge, { backgroundColor: AMBER + "18" }]}>
                  <Text style={[SL.badgeText, { color: AMBER }]}>Absent</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── BAGAGES ── */}
        <View style={SL.sectionHdr}>
          <View style={[SL.sectionAccent, { backgroundColor: BROWN }]} />
          <View style={[SL.sectionIconBox, { backgroundColor: BROWN + "18" }]}>
            <Feather name="briefcase" size={17} color={BROWN} />
          </View>
          <Text style={[SL.sectionTitle, { color: BROWN }]}>
            Bagages ({s.bagageCount})
          </Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: BROWN, marginLeft: "auto" }}>
            {s.totalBagageRevenue.toLocaleString()} FCFA
          </Text>
        </View>
        {bordereau.bagages.length === 0 ? (
          <Text style={SL.emptyInline}>Aucun bagage enregistré</Text>
        ) : (
          bordereau.bagages.map(b => (
            <View key={b.id} style={[SL.row, { borderLeftColor: BROWN }]}>
              {b.photoUrl && (
                <Image source={{ uri: b.photoUrl }} style={SL.thumb} resizeMode="cover" />
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={SL.rowName}>{b.trackingRef}</Text>
                  {b.photoUrl && (
                    <View style={[SL.badge, { backgroundColor: "#F0FDF4" }]}>
                      <Ionicons name="camera" size={9} color={GREEN} />
                      <Text style={[SL.badgeText, { color: GREEN }]}>Photo</Text>
                    </View>
                  )}
                </View>
                <Text style={SL.rowMeta}>{b.passengerName} · {b.bagageType}{b.weightKg ? ` · ${b.weightKg}kg` : ""}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: "800", color: BROWN }}>{(b.price ?? 0).toLocaleString()}</Text>
            </View>
          ))
        )}

        {/* ── COLIS ── */}
        <View style={SL.sectionHdr}>
          <View style={[SL.sectionAccent, { backgroundColor: P }]} />
          <View style={[SL.sectionIconBox, { backgroundColor: P + "18" }]}>
            <Feather name="package" size={17} color={P} />
          </View>
          <Text style={[SL.sectionTitle, { color: P }]}>
            Colis ({s.colisCount})
          </Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: P, marginLeft: "auto" }}>
            {s.totalColisRevenue.toLocaleString()} FCFA
          </Text>
        </View>
        {bordereau.colis.length === 0 ? (
          <Text style={SL.emptyInline}>Aucun colis chargé</Text>
        ) : (
          bordereau.colis.map(c => (
            <View key={c.id} style={[SL.row, { borderLeftColor: P }]}>
              {c.photoUrl && (
                <Image source={{ uri: c.photoUrl }} style={SL.thumb} resizeMode="cover" />
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={SL.rowName}>{c.trackingRef}</Text>
                  {c.photoUrl && (
                    <View style={[SL.badge, { backgroundColor: "#F0FDF4" }]}>
                      <Ionicons name="camera" size={9} color={GREEN} />
                      <Text style={[SL.badgeText, { color: GREEN }]}>Photo</Text>
                    </View>
                  )}
                </View>
                <Text style={SL.rowMeta}>
                  {c.senderName} → {c.receiverName} · {c.parcelType} · {c.weight}kg
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: "800", color: P }}>{(c.amount ?? 0).toLocaleString()}</Text>
            </View>
          ))
        )}

        {/* ── DÉPENSES ── */}
        <View style={SL.sectionHdr}>
          <View style={[SL.sectionAccent, { backgroundColor: RED }]} />
          <View style={[SL.sectionIconBox, { backgroundColor: RED + "18" }]}>
            <Feather name="minus-circle" size={17} color={RED} />
          </View>
          <Text style={[SL.sectionTitle, { color: RED }]}>
            Dépenses ({bordereau.expenses.length})
          </Text>
          <TouchableOpacity onPress={() => setExpModal(true)} style={[SL.badge, { backgroundColor: RED + "18", marginLeft: "auto" }]}>
            <Feather name="plus" size={11} color={RED} />
            <Text style={[SL.badgeText, { color: RED }]}>Ajouter</Text>
          </TouchableOpacity>
        </View>
        {bordereau.expenses.length === 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={SL.emptyInline}>Aucune dépense enregistrée</Text>
            <TouchableOpacity onPress={() => setExpModal(true)} style={[SL.badge, { backgroundColor: RED + "10" }]}>
              <Text style={[SL.badgeText, { color: RED }]}>+ Ajouter (péage, ration...)</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bordereau.expenses.map(e => (
            <View key={e.id} style={[SL.row, { borderLeftColor: RED }]}>
              <Feather name="arrow-down-left" size={14} color={RED} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[SL.rowName, { color: RED }]}>{e.type}</Text>
                {e.description && <Text style={SL.rowMeta}>{e.description}</Text>}
              </View>
              <Text style={{ fontSize: 13, fontWeight: "800", color: RED }}>− {(e.amount ?? 0).toLocaleString()} FCFA</Text>
            </View>
          ))
        )}

        {/* ── RÉSUMÉ FINANCIER ── */}
        <View style={SL.financialCard}>
          <Text style={SL.financialTitle}>Résumé financier</Text>
          <View style={SL.financialRow}>
            <Text style={SL.financialLabel}>Billets ({s.boardedCount} pax)</Text>
            <Text style={SL.financialValue}>{s.totalPassengerRevenue.toLocaleString()} FCFA</Text>
          </View>
          <View style={SL.financialRow}>
            <Text style={SL.financialLabel}>Bagages ({s.bagageCount})</Text>
            <Text style={[SL.financialValue, { color: BROWN }]}>{s.totalBagageRevenue.toLocaleString()} FCFA</Text>
          </View>
          <View style={SL.financialRow}>
            <Text style={SL.financialLabel}>Colis ({s.colisCount})</Text>
            <Text style={[SL.financialValue, { color: P }]}>{s.totalColisRevenue.toLocaleString()} FCFA</Text>
          </View>
          <View style={[SL.financialRow, { borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 8, marginTop: 4 }]}>
            <Text style={SL.financialLabel}>Dépenses</Text>
            <Text style={[SL.financialValue, { color: RED }]}>− {s.totalExpenses.toLocaleString()} FCFA</Text>
          </View>
          <View style={[SL.financialRow, { backgroundColor: P + "08", borderRadius: 8, padding: 8, marginTop: 4 }]}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#0F172A" }}>Net total</Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: P }}>
              {s.netRevenue.toLocaleString()} FCFA
            </Text>
          </View>
        </View>

        {/* ── RAPPORT DE CONTRÔLE ── */}
        {(() => {
          const hasIssues = audit.hasErrors || audit.hasWarnings;
          const boxColor  = audit.hasErrors ? RED : audit.hasWarnings ? AMBER : GREEN;
          const icon      = audit.hasErrors ? "alert-circle" : audit.hasWarnings ? "alert-triangle" : "check-circle";
          const label     = audit.hasErrors ? "Anomalie(s) détectée(s)" : audit.hasWarnings ? "Avertissement(s)" : "Contrôle OK";
          return (
            <View style={{ borderRadius: 14, borderWidth: 1.5, borderColor: boxColor, backgroundColor: boxColor + "0D", overflow: "hidden" }}>
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: boxColor + "22" }}>
                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: boxColor + "20", alignItems: "center", justifyContent: "center" }}>
                  <Feather name={icon as any} size={16} color={boxColor} />
                </View>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: "800", color: "#0F172A" }}>Rapport de contrôle</Text>
                <View style={{ backgroundColor: boxColor, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>{label}</Text>
                </View>
              </View>

              {/* Summary row */}
              <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: boxColor + "22" }}>
                {[
                  { label: "Passagers", val: `${s.boardedCount}/${s.totalPassengers}`, color: GREEN },
                  { label: "Bagages",   val: `${s.bagageCount}`,                       color: BROWN },
                  { label: "Colis",     val: `${s.colisCount}`,                        color: P },
                  { label: "Recettes",  val: `${audit.totalRevenue.toLocaleString()}`,  color: GREEN },
                  { label: "Dépenses",  val: `${(s.totalExpenses ?? 0).toLocaleString()}`, color: RED },
                ].map((item, i, arr) => (
                  <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: boxColor + "22" }}>
                    <Text style={{ fontSize: 12, fontWeight: "900", color: item.color }}>{item.val}</Text>
                    <Text style={{ fontSize: 8, fontWeight: "600", color: "#64748B", textTransform: "uppercase" }}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {/* Audit items */}
              <View style={{ padding: 10, gap: 8 }}>
                {(audit.items as AuditItem[]).map((item, i) => {
                  const ic      = item.level === "error" ? RED : item.level === "warning" ? AMBER : GREEN;
                  const prioBg  = item.priority === "critique" ? "#FEE2E2" : item.priority === "moyen" ? "#FEF3C7" : "#F1F5F9";
                  const prioFg  = item.priority === "critique" ? "#B91C1C" : item.priority === "moyen" ? "#92400E" : "#64748B";
                  const prioLbl = item.priority === "critique" ? "CRITIQUE" : item.priority === "moyen" ? "MOYEN" : "INFO";
                  return (
                    <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingBottom: i < audit.items.length - 1 ? 8 : 0, borderBottomWidth: i < audit.items.length - 1 ? 1 : 0, borderBottomColor: boxColor + "15" }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: ic, marginTop: 5 }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <View style={{ backgroundColor: prioBg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                            <Text style={{ fontSize: 8, fontWeight: "800", color: prioFg, letterSpacing: 0.4 }}>{prioLbl}</Text>
                          </View>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: "#64748B", textTransform: "uppercase" }}>{item.category}</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#0F172A" }}>{item.label}</Text>
                        <Text style={{ fontSize: 10, color: "#64748B" }}>{item.detail}</Text>
                        {!!item.recommendation && (
                          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 2 }}>
                            <Text style={{ fontSize: 9, color: prioFg }}>→</Text>
                            <Text style={{ fontSize: 9, color: prioFg, fontStyle: "italic", flex: 1 }}>{item.recommendation}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* ── VALIDATE BUTTON ── */}
        {!validated ? (
          <TouchableOpacity
            style={[SL.validateBtn, validating && { opacity: 0.6 }]}
            onPress={handleValidate}
            disabled={validating}>
            {validating
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Feather name="check-circle" size={22} color="#fff" />
                  <Text style={SL.validateBtnText}>VALIDER LE DÉPART</Text>
                  <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.7)" />
                </>}
          </TouchableOpacity>
        ) : (
          <>
            {/* Validated confirmation box */}
            <View style={SL.validatedBox}>
              <Feather name="check-circle" size={28} color={GREEN} />
              <View style={{ flex: 1 }}>
                <Text style={SL.validatedTitle}>Départ validé — En route</Text>
                <Text style={SL.validatedSub}>
                  Passagers notifiés · Colis en transit · Bordereau prêt
                </Text>
              </View>
            </View>

            {/* PDF generation section */}
            <View style={SL.pdfSection}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <Feather name="file-text" size={16} color="#4338CA" />
                <Text style={SL.pdfSectionTitle}>Générer le bordereau PDF</Text>
              </View>

              {/* Entreprise version */}
              <TouchableOpacity
                style={[SL.pdfBtn, SL.pdfBtnEntreprise, pdfLoading === "entreprise" && { opacity: 0.6 }]}
                onPress={() => handleGeneratePDF("entreprise")}
                disabled={pdfLoading !== null}>
                {pdfLoading === "entreprise" ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <View style={SL.pdfBtnIcon}>
                      <Feather name="briefcase" size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={SL.pdfBtnLabel}>Version Entreprise</Text>
                      <Text style={SL.pdfBtnSub}>Avec tous les montants · Usage interne</Text>
                    </View>
                    <Feather name="download" size={16} color="rgba(255,255,255,0.8)" />
                  </>
                )}
              </TouchableOpacity>

              {/* Route version */}
              <TouchableOpacity
                style={[SL.pdfBtn, SL.pdfBtnRoute, pdfLoading === "route" && { opacity: 0.6 }]}
                onPress={() => handleGeneratePDF("route")}
                disabled={pdfLoading !== null}>
                {pdfLoading === "route" ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <View style={SL.pdfBtnIcon}>
                      <Feather name="navigation" size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={SL.pdfBtnLabel}>Feuille de Route</Text>
                      <Text style={SL.pdfBtnSub}>Sans montants · Chauffeur &amp; Agent Route</Text>
                    </View>
                    <Feather name="download" size={16} color="rgba(255,255,255,0.8)" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    );
  };

  /* ── Expense modal ── */
  const renderExpModal = () => (
    <Modal visible={showExpModal} animationType="slide" transparent>
      <View style={SL.modalOverlay}>
        <View style={SL.modalCard}>
          <View style={SL.modalHeader}>
            <Text style={SL.modalTitle}>Ajouter une dépense</Text>
            <TouchableOpacity onPress={() => setExpModal(false)} hitSlop={8}>
              <Feather name="x" size={22} color={GRAY} />
            </TouchableOpacity>
          </View>

          {/* Type */}
          <Text style={SL.modalLabel}>Type de dépense</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {EXPENSE_TYPES.map(et => (
              <TouchableOpacity key={et.key}
                style={[SL.expChip, expType === et.key && { backgroundColor: RED, borderColor: RED }]}
                onPress={() => setExpType(et.key)}>
                <Feather name={et.icon} size={14} color={expType === et.key ? "#fff" : GRAY} />
                <Text style={[SL.expChipText, expType === et.key && { color: "#fff" }]}>{et.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={SL.modalLabel}>Montant (FCFA) *</Text>
          <TextInput
            style={SL.modalInput}
            placeholder="ex: 5000"
            placeholderTextColor="#9CA3AF"
            value={expAmount}
            onChangeText={setExpAmount}
            keyboardType="numeric"
          />

          <Text style={SL.modalLabel}>Description (optionnel)</Text>
          <TextInput
            style={SL.modalInput}
            placeholder="ex: Péage autoroute A100"
            placeholderTextColor="#9CA3AF"
            value={expDesc}
            onChangeText={setExpDesc}
          />

          <TouchableOpacity
            style={[SL.btn, { backgroundColor: RED, marginTop: 8 }, savingExp && { opacity: 0.6 }]}
            onPress={addExpense}
            disabled={savingExp}>
            {savingExp
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={SL.btnText}>Enregistrer la dépense</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /* ══════════ MAIN RENDER ══════════ */
  return (
    <SafeAreaView style={SL.root} edges={["top"]}>
      {/* Header */}
      <View style={SL.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/home")} style={SL.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={SL.headerTitle}>Validation Départ</Text>
          <Text style={SL.headerSub}>Bordereau · Dépenses · Validation</Text>
        </View>
        <TouchableOpacity style={SL.refreshBtn} onPress={loadTrips} disabled={tripsLoading}>
          <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={SL.tabs}>
        <TouchableOpacity style={[SL.tab, tab === "departs" && [SL.tabActive, { borderBottomColor: P }]]}
          onPress={() => setTab("departs")}>
          <Feather name="navigation" size={15} color={tab === "departs" ? P : GRAY} />
          <Text style={[SL.tabText, tab === "departs" && { color: P }]}>
            Départs ({trips.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[SL.tab, tab === "bordereau" && [SL.tabActive, { borderBottomColor: P }]]}
          onPress={() => setTab("bordereau")}>
          <Feather name="file-text" size={15} color={tab === "bordereau" ? P : GRAY} />
          <Text style={[SL.tabText, tab === "bordereau" && { color: P }]}>
            Bordereau{selectedTrip ? ` — ${selectedTrip.from}→${selectedTrip.to}` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Alertes temps réel — Module 6 */}
      <AlertBanner
        preDepartureAlerts={preDepartureAlerts}
        validationAlerts={validationAlerts}
        agentRole={realtimeRole}
        onAction={(tripId, type) => {
          if (type === "pre_departure") setTab("departs");
          else setTab("bordereau");
        }}
      />

      <View style={{ flex: 1 }}>
        {tab === "departs" ? renderDeparts() : renderBordereau()}
      </View>

      {renderExpModal()}
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const SL = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  header: { backgroundColor: NAVY, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },

  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: {},
  tabText: { fontSize: 12, fontWeight: "700", color: GRAY },

  sectionHdr: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionAccent: { width: 5, height: 34, borderRadius: 3 },
  sectionIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 14, fontWeight: "800", flex: 1 },

  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  tripCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: NAVY, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3, overflow: "hidden" },
  tripAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  tripRoute: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  tripMeta: { fontSize: 12, color: GRAY, marginTop: 1 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F8FAFC", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statTxt: { fontSize: 11, fontWeight: "600", color: GRAY },

  tripBanner: { backgroundColor: P + "10", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: P + "30" },
  tripBannerRoute: { fontSize: 15, fontWeight: "800", color: P },
  tripBannerMeta: { fontSize: 12, color: P + "99", marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", borderTopWidth: 3, shadowColor: NAVY, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  statCardVal: { fontSize: 22, fontWeight: "900" },
  statCardLabel: { fontSize: 10, fontWeight: "600", color: GRAY, marginTop: 2 },

  row: { backgroundColor: "#fff", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderLeftWidth: 4, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  rowName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  rowMeta: { fontSize: 12, color: GRAY },
  thumb: { width: 44, height: 44, borderRadius: 8 },

  financialCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 6, shadowColor: NAVY, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  financialTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  financialRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  financialLabel: { fontSize: 13, color: GRAY, fontWeight: "600" },
  financialValue: { fontSize: 13, fontWeight: "700", color: "#0F172A" },

  validateBtn: { backgroundColor: GREEN, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18, shadowColor: GREEN, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  validateBtnText: { fontSize: 16, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  validatedBox: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F0FDF4", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#BBF7D0" },
  validatedTitle: { fontSize: 15, fontWeight: "800", color: GREEN },
  validatedSub: { fontSize: 12, color: "#166534", marginTop: 2 },

  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P_LIGHT, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: P_MED },
  infoText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  emptyBox: { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155" },
  emptyInline: { fontSize: 12, color: GRAY, fontStyle: "italic", paddingLeft: 4 },

  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, paddingHorizontal: 20 },
  btnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 10 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  modalLabel: { fontSize: 13, fontWeight: "700", color: GRAY, marginTop: 4 },
  modalInput: { backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#0F172A" },
  expChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  expChipText: { fontSize: 13, fontWeight: "700", color: GRAY },

  /* PDF section */
  pdfSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E0E7FF", shadowColor: P, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  pdfSectionTitle: { fontSize: 14, fontWeight: "800", color: P },
  pdfBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, marginBottom: 10 },
  pdfBtnEntreprise: { backgroundColor: P, shadowColor: P, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  pdfBtnRoute: { backgroundColor: GREEN, shadowColor: GREEN, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  pdfBtnIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  pdfBtnLabel: { fontSize: 14, fontWeight: "800", color: "#fff" },
  pdfBtnSub: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },
});
