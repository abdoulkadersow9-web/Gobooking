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

const PRIMARY = "#0B3C5D";
const PROFIT_GREEN = "#16A34A";
const LOSS_RED = "#DC2626";
const AMBER = "#D97706";

const EXPENSE_TYPES = [
  { key: "carburant", label: "Carburant", icon: "droplet"   as const },
  { key: "peage",     label: "Péage",     icon: "map-pin"   as const },
  { key: "autre",     label: "Autre",     icon: "file-text" as const },
];

interface TripExpense {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  date: string;
}

interface TripRent {
  tripId: string;
  from: string;
  to: string;
  date: string;
  departureTime: string;
  busName: string;
  busType: string;
  status: string;
  totalRecettes: number;
  recettesReservations: number;
  recettesColis: number;
  totalDepenses: number;
  benefice: number;
  bookedSeats: number;
  totalSeats: number;
  expenses: TripExpense[];
}

function getConseil(trip: TripRent): { label: string; iconName: string; color: string; bg: string; border: string } {
  const fillRate = trip.totalSeats > 0 ? trip.bookedSeats / trip.totalSeats : 0;
  if (fillRate < 0.5) {
    return { label: "Bus peu rempli", iconName: "alert-triangle", color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" };
  }
  if (trip.benefice < 0) {
    return { label: "Trajet non rentable", iconName: "trending-down", color: LOSS_RED, bg: "#FEF2F2", border: "#FECACA" };
  }
  return { label: "Trajet rentable", iconName: "trending-up", color: PROFIT_GREEN, bg: "#F0FDF4", border: "#BBF7D0" };
}

interface Summary {
  totalRecettes: number;
  totalDepenses: number;
  totalBenefice: number;
  tripCount: number;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR") + " FCFA";
}
function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

export default function RentabiliteScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [trips, setTrips] = useState<TripRent[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalRecettes: 0, totalDepenses: 0, totalBenefice: 0, tripCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expanded, setExpanded] = useState<string | null>(null);

  /* ── Simulateur de gain ── */
  const [simOpen, setSimOpen] = useState(true);
  const [simPrix, setSimPrix] = useState("5000");
  const [simPlaces, setSimPlaces] = useState("70");
  const [simTaux, setSimTaux] = useState("80");

  const gainEstime = (() => {
    const prix = parseFloat(simPrix) || 0;
    const places = parseInt(simPlaces) || 0;
    const taux = Math.min(Math.max(parseFloat(simTaux) || 0, 0), 100) / 100;
    return Math.round(prix * places * taux);
  })();

  const [showAddExp, setShowAddExp] = useState(false);
  const [addTarget, setAddTarget] = useState<TripRent | null>(null);
  const [expType, setExpType] = useState("carburant");
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await apiFetch<{ trips?: TripRent[]; summary?: Summary }>("/company/rentabilite", { token: token! });
      setTrips(Array.isArray(data?.trips) ? data.trips : []);
      setSummary(data?.summary ?? { totalRecettes: 0, totalDepenses: 0, totalBenefice: 0, tripCount: 0 });
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const openAddExp = (trip: TripRent) => {
    setAddTarget(trip);
    setExpType("carburant");
    setExpAmount("");
    setExpDesc("");
    setExpDate(new Date().toISOString().split("T")[0]);
    setShowAddExp(true);
  };

  const saveExpense = async () => {
    if (!addTarget || !expAmount) {
      Alert.alert("Champ requis", "Veuillez saisir un montant."); return;
    }
    setSaving(true);
    try {
      await apiFetch(`/company/trips/${addTarget.tripId}/expenses`, {
        method: "POST", token: token!,
        body: { type: expType, amount: parseInt(expAmount), description: expDesc || null, date: expDate },
      });
      setShowAddExp(false);
      fetchData();
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer la dépense.");
    } finally { setSaving(false); }
  };

  const deleteExpense = (expId: string) => {
    Alert.alert("Supprimer", "Supprimer cette dépense ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
        try {
          await apiFetch(`/company/expenses/${expId}`, { method: "DELETE", token: token! });
          fetchData();
        } catch { Alert.alert("Erreur", "Impossible de supprimer."); }
      }},
    ]);
  };

  const isProfit = summary.totalBenefice >= 0;

  return (
    <SafeAreaView style={S.root} edges={["bottom"]}>
      <LinearGradient colors={[PRIMARY, "#1E5F8A"]} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <View style={S.headerRow}>
          <Pressable onPress={() => router.back()} style={S.iconBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle}>Rentabilité</Text>
            <Text style={S.headerSub}>{summary.tripCount} trajet{summary.tripCount !== 1 ? "s" : ""} analysé{summary.tripCount !== 1 ? "s" : ""}</Text>
          </View>
        </View>

        {/* Summary KPIs */}
        <View style={S.kpiGrid}>
          <View style={S.kpiCard}>
            <Feather name="trending-up" size={16} color="#34D399" />
            <Text style={S.kpiVal}>{fmt(summary.totalRecettes)}</Text>
            <Text style={S.kpiLbl}>Total recettes</Text>
          </View>
          <View style={S.kpiCard}>
            <Feather name="trending-down" size={16} color="#F87171" />
            <Text style={S.kpiVal}>{fmt(summary.totalDepenses)}</Text>
            <Text style={S.kpiLbl}>Total dépenses</Text>
          </View>
          <View style={[S.kpiCard, S.kpiCardWide, { backgroundColor: isProfit ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.20)" }]}>
            <Feather name={isProfit ? "arrow-up-circle" : "arrow-down-circle"} size={16} color={isProfit ? "#34D399" : "#F87171"} />
            <Text style={[S.kpiVal, { color: isProfit ? "#34D399" : "#FCA5A5", fontSize: 18 }]}>{fmt(summary.totalBenefice)}</Text>
            <Text style={S.kpiLbl}>Bénéfice net</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={S.center}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : trips.length === 0 ? (
        <View style={S.center}>
          <Feather name="bar-chart-2" size={38} color={PRIMARY} style={{ marginBottom: 12 }} />
          <Text style={S.emptyTitle}>Aucun trajet</Text>
          <Text style={S.emptySub}>Les trajets de votre compagnie apparaîtront ici avec leur bilan financier.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {/* ── Simulateur de gain ── */}
          <View style={S.simCard}>
            <Pressable style={S.simHeader} onPress={() => setSimOpen(o => !o)}>
              <View style={S.simTitleRow}>
                <View style={S.simIconBox}>
                  <Text style={{ fontSize: 16 }}>🔮</Text>
                </View>
                <View>
                  <Text style={S.simTitle}>Simulateur de gain</Text>
                  <Text style={S.simSub}>Estimez le revenu d'un trajet</Text>
                </View>
              </View>
              <Feather name={simOpen ? "chevron-up" : "chevron-down"} size={16} color="#94A3B8" />
            </Pressable>

            {simOpen && (
              <View style={S.simBody}>
                {/* Inputs row */}
                <View style={S.simInputGrid}>
                  <View style={S.simInputBlock}>
                    <Text style={S.simLabel}>Prix ticket (FCFA)</Text>
                    <View style={S.simInputWrap}>
                      <Feather name="dollar-sign" size={14} color="#64748B" />
                      <TextInput
                        style={S.simInput}
                        value={simPrix}
                        onChangeText={setSimPrix}
                        keyboardType="numeric"
                        placeholder="5000"
                        placeholderTextColor="#CBD5E1"
                      />
                    </View>
                  </View>
                  <View style={S.simInputBlock}>
                    <Text style={S.simLabel}>Total places</Text>
                    <View style={S.simInputWrap}>
                      <Feather name="users" size={14} color="#64748B" />
                      <TextInput
                        style={S.simInput}
                        value={simPlaces}
                        onChangeText={setSimPlaces}
                        keyboardType="numeric"
                        placeholder="70"
                        placeholderTextColor="#CBD5E1"
                      />
                    </View>
                  </View>
                </View>

                {/* Taux slider row */}
                <View style={S.simTauxRow}>
                  <Text style={S.simLabel}>Taux de remplissage</Text>
                  <View style={S.simTauxPills}>
                    {["50", "60", "70", "80", "90", "100"].map(v => (
                      <Pressable
                        key={v}
                        style={[S.simPill, simTaux === v && S.simPillActive]}
                        onPress={() => setSimTaux(v)}
                      >
                        <Text style={[S.simPillText, simTaux === v && { color: "#fff" }]}>{v}%</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={S.simInputWrapFull}>
                    <TextInput
                      style={[S.simInput, { textAlign: "center" }]}
                      value={simTaux}
                      onChangeText={setSimTaux}
                      keyboardType="numeric"
                      placeholder="80"
                      placeholderTextColor="#CBD5E1"
                    />
                    <Text style={S.simPct}>%</Text>
                  </View>
                </View>

                {/* Formula reminder */}
                <View style={S.simFormula}>
                  <Text style={S.simFormulaText}>
                    {simPrix || "?"} × {simPlaces || "?"} × {simTaux || "?"}% = gain estimé
                  </Text>
                </View>

                {/* Result */}
                <View style={[S.simResult, { backgroundColor: gainEstime > 0 ? "#F0FDF4" : "#F8FAFC", borderColor: gainEstime > 0 ? "#BBF7D0" : "#E2E8F0" }]}>
                  <Text style={S.simResultLabel}>Gain estimé</Text>
                  <Text style={[S.simResultVal, { color: gainEstime > 0 ? PROFIT_GREEN : "#94A3B8" }]}>
                    {gainEstime > 0 ? fmt(gainEstime) : "—"}
                  </Text>
                  {gainEstime > 0 && (
                    <Text style={S.simResultHint}>
                      soit {Math.round(gainEstime / Math.max(parseInt(simPlaces) || 1, 1)).toLocaleString("fr-FR")} FCFA / place
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {trips.length > 0 && <Text style={S.sectionLabel}>Trajets analysés</Text>}

          {trips.map(trip => {
            const profit = trip.benefice >= 0;
            const isOpen = expanded === trip.tripId;
            const conseil = getConseil(trip);
            const fillPct = trip.totalSeats > 0 ? Math.round((trip.bookedSeats / trip.totalSeats) * 100) : 0;

            return (
              <View key={trip.tripId} style={S.card}>
                {/* Header row */}
                <Pressable style={S.cardHeader} onPress={() => setExpanded(isOpen ? null : trip.tripId)}>
                  <View style={S.routeBadge}>
                    <Text style={S.routeFrom}>{trip.from}</Text>
                    <Feather name="arrow-right" size={12} color="#64748B" />
                    <Text style={S.routeTo}>{trip.to}</Text>
                  </View>
                  <View style={[S.beneficeBadge, { backgroundColor: profit ? "#F0FDF4" : "#FEF2F2" }]}>
                    <Feather name={profit ? "arrow-up" : "arrow-down"} size={12} color={profit ? PROFIT_GREEN : LOSS_RED} />
                    <Text style={[S.beneficeVal, { color: profit ? PROFIT_GREEN : LOSS_RED }]}>
                      {fmt(trip.benefice)}
                    </Text>
                  </View>
                  <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color="#94A3B8" />
                </Pressable>

                <View style={S.cardMeta}>
                  <Text style={S.cardMetaText}>{trip.busName} · {trip.busType}</Text>
                  <Text style={S.cardMetaText}>{fmtDate(trip.date)} à {trip.departureTime}</Text>
                </View>

                {/* Conseil automatique */}
                <View style={[S.conseilBadge, { backgroundColor: conseil.bg, borderColor: conseil.border }]}>
                  <Feather name={conseil.iconName as never} size={14} color={conseil.color} style={{ marginRight: 4 }} />
                  <Text style={[S.conseilLabel, { color: conseil.color }]}>{conseil.label}</Text>
                  {trip.totalSeats > 0 && (
                    <Text style={[S.conseilSub, { color: conseil.color }]}>
                      · {trip.bookedSeats}/{trip.totalSeats} places ({fillPct}%)
                    </Text>
                  )}
                </View>

                {/* Recettes vs Dépenses bar */}
                <View style={S.finRow}>
                  <View style={S.finItem}>
                    <View style={S.finDot} />
                    <View>
                      <Text style={S.finLabel}>Recettes</Text>
                      <Text style={S.finGreen}>{fmt(trip.totalRecettes)}</Text>
                      <Text style={S.finSub}>Billets: {fmt(trip.recettesReservations)} · Colis: {fmt(trip.recettesColis)}</Text>
                    </View>
                  </View>
                  <View style={S.finDivider} />
                  <View style={S.finItem}>
                    <View style={[S.finDot, { backgroundColor: "#EF4444" }]} />
                    <View>
                      <Text style={S.finLabel}>Dépenses</Text>
                      <Text style={S.finRed}>{fmt(trip.totalDepenses)}</Text>
                      <Text style={S.finSub}>{trip.expenses.length} entrée{trip.expenses.length !== 1 ? "s" : ""}</Text>
                    </View>
                  </View>
                </View>

                {/* Expanded: expenses list + add button */}
                {isOpen && (
                  <View style={S.expandedSection}>
                    <View style={S.expHeader}>
                      <Text style={S.expTitle}>Détail des dépenses</Text>
                      <Pressable style={S.addExpBtn} onPress={() => openAddExp(trip)}>
                        <Feather name="plus" size={13} color={AMBER} />
                        <Text style={S.addExpText}>Ajouter</Text>
                      </Pressable>
                    </View>

                    {trip.expenses.length === 0 ? (
                      <Text style={S.noExpText}>Aucune dépense enregistrée</Text>
                    ) : (
                      trip.expenses.map(exp => {
                        const typeInfo = EXPENSE_TYPES.find(t => t.key === exp.type) ?? { icon: "file-text" as const, label: exp.type };
                        return (
                          <View key={exp.id} style={S.expRow}>
                            <Feather name={typeInfo.icon} size={18} color="#64748B" style={{ marginRight: 8 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={S.expType}>{typeInfo.label}</Text>
                              {exp.description ? <Text style={S.expDesc}>{exp.description}</Text> : null}
                              <Text style={S.expDate}>{fmtDate(exp.date)}</Text>
                            </View>
                            <Text style={S.expAmount}>{fmt(exp.amount)}</Text>
                            <Pressable onPress={() => deleteExpense(exp.id)} style={{ padding: 6, marginLeft: 4 }}>
                              <Feather name="trash-2" size={14} color="#EF4444" />
                            </Pressable>
                          </View>
                        );
                      })
                    )}

                    {/* Profit bar */}
                    <View style={[S.profitBar, { backgroundColor: profit ? "#F0FDF4" : "#FEF2F2", borderColor: profit ? "#BBF7D0" : "#FECACA" }]}>
                      <Feather name={profit ? "check-circle" : "alert-circle"} size={14} color={profit ? PROFIT_GREEN : LOSS_RED} />
                      <Text style={[S.profitText, { color: profit ? PROFIT_GREEN : LOSS_RED }]}>
                        {profit ? "Bénéfice" : "Perte"} : {fmt(Math.abs(trip.benefice))}
                        {trip.totalRecettes > 0 ? ` (${Math.round((trip.benefice / trip.totalRecettes) * 100)}%)` : ""}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add Expense Modal */}
      <Modal visible={showAddExp} transparent animationType="slide" onRequestClose={() => setShowAddExp(false)}>
        <Pressable style={S.overlay} onPress={() => setShowAddExp(false)}>
          <Pressable style={S.sheet} onPress={e => e.stopPropagation()}>
            <View style={S.handle} />
            <Text style={S.sheetTitle}>Ajouter une dépense</Text>
            {addTarget && (
              <View style={S.sheetTripInfo}>
                <Ionicons name="bus" size={14} color="#64748B" />
                <Text style={S.sheetTripText}>{addTarget.from} → {addTarget.to} · {fmtDate(addTarget.date)}</Text>
              </View>
            )}

            <Text style={S.label}>Type de dépense</Text>
            <View style={S.typeRow}>
              {EXPENSE_TYPES.map(t => (
                <Pressable
                  key={t.key}
                  style={[S.typePill, expType === t.key && S.typePillActive]}
                  onPress={() => setExpType(t.key)}
                >
                  <Text style={{ fontSize: 16 }}>{t.icon}</Text>
                  <Text style={[S.typePillText, expType === t.key && { color: "#fff" }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={S.label}>Montant (FCFA)</Text>
            <View style={S.inputWrap}>
              <Feather name="credit-card" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
              <TextInput
                style={S.input}
                placeholder="Ex: 15000"
                placeholderTextColor="#CBD5E1"
                value={expAmount}
                onChangeText={setExpAmount}
                keyboardType="numeric"
              />
            </View>

            <Text style={S.label}>Description (optionnel)</Text>
            <View style={S.inputWrap}>
              <TextInput
                style={S.input}
                placeholder="Ex: Station Total, Autoroute A1…"
                placeholderTextColor="#CBD5E1"
                value={expDesc}
                onChangeText={setExpDesc}
              />
            </View>

            <Text style={S.label}>Date</Text>
            <View style={S.inputWrap}>
              <Feather name="calendar" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
              <TextInput
                style={S.input}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor="#CBD5E1"
                value={expDate}
                onChangeText={setExpDate}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={S.sheetBtns}>
              <Pressable style={S.cancelBtn} onPress={() => setShowAddExp(false)}>
                <Text style={S.cancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={[S.saveBtn, saving && { opacity: 0.6 }]} onPress={saveExpense} disabled={saving}>
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

  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpiCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 12, padding: 12, alignItems: "center", gap: 4, minWidth: 120 },
  kpiCardWide: { flexBasis: "100%", flexDirection: "row", justifyContent: "center", gap: 8, alignItems: "center" },
  kpiVal: { fontSize: 14, fontWeight: "800", color: "#fff" },
  kpiLbl: { fontSize: 10, color: "rgba(255,255,255,0.7)", textAlign: "center" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  emptySub: { fontSize: 14, color: "#94A3B8", textAlign: "center", lineHeight: 20 },

  list: { padding: 16, gap: 12 },

  card: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, paddingBottom: 8 },
  routeBadge: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  routeFrom: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  routeTo: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  beneficeBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  beneficeVal: { fontSize: 12, fontWeight: "700" },

  cardMeta: { flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingBottom: 10, flexWrap: "wrap" },
  cardMetaText: { fontSize: 11, color: "#64748B" },

  finRow: { flexDirection: "row", alignItems: "stretch", marginHorizontal: 14, marginBottom: 12, backgroundColor: "#F8FAFC", borderRadius: 12, overflow: "hidden" },
  finItem: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12 },
  finDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E", marginTop: 3 },
  finDivider: { width: 1, backgroundColor: "#E2E8F0" },
  finLabel: { fontSize: 10, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  finGreen: { fontSize: 13, fontWeight: "800", color: PROFIT_GREEN },
  finRed: { fontSize: 13, fontWeight: "800", color: LOSS_RED },
  finSub: { fontSize: 10, color: "#94A3B8", marginTop: 2 },

  expandedSection: { borderTopWidth: 1, borderTopColor: "#F1F5F9", padding: 14 },
  expHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  expTitle: { fontSize: 13, fontWeight: "700", color: "#334155" },
  addExpBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#FCD34D" },
  addExpText: { fontSize: 12, fontWeight: "600", color: AMBER },
  noExpText: { fontSize: 13, color: "#CBD5E1", fontStyle: "italic", textAlign: "center", paddingVertical: 8 },
  expRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  expType: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  expDesc: { fontSize: 11, color: "#64748B", marginTop: 1 },
  expDate: { fontSize: 10, color: "#94A3B8", marginTop: 1 },
  expAmount: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  profitBar: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1 },
  profitText: { fontSize: 13, fontWeight: "700" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 10 },
  sheetTripInfo: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, marginBottom: 10 },
  sheetTripText: { fontSize: 13, fontWeight: "600", color: PRIMARY, flex: 1 },
  label: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },
  typeRow: { flexDirection: "row", gap: 8 },
  typePill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  typePillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  typePillText: { fontSize: 12, fontWeight: "600", color: "#334155" },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 12 },
  input: { flex: 1, fontSize: 14, color: "#0F172A" },
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: PRIMARY, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  saveText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  /* Conseil */
  conseilBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 14, marginBottom: 10, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  conseilIcon: { fontSize: 14 },
  conseilLabel: { fontSize: 12, fontWeight: "700" },
  conseilSub: { fontSize: 11, fontWeight: "500", opacity: 0.8 },

  /* Simulateur */
  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 6, marginBottom: 2 },
  simCard: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3, borderWidth: 1.5, borderColor: "#E0F2FE" },
  simHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  simTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  simIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F0F9FF", alignItems: "center", justifyContent: "center" },
  simTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  simSub: { fontSize: 11, color: "#64748B", marginTop: 1 },
  simBody: { borderTopWidth: 1, borderTopColor: "#F1F5F9", padding: 14, gap: 12 },
  simInputGrid: { flexDirection: "row", gap: 10 },
  simInputBlock: { flex: 1, gap: 6 },
  simLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.6 },
  simInputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  simInputWrapFull: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 8, gap: 4, marginTop: 8, alignSelf: "center", minWidth: 90 },
  simInputPrefix: { fontSize: 14 },
  simInput: { flex: 1, fontSize: 14, color: "#0F172A", fontWeight: "600" },
  simPct: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  simTauxRow: { gap: 8 },
  simTauxPills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  simPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  simPillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  simPillText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  simFormula: { backgroundColor: "#FFF7ED", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: "#FED7AA" },
  simFormulaText: { fontSize: 12, fontWeight: "600", color: "#92400E", textAlign: "center" },
  simResult: { borderRadius: 14, borderWidth: 1.5, padding: 16, alignItems: "center", gap: 4 },
  simResultLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8 },
  simResultVal: { fontSize: 26, fontWeight: "900" },
  simResultHint: { fontSize: 11, color: "#64748B", marginTop: 2 },
});
