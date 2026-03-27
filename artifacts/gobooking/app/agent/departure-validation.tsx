/**
 * Agent Validation Départ — Module 3
 * Validation centralisée des départs
 * - Synthèse: passagers, absents, bagages, colis, dépenses
 * - Ajout de dépenses (péage, ration, autre)
 * - Bouton VALIDER → départ déclaré en route, notifications envoyées
 * - Bordereau complet (entreprise) + bordereau guichet (sans montants)
 */
import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
  const { user } = useAuth();
  const token = (user as any)?.token ?? "";

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
  const [validating, setValidating] = useState(false);
  const [validated, setValidated]   = useState(false);

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
    setTab("bordereau");
    loadBordereau(t.id);
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

  /* ─ VALIDATE departure ─ */
  const handleValidate = async () => {
    if (!selectedTrip) return;
    Alert.alert(
      "Valider le départ",
      `Confirmer le départ ${selectedTrip.from} → ${selectedTrip.to} à ${selectedTrip.departureTime} ?\n\nCette action est irréversible. Le bus sera déclaré en route.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Valider le départ",
          style: "destructive",
          onPress: async () => {
            setValidating(true);
            try {
              const r = await fetch(`${API}/agent/validation-depart/validate/${selectedTrip.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              });
              const data = await r.json();
              if (r.ok) {
                setValidated(true);
                loadBordereau(selectedTrip.id);
                loadTrips();
              } else Alert.alert("Erreur", data.error ?? "Validation échouée");
            } catch { Alert.alert("Erreur réseau"); }
            finally { setValidating(false); }
          },
        },
      ]
    );
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
  const renderDeparts = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing || tripsLoading} onRefresh={() => { setRefr(true); loadTrips(); }} tintColor={P} />}>
      {/* Info */}
      <View style={SL.infoBox}>
        <Feather name="info" size={14} color={P} />
        <Text style={[SL.infoText, { color: P }]}>
          Sélectionnez un départ pour voir le bordereau complet et valider le départ.
        </Text>
      </View>

      <View style={SL.sectionHdr}>
        <View style={[SL.sectionAccent, { backgroundColor: P }]} />
        <View style={[SL.sectionIconBox, { backgroundColor: P + "18" }]}>
          <Feather name="navigation" size={17} color={P} />
        </View>
        <Text style={[SL.sectionTitle, { color: P }]}>Départs du jour</Text>
        <View style={[SL.badge, { backgroundColor: P + "18" }]}>
          <Text style={[SL.badgeText, { color: P }]}>{trips.length}</Text>
        </View>
      </View>

      {tripsLoading ? (
        <ActivityIndicator color={P} style={{ marginTop: 40 }} />
      ) : trips.length === 0 ? (
        <View style={SL.emptyBox}>
          <Feather name="calendar" size={40} color="#CBD5E1" />
          <Text style={SL.emptyTitle}>Aucun départ aujourd'hui</Text>
        </View>
      ) : (
        trips.map(renderTripCard)
      )}
    </ScrollView>
  );

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

    const s = bordereau.summary;

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
          {!validated && (
            <TouchableOpacity onPress={() => setExpModal(true)} style={[SL.badge, { backgroundColor: RED + "18", marginLeft: "auto" }]}>
              <Feather name="plus" size={11} color={RED} />
              <Text style={[SL.badgeText, { color: RED }]}>Ajouter</Text>
            </TouchableOpacity>
          )}
        </View>
        {bordereau.expenses.length === 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={SL.emptyInline}>Aucune dépense enregistrée</Text>
            {!validated && (
              <TouchableOpacity onPress={() => setExpModal(true)} style={[SL.badge, { backgroundColor: RED + "10" }]}>
                <Text style={[SL.badgeText, { color: RED }]}>+ Ajouter (péage, ration...)</Text>
              </TouchableOpacity>
            )}
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
          <View style={SL.validatedBox}>
            <Feather name="check-circle" size={28} color={GREEN} />
            <View>
              <Text style={SL.validatedTitle}>Départ validé — En route</Text>
              <Text style={SL.validatedSub}>
                Passagers notifiés · Colis en transit · Bordereau envoyé
              </Text>
            </View>
          </View>
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
        <TouchableOpacity onPress={() => router.back()} style={SL.backBtn} hitSlop={8}>
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
});
