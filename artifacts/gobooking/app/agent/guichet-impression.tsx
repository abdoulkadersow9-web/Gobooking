/**
 * Module 5 — Agent Guichet · Impression Départ
 * Accessible aux rôles: guichet, vente, agent_ticket, agent_guichet
 *
 * - Liste des départs du jour
 * - Ajout de dépenses (péage, ration équipage, carburant, autre)
 *   → s'ajoutent au bordereau visible par l'agent de validation
 * - Impression de la feuille de route (SANS montants) via expo-print
 * - Réutilise les endpoints /agent/validation-depart/* (modules 3 & 4)
 * - Réutilise les templates bordereau-pdf.ts (module 4)
 */
import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  generateBordereauRoute,
  type BordereauData as PdfBordereauData,
} from "@/utils/bordereau-pdf";

/* ─── Colors ─── */
const A      = "#D97706";   // Amber — Agent Guichet
const A_DARK = "#92400E";
const A_LIGHT= "#FFFBEB";
const A_MED  = "#FEF3C7";
const NAVY   = "#0B3C5D";
const GREEN  = "#059669";
const RED    = "#DC2626";
const GRAY   = "#64748B";
const P      = "#4338CA";
const BROWN  = "#92400E";

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

interface BordereauFull {
  trip: { id: string; from: string; to: string; date: string; departureTime: string; busName: string; status: string };
  passengers: any[]; boarded: any[]; absents: any[];
  bagages: any[]; colis: any[]; expenses: any[];
  summary: {
    totalPassengers: number; boardedCount: number; absentCount: number;
    bagageCount: number; colisCount: number;
    totalPassengerRevenue: number; totalBagageRevenue: number;
    totalColisRevenue: number; totalExpenses: number; netRevenue: number;
  };
}

interface Expense { id: string; type: string; amount: number; description: string | null; }

const EXPENSE_TYPES = [
  { key: "péage",         label: "Péage",          icon: "map-pin" as const },
  { key: "ration",        label: "Ration équipage", icon: "coffee" as const },
  { key: "carburant",     label: "Carburant",       icon: "droplet" as const },
  { key: "entretien",     label: "Entretien",       icon: "tool" as const },
  { key: "autre",         label: "Autre",           icon: "more-horizontal" as const },
];

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function GuichetImpression() {
  const { user } = useAuth();
  const token = (user as any)?.token ?? "";

  const [tab, setTab] = useState<"departs" | "detail">("departs");

  // Trips
  const [trips, setTrips]         = useState<TripSummary[]>([]);
  const [tripsLoading, setTL]     = useState(true);
  const [refreshing, setRefr]     = useState(false);
  const [selectedTrip, setTrip]   = useState<TripSummary | null>(null);

  // Bordereau detail
  const [bordereau, setBordereau] = useState<BordereauFull | null>(null);
  const [bordeLoading, setBL]     = useState(false);

  // Expense form
  const [showExpModal, setExpModal] = useState(false);
  const [expType, setExpType]       = useState("péage");
  const [expAmount, setExpAmount]   = useState("");
  const [expDesc, setExpDesc]       = useState("");
  const [savingExp, setSavingExp]   = useState(false);

  // Print
  const [printing, setPrinting] = useState(false);

  /* ─ Load trips ─ */
  const loadTrips = useCallback(async () => {
    setTL(true);
    try {
      const r = await fetch(`${API}/agent/validation-depart/trips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setTrips(Array.isArray(data) ? data : []);
    } catch { setTrips([]); }
    finally { setTL(false); setRefr(false); }
  }, [token]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  /* ─ Load bordereau detail ─ */
  const loadDetail = useCallback(async (tripId: string) => {
    setBL(true); setBordereau(null);
    try {
      const r = await fetch(`${API}/agent/validation-depart/trip/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setBordereau(await r.json());
    } catch {}
    finally { setBL(false); }
  }, [token]);

  const selectTrip = (t: TripSummary) => {
    setTrip(t); setTab("detail"); loadDetail(t.id);
  };

  /* ─ Add expense ─ */
  const addExpense = async () => {
    if (!selectedTrip || !expAmount) return;
    setSavingExp(true);
    try {
      const r = await fetch(`${API}/agent/validation-depart/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tripId: selectedTrip.id,
          type: expType,
          amount: parseInt(expAmount),
          description: expDesc || null,
        }),
      });
      if (r.ok) {
        setExpModal(false); setExpAmount(""); setExpDesc(""); setExpType("péage");
        loadDetail(selectedTrip.id);
      } else {
        const d = await r.json();
        Alert.alert("Erreur", d.error ?? "Impossible d'ajouter la dépense");
      }
    } catch { Alert.alert("Erreur réseau"); }
    finally { setSavingExp(false); }
  };

  /* ─ Print route sheet (NO amounts) ─ */
  const handlePrint = async () => {
    if (!bordereau || !selectedTrip) return;
    setPrinting(true);
    try {
      const pdfData: PdfBordereauData = {
        trip:        bordereau.trip,
        boarded:     bordereau.boarded,
        absents:     bordereau.absents,
        bagages:     bordereau.bagages,
        colis:       bordereau.colis,
        expenses:    bordereau.expenses,
        summary:     bordereau.summary,
        validatedBy: (user as any)?.name ?? "Agent Guichet",
        validatedAt: new Date().toISOString(),
      };

      const html     = generateBordereauRoute(pdfData);
      const { uri }  = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Feuille de Route — Impression",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF prêt", `Fichier : ${uri}`);
      }
    } catch (err) {
      console.error("Print error:", err);
      Alert.alert("Erreur", "Impossible de générer la feuille de route.");
    } finally {
      setPrinting(false);
    }
  };

  /* ══════════════════ RENDERS ══════════════════ */

  /* ── Trip card ── */
  const renderTripCard = (t: TripSummary) => {
    const isValidated = t.isValidated;
    const hasData     = t.boardedCount > 0 || t.bagageCount > 0 || t.colisCount > 0;
    const accentColor = isValidated ? GREEN : hasData ? A : GRAY;
    const statusLabel = isValidated ? "Validé · En route" : hasData ? "Prêt à imprimer" : "En attente";

    return (
      <TouchableOpacity key={t.id} style={[SL.tripCard, isValidated && { opacity: 0.75 }]}
        onPress={() => selectTrip(t)}>
        <View style={[SL.tripAccent, { backgroundColor: accentColor }]} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <Text style={SL.tripRoute}>{t.from} → {t.to}</Text>
            <View style={[SL.badge, { backgroundColor: accentColor + "18" }]}>
              <Text style={[SL.badgeText, { color: accentColor }]}>{t.departureTime}</Text>
            </View>
          </View>
          <Text style={SL.tripMeta}>{t.busName} · {t.date}</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <View style={[SL.chip, t.boardedCount > 0 && { backgroundColor: GREEN + "10" }]}>
              <Feather name="users" size={10} color={t.boardedCount > 0 ? GREEN : GRAY} />
              <Text style={[SL.chipTxt, t.boardedCount > 0 && { color: GREEN, fontWeight: "700" }]}>
                {t.boardedCount} pax
              </Text>
            </View>
            {t.bagageCount > 0 && (
              <View style={[SL.chip, { backgroundColor: BROWN + "10" }]}>
                <Feather name="briefcase" size={10} color={BROWN} />
                <Text style={[SL.chipTxt, { color: BROWN, fontWeight: "700" }]}>{t.bagageCount} bag.</Text>
              </View>
            )}
            {t.colisCount > 0 && (
              <View style={[SL.chip, { backgroundColor: P + "10" }]}>
                <Feather name="package" size={10} color={P} />
                <Text style={[SL.chipTxt, { color: P, fontWeight: "700" }]}>{t.colisCount} colis</Text>
              </View>
            )}
            {t.expenseTotal > 0 && (
              <View style={[SL.chip, { backgroundColor: RED + "10" }]}>
                <Feather name="minus-circle" size={10} color={RED} />
                <Text style={[SL.chipTxt, { color: RED, fontWeight: "700" }]}>
                  {t.expenseTotal.toLocaleString()} FCFA
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <View style={[SL.badge, { backgroundColor: accentColor + "15" }]}>
              <Text style={[SL.badgeText, { color: accentColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={A} />
      </TouchableOpacity>
    );
  };

  /* ── Departs tab ── */
  const renderDeparts = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing || tripsLoading} onRefresh={() => { setRefr(true); loadTrips(); }} tintColor={A} />}>
      <View style={SL.infoBox}>
        <Feather name="info" size={14} color={A_DARK} />
        <Text style={[SL.infoText, { color: A_DARK }]}>
          Sélectionnez un départ pour ajouter des dépenses (péage, ration...) et imprimer la feuille de route.
        </Text>
      </View>

      <View style={SL.sectionHdr}>
        <View style={[SL.sectionAccent, { backgroundColor: A }]} />
        <View style={[SL.sectionIconBox, { backgroundColor: A_MED }]}>
          <Feather name="calendar" size={17} color={A_DARK} />
        </View>
        <Text style={[SL.sectionTitle, { color: A_DARK }]}>Départs du jour</Text>
        <View style={[SL.badge, { backgroundColor: A_MED, marginLeft: "auto" }]}>
          <Text style={[SL.badgeText, { color: A_DARK }]}>{trips.length}</Text>
        </View>
      </View>

      {tripsLoading ? (
        <ActivityIndicator color={A} size="large" style={{ marginTop: 40 }} />
      ) : trips.length === 0 ? (
        <View style={SL.emptyBox}>
          <Feather name="calendar" size={42} color="#CBD5E1" />
          <Text style={SL.emptyTitle}>Aucun départ aujourd'hui</Text>
        </View>
      ) : (
        trips.map(renderTripCard)
      )}
    </ScrollView>
  );

  /* ── Detail tab ── */
  const renderDetail = () => {
    if (!selectedTrip) return (
      <View style={[SL.emptyBox, { flex: 1, justifyContent: "center" }]}>
        <Feather name="calendar" size={40} color="#CBD5E1" />
        <Text style={SL.emptyTitle}>Aucun départ sélectionné</Text>
        <TouchableOpacity style={[SL.btn, { backgroundColor: A, marginTop: 12 }]} onPress={() => setTab("departs")}>
          <Text style={SL.btnText}>Choisir un départ</Text>
        </TouchableOpacity>
      </View>
    );

    if (bordeLoading) return <ActivityIndicator color={A} size="large" style={{ marginTop: 80 }} />;
    if (!bordereau) return (
      <View style={[SL.emptyBox, { flex: 1 }]}>
        <Text style={SL.emptyTitle}>Erreur de chargement</Text>
        <TouchableOpacity onPress={() => loadDetail(selectedTrip.id)} style={[SL.btn, { backgroundColor: A, marginTop: 12 }]}>
          <Text style={SL.btnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );

    const s = bordereau.summary;
    const isValidated = selectedTrip.isValidated;

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>

        {/* Trip banner */}
        <View style={[SL.tripBanner, isValidated && { backgroundColor: "#F0FDF4", borderColor: GREEN + "50" }]}>
          <View style={{ flex: 1 }}>
            <Text style={[SL.tripBannerRoute, isValidated && { color: GREEN }]}>
              {bordereau.trip.from} → {bordereau.trip.to}
            </Text>
            <Text style={SL.tripBannerMeta}>
              {bordereau.trip.departureTime} · {bordereau.trip.busName} · {bordereau.trip.date}
            </Text>
          </View>
          {isValidated && (
            <View style={[SL.badge, { backgroundColor: GREEN + "20" }]}>
              <Feather name="check-circle" size={12} color={GREEN} />
              <Text style={[SL.badgeText, { color: GREEN }]}>En route</Text>
            </View>
          )}
        </View>

        {/* Quick stats */}
        <View style={SL.statsRow}>
          <View style={[SL.statCard, { borderTopColor: GREEN }]}>
            <Text style={[SL.statVal, { color: GREEN }]}>{s.boardedCount}</Text>
            <Text style={SL.statLabel}>Embarqués</Text>
          </View>
          <View style={[SL.statCard, { borderTopColor: A }]}>
            <Text style={[SL.statVal, { color: A }]}>{s.absentCount}</Text>
            <Text style={SL.statLabel}>Absents</Text>
          </View>
          <View style={[SL.statCard, { borderTopColor: BROWN }]}>
            <Text style={[SL.statVal, { color: BROWN }]}>{s.bagageCount}</Text>
            <Text style={SL.statLabel}>Bagages</Text>
          </View>
          <View style={[SL.statCard, { borderTopColor: P }]}>
            <Text style={[SL.statVal, { color: P }]}>{s.colisCount}</Text>
            <Text style={SL.statLabel}>Colis</Text>
          </View>
        </View>

        {/* ── DÉPENSES ── */}
        <View style={SL.sectionHdr}>
          <View style={[SL.sectionAccent, { backgroundColor: RED }]} />
          <View style={[SL.sectionIconBox, { backgroundColor: RED + "15" }]}>
            <Feather name="minus-circle" size={17} color={RED} />
          </View>
          <Text style={[SL.sectionTitle, { color: RED }]}>
            Dépenses ({bordereau.expenses.length})
          </Text>
          {!isValidated && (
            <TouchableOpacity
              onPress={() => setExpModal(true)}
              style={[SL.badge, { backgroundColor: RED + "15", marginLeft: "auto" }]}>
              <Feather name="plus" size={11} color={RED} />
              <Text style={[SL.badgeText, { color: RED }]}>Ajouter</Text>
            </TouchableOpacity>
          )}
        </View>

        {bordereau.expenses.length === 0 ? (
          <View style={[SL.expEmptyRow]}>
            <Text style={SL.emptyInline}>Aucune dépense enregistrée</Text>
            {!isValidated && (
              <TouchableOpacity onPress={() => setExpModal(true)}
                style={[SL.badge, { backgroundColor: RED + "10" }]}>
                <Text style={[SL.badgeText, { color: RED }]}>+ Péage · Ration · Carburant</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          bordereau.expenses.map((e: Expense) => (
            <View key={e.id} style={[SL.expRow]}>
              <View style={[SL.expIcon, { backgroundColor: RED + "12" }]}>
                <Feather name="arrow-down-left" size={13} color={RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[SL.rowName, { textTransform: "capitalize" }]}>{e.type}</Text>
                {e.description && <Text style={SL.rowMeta}>{e.description}</Text>}
              </View>
              <Text style={{ fontSize: 13, fontWeight: "800", color: RED }}>
                − {(e.amount ?? 0).toLocaleString()} FCFA
              </Text>
            </View>
          ))
        )}

        {/* Total dépenses */}
        {bordereau.expenses.length > 0 && (
          <View style={[SL.expTotalRow]}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: GRAY }}>Total dépenses</Text>
            <Text style={{ fontSize: 14, fontWeight: "900", color: RED }}>
              − {s.totalExpenses.toLocaleString()} FCFA
            </Text>
          </View>
        )}

        {/* ── INFO BORDEREAU ── */}
        <View style={SL.bordereauInfoCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Feather name="info" size={14} color={P} />
            <Text style={{ fontSize: 13, fontWeight: "800", color: P }}>
              Synchronisé avec l'Agent de Validation
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: GRAY, lineHeight: 16 }}>
            Les dépenses ajoutées ici sont automatiquement visibles sur le bordereau de l'agent de validation.
            La feuille de route imprimée ne contient {" "}
            <Text style={{ fontWeight: "800", color: A_DARK }}>aucun montant</Text>.
          </Text>
        </View>

        {/* ── PASSAGERS (résumé) ── */}
        <View style={SL.sectionHdr}>
          <View style={[SL.sectionAccent, { backgroundColor: GREEN }]} />
          <View style={[SL.sectionIconBox, { backgroundColor: GREEN + "15" }]}>
            <Feather name="users" size={17} color={GREEN} />
          </View>
          <Text style={[SL.sectionTitle, { color: GREEN }]}>
            Passagers ({s.totalPassengers})
          </Text>
        </View>

        {bordereau.boarded.length === 0 ? (
          <Text style={SL.emptyInline}>Aucun passager embarqué pour l'instant</Text>
        ) : (
          bordereau.boarded.slice(0, 5).map((p: any) => (
            <View key={p.bookingId} style={[SL.rowSimple]}>
              <Feather name="check-circle" size={13} color={GREEN} />
              <View style={{ flex: 1 }}>
                <Text style={SL.rowName}>{p.name}</Text>
                <Text style={SL.rowMeta}>{p.bookingRef}
                  {(p.seatNums ?? []).length > 0 ? ` · Siège ${(p.seatNums ?? []).join(", ")}` : ""}
                </Text>
              </View>
            </View>
          ))
        )}
        {bordereau.boarded.length > 5 && (
          <Text style={[SL.emptyInline, { color: GREEN, fontWeight: "700", fontStyle: "normal" }]}>
            + {bordereau.boarded.length - 5} autres passagers embarqués
          </Text>
        )}

        {/* ── PRINT BUTTON ── */}
        <View style={{ height: 8 }} />
        <TouchableOpacity
          style={[SL.printBtn, printing && { opacity: 0.6 }]}
          onPress={handlePrint}
          disabled={printing}>
          {printing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <View style={SL.printBtnIcon}>
                <Feather name="printer" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={SL.printBtnLabel}>Imprimer la Feuille de Route</Text>
                <Text style={SL.printBtnSub}>Chauffeur · Agent Route · Sans montants</Text>
              </View>
              <Feather name="download" size={16} color="rgba(255,255,255,0.75)" />
            </>
          )}
        </TouchableOpacity>

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

          {/* Trip context */}
          {selectedTrip && (
            <View style={[SL.badge, { backgroundColor: A_MED, alignSelf: "flex-start" }]}>
              <Text style={[SL.badgeText, { color: A_DARK }]}>
                {selectedTrip.from} → {selectedTrip.to} · {selectedTrip.departureTime}
              </Text>
            </View>
          )}

          <Text style={SL.modalLabel}>Type de dépense</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {EXPENSE_TYPES.map(et => (
              <TouchableOpacity key={et.key}
                style={[SL.typeChip, expType === et.key && { backgroundColor: RED, borderColor: RED }]}
                onPress={() => setExpType(et.key)}>
                <Feather name={et.icon} size={13} color={expType === et.key ? "#fff" : GRAY} />
                <Text style={[SL.typeChipText, expType === et.key && { color: "#fff" }]}>{et.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={SL.modalLabel}>Montant (FCFA) *</Text>
          <TextInput
            style={SL.modalInput}
            placeholder="ex: 5 000"
            placeholderTextColor="#9CA3AF"
            value={expAmount}
            onChangeText={setExpAmount}
            keyboardType="numeric"
          />

          <Text style={SL.modalLabel}>Description (optionnel)</Text>
          <TextInput
            style={SL.modalInput}
            placeholder="ex: Péage autoroute, Déjeuner chauffeur..."
            placeholderTextColor="#9CA3AF"
            value={expDesc}
            onChangeText={setExpDesc}
          />

          <Text style={[SL.modalLabel, { color: GREEN, marginTop: 4 }]}>
            ✓ Automatiquement visible sur le bordereau de validation
          </Text>

          <TouchableOpacity
            style={[SL.btn, { backgroundColor: RED, marginTop: 6 }, savingExp && { opacity: 0.6 }]}
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
        <TouchableOpacity onPress={() => router.back()} style={SL.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={SL.headerTitle}>Impression Départ</Text>
          <Text style={SL.headerSub}>Dépenses · Feuille de Route</Text>
        </View>
        <TouchableOpacity style={SL.refreshBtn} onPress={loadTrips} disabled={tripsLoading}>
          <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={SL.tabs}>
        <TouchableOpacity
          style={[SL.tab, tab === "departs" && [SL.tabActive, { borderBottomColor: A }]]}
          onPress={() => setTab("departs")}>
          <Feather name="list" size={15} color={tab === "departs" ? A : GRAY} />
          <Text style={[SL.tabText, tab === "departs" && { color: A }]}>
            Départs ({trips.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[SL.tab, tab === "detail" && [SL.tabActive, { borderBottomColor: A }]]}
          onPress={() => setTab("detail")}>
          <Feather name="printer" size={15} color={tab === "detail" ? A : GRAY} />
          <Text style={[SL.tabText, tab === "detail" && { color: A }]}>
            {selectedTrip ? `${selectedTrip.from}→${selectedTrip.to}` : "Impression"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "departs" ? renderDeparts() : renderDetail()}
      </View>

      {renderExpModal()}
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const SL = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#F8FAFC" },

  header:      { backgroundColor: NAVY, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub:   { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 },
  refreshBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },

  tabs:      { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tab:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: {},
  tabText:   { fontSize: 12, fontWeight: "700", color: GRAY },

  sectionHdr:     { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionAccent:  { width: 5, height: 34, borderRadius: 3 },
  sectionIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  sectionTitle:   { fontSize: 14, fontWeight: "800", flex: 1 },

  badge:     { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  chip:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F8FAFC", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  chipTxt: { fontSize: 11, fontWeight: "600", color: GRAY },

  tripCard:   { backgroundColor: "#fff", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: NAVY, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3, overflow: "hidden" },
  tripAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  tripRoute:  { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  tripMeta:   { fontSize: 12, color: GRAY, marginTop: 1 },

  tripBanner:      { backgroundColor: A + "10", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: A + "30" },
  tripBannerRoute: { fontSize: 15, fontWeight: "800", color: A_DARK },
  tripBannerMeta:  { fontSize: 12, color: GRAY, marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 8 },
  statCard:  { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", borderTopWidth: 3, shadowColor: NAVY, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  statVal:   { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "600", color: GRAY, marginTop: 2 },

  rowName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  rowMeta: { fontSize: 12, color: GRAY },

  expRow:     { backgroundColor: "#fff", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, borderLeftWidth: 4, borderLeftColor: RED, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  expIcon:    { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  expEmptyRow:{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  expTotalRow:{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: RED + "30" },

  rowSimple: { backgroundColor: "#fff", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: NAVY, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },

  bordereauInfoCard: { backgroundColor: "#EEF2FF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#C7D2FE" },

  printBtn:      { backgroundColor: A_DARK, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 16, shadowColor: A_DARK, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  printBtnIcon:  { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  printBtnLabel: { fontSize: 15, fontWeight: "900", color: "#fff" },
  printBtnSub:   { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },

  infoBox:     { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: A_LIGHT, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: A_MED },
  infoText:    { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  emptyBox:    { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTitle:  { fontSize: 16, fontWeight: "700", color: "#334155" },
  emptyInline: { fontSize: 12, color: GRAY, fontStyle: "italic" },

  btn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, paddingHorizontal: 20 },
  btnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard:    { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 10 },
  modalHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle:   { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  modalLabel:   { fontSize: 13, fontWeight: "700", color: GRAY, marginTop: 4 },
  modalInput:   { backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#0F172A" },
  typeChip:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  typeChipText: { fontSize: 13, fontWeight: "700", color: GRAY },
});
