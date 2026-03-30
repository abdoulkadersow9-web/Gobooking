import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";
import { getSeatColor, SEAT_LEGEND } from "@/utils/seatColors";

const G       = "#16A34A";
const G_DARK  = "#15803D";
const G_LIGHT = "#DCFCE7";

/* ─── Modes de paiement ─────────────────────────────────────── */
const PAY_METHODS = [
  { id: "cash",  label: "Cash",      icon: "dollar-sign" as const },
  { id: "wave",  label: "Wave",      icon: "wifi"        as const },
  { id: "mtn",   label: "MTN",       icon: "smartphone"  as const },
  { id: "orange",label: "Orange",    icon: "phone"       as const },
] as const;

/* ─── Types ──────────────────────────────────────────────────── */
interface AgentSeat {
  id:             string;
  number:         string;
  row:            number;
  column:         number;
  status:         "available" | "reserved" | "occupied" | "sp";
  clientName?:    string | null;
  clientPhone?:   string | null;
  bookingRef?:    string | null;
  paymentMethod?: string | null;
}

const ICON_MAP: Record<string, any> = {
  available: "check",
  reserved:  "clock",
  occupied:  "x",
  sp:        "shield",
};

const STATUS_LABEL: Record<string, string> = {
  available: "Libre",
  reserved:  "Réservé",
  occupied:  "Vendu",
  sp:        "SP",
};

/* ═══════════════════════════════════════════════════════════════
   SCREEN
═══════════════════════════════════════════════════════════════ */
export default function AgentSeatPlanScreen() {
  const { tripId, from, to, date, time, busType } = useLocalSearchParams<{
    tripId: string; from?: string; to?: string;
    date?: string;  time?: string; busType?: string;
  }>();
  const { token }  = useAuth();
  const insets     = useSafeAreaInsets();
  const topPad     = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad  = Platform.OS === "web" ? 0 : insets.bottom;

  /* ── Seats ── */
  const [seats, setSeats]         = useState<AgentSeat[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ── Selection ── */
  const [selected, setSelected]   = useState<AgentSeat | null>(null);
  const panelAnim = useRef(new Animated.Value(0)).current;

  /* ── Booking form ── */
  const [actionType, setActionType] = useState<"vendre" | "réserver" | "sp">("vendre");
  const [paxName, setPaxName]       = useState("");
  const [paxPhone, setPaxPhone]     = useState("");
  const [payMethod, setPayMethod]   = useState<string>("cash");
  const [submitting, setSubmitting] = useState(false);

  /* ── Load ── */
  const loadSeats = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await apiFetch<AgentSeat[]>(`/agent/seats/${tripId}`, {
        token: token ?? undefined,
      });
      setSeats(Array.isArray(data) ? data : []);
    } catch {
      setSeats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId, token]);

  useEffect(() => { loadSeats(); }, [loadSeats]);

  /* Auto-refresh every 15 s */
  useEffect(() => {
    const interval = setInterval(() => loadSeats(true), 15_000);
    return () => clearInterval(interval);
  }, [loadSeats]);

  /* Panel slide animation */
  useEffect(() => {
    Animated.spring(panelAnim, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      speed: 22, bounciness: 5,
    }).start();
  }, [selected]);

  /* ── Seat tap ── */
  const onSeatPress = (seat: AgentSeat) => {
    if (selected?.id === seat.id) {
      setSelected(null);
      return;
    }
    setSelected(seat);
    if (seat.status === "available") {
      setPaxName(""); setPaxPhone(""); setActionType("vendre"); setPayMethod("cash");
    } else {
      setPaxName(seat.clientName ?? "");
      setPaxPhone(seat.clientPhone ?? "");
      setActionType("vendre");
    }
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!selected) return;
    if (selected.status !== "available") {
      Alert.alert("Siège occupé", "Ce siège est déjà vendu ou réservé.");
      return;
    }
    if (!paxName.trim()) {
      Alert.alert("Champ requis", "Saisissez le nom du passager.");
      return;
    }
    if (actionType !== "sp" && !payMethod) {
      Alert.alert("Mode de paiement", "Choisissez un mode de paiement.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ bookingRef?: string; id?: string }>(
        "/agent/reservations",
        {
          token:  token ?? undefined,
          method: "POST",
          body: {
            tripId,
            clientName:          paxName.trim(),
            clientPhone:         paxPhone.trim(),
            seatCount:           1,
            paymentMethod:       actionType === "sp" ? "sp" : payMethod,
            isSP:                actionType === "sp",
            isReservation:       actionType === "réserver",
            preferredSeatNumber: selected.number,
          },
        }
      );
      const label =
        actionType === "sp"       ? "SP créé"     :
        actionType === "réserver" ? "Réservé"      : "Vendu";
      Alert.alert(
        "✓ Succès",
        `Siège ${selected.number} — ${label}\nRéf: ${res.bookingRef ?? res.id ?? "—"}`,
      );
      setSelected(null);
      loadSeats(true);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de traiter la demande");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Derived ── */
  const rows     = Array.from(new Set(seats.map(s => s.row))).sort((a, b) => a - b);
  const cntAvail = seats.filter(s => s.status === "available").length;
  const cntResvd = seats.filter(s => s.status === "reserved").length;
  const cntOccup = seats.filter(s => s.status === "occupied" || s.status === "sp").length;

  /* ── Render seat ── */
  const renderSeat = (seat: AgentSeat) => {
    const c         = getSeatColor(seat.status);
    const icon      = ICON_MAP[seat.status] ?? "help-circle";
    const isSelected = selected?.id === seat.id;
    const initials  = seat.clientName
      ? seat.clientName.trim().split(/\s+/).map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase()
      : null;

    return (
      <Pressable
        key={seat.id}
        onPress={() => onSeatPress(seat)}
        style={({ pressed }) => [
          styles.seat,
          isSelected
            ? { backgroundColor: G, borderColor: G_DARK,
                shadowColor: G, shadowOpacity: 0.45, shadowRadius: 8, elevation: 6,
                transform: [{ scale: 1.10 }] }
            : { backgroundColor: c.bg, borderColor: c.border },
          pressed && !isSelected && { transform: [{ scale: 0.90 }], opacity: 0.85 },
        ]}
      >
        {isSelected && <View style={styles.seatSelectedRing} />}
        <Feather name={icon} size={12} color={isSelected ? "#fff" : c.text} />
        <Text style={[styles.seatNum, { color: isSelected ? "#fff" : c.text }]}>
          {seat.number}
        </Text>
        {initials && !isSelected && (
          <Text style={[styles.seatInitials, { color: c.text }]}>{initials}</Text>
        )}
      </Pressable>
    );
  };

  const panelTranslateY = panelAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [340, 0],
  });

  /* ══════════════════ RENDER ══════════════════ */
  return (
    <View style={[styles.container, { paddingTop: topPad }]}>

      {/* ── Header ─────────────────────────────── */}
      <LinearGradient colors={[G, G_DARK]} style={styles.header}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/tickets" as any)}
          style={styles.iconBtn}
        >
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {from ?? "?"} → {to ?? "?"}
          </Text>
          <Text style={styles.headerSub}>
            {date} · {time}{busType ? ` · ${busType}` : ""}
          </Text>
        </View>
        <TouchableOpacity onPress={() => loadSeats(true)} style={styles.iconBtn}>
          {refreshing
            ? <ActivityIndicator size="small" color="white" />
            : <Feather name="refresh-cw" size={16} color="white" />}
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Légende ─────────────────────────────── */}
      <View style={styles.legend}>
        {SEAT_LEGEND.map(item => {
          const c = getSeatColor(item.status);
          return (
            <View key={item.status} style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: c.bg, borderColor: c.border }]}>
                <Feather name={ICON_MAP[item.status]} size={10} color={c.text} />
              </View>
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Plan ──────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={G} />
          <Text style={styles.loadingText}>Chargement du plan…</Text>
        </View>
      ) : seats.length === 0 ? (
        <View style={styles.center}>
          <Feather name="grid" size={52} color="#D1D5DB" />
          <Text style={styles.emptyText}>Aucun siège configuré</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadSeats()}>
            <Text style={styles.retryText}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            selected && { paddingBottom: 320 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Column headers */}
          <View style={styles.colHeader}>
            <View style={styles.rowLabelSpace} />
            <View style={styles.colGroup}>
              <Text style={styles.colLabelText}>A</Text>
              <Text style={styles.colLabelText}>B</Text>
            </View>
            <View style={styles.aisleGap} />
            <View style={styles.colGroup}>
              <Text style={styles.colLabelText}>C</Text>
              <Text style={styles.colLabelText}>D</Text>
            </View>
          </View>

          {/* Bus front */}
          <View style={styles.busFront}>
            <View style={styles.steeringWrap}>
              <Feather name="circle" size={22} color={G} />
              <Feather name="navigation" size={12} color={G} style={StyleSheet.absoluteFill as any} />
            </View>
            <Text style={styles.busFrontText}>Conducteur</Text>
          </View>
          <View style={styles.busDivider} />

          {/* Seat rows */}
          {rows.map(row => {
            const rowSeats = seats.filter(s => s.row === row).sort((a, b) => a.column - b.column);
            const left     = rowSeats.filter(s => s.column <= 2);
            const right    = rowSeats.filter(s => s.column > 2);
            return (
              <View key={row} style={styles.seatRow}>
                <Text style={styles.rowLabel}>{row}</Text>
                <View style={styles.seatGroup}>{left.map(renderSeat)}</View>
                <View style={styles.aisle}>
                  <Text style={styles.aisleText}>│</Text>
                </View>
                <View style={styles.seatGroup}>{right.map(renderSeat)}</View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Compteurs ─────────────────────────────── */}
      {!loading && seats.length > 0 && (
        <View style={styles.counters}>
          {[
            { label: "Libres",   count: cntAvail, color: "#059669", bg: "#F0FDF4", border: "#BBF7D0" },
            { label: "Réservés", count: cntResvd, color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
            { label: "Vendus",   count: cntOccup, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
          ].map(b => (
            <View key={b.label} style={[styles.counterBox, { backgroundColor: b.bg, borderColor: b.border }]}>
              <Text style={[styles.counterNum, { color: b.color }]}>{b.count}</Text>
              <Text style={styles.counterLabel}>{b.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ══════════ Panneau de réservation rapide ══════════
          S'affiche en slide-up quand un siège est sélectionné  */}
      {selected && (
        <Animated.View
          style={[
            styles.panel,
            { transform: [{ translateY: panelTranslateY }], paddingBottom: bottomPad + 12 },
          ]}
        >
          {/* Handle + titre */}
          <View style={styles.panelHandle} />

          <View style={styles.panelHeaderRow}>
            {/* Badge siège sélectionné */}
            <View style={[
              styles.seatBadge,
              { backgroundColor: getSeatColor(selected.status).bg, borderColor: getSeatColor(selected.status).border },
            ]}>
              <Feather name={ICON_MAP[selected.status]} size={14} color={getSeatColor(selected.status).text} />
              <Text style={[styles.seatBadgeNum, { color: getSeatColor(selected.status).text }]}>
                {selected.number}
              </Text>
              <Text style={[styles.seatBadgeStatus, { color: getSeatColor(selected.status).text }]}>
                {STATUS_LABEL[selected.status]}
              </Text>
            </View>

            <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
              <Feather name="x" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* ── Si siège déjà occupé : afficher infos passager ── */}
          {selected.status !== "available" ? (
            <View style={styles.occupiedInfo}>
              <View style={styles.infoRow}>
                <Feather name="user" size={15} color="#6B7280" />
                <Text style={styles.infoText}>{selected.clientName ?? "—"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Feather name="phone" size={15} color="#6B7280" />
                <Text style={styles.infoText}>{selected.clientPhone ?? "—"}</Text>
              </View>
              {selected.bookingRef && (
                <View style={styles.infoRow}>
                  <Feather name="hash" size={15} color="#6B7280" />
                  <Text style={styles.infoText}>{selected.bookingRef}</Text>
                </View>
              )}
            </View>
          ) : (
            /* ── Formulaire vente rapide ── */
            <View style={{ gap: 10, marginTop: 4 }}>

              {/* Tabs action */}
              <View style={styles.actionTabs}>
                {(["vendre", "réserver", "sp"] as const).map(type => {
                  const active = actionType === type;
                  const tabColor = type === "sp" ? "#7C3AED" : G;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setActionType(type)}
                      style={[styles.actionTab, active && { backgroundColor: tabColor, borderColor: tabColor }]}
                    >
                      <Feather
                        name={type === "vendre" ? "tag" : type === "réserver" ? "clock" : "shield"}
                        size={12}
                        color={active ? "#fff" : "#6B7280"}
                      />
                      <Text style={[styles.actionTabText, active && { color: "#fff" }]}>
                        {type === "vendre" ? "Vendre" : type === "réserver" ? "Réserver" : "SP"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Nom */}
              <View style={styles.fieldRow}>
                <Feather name="user" size={15} color="#9CA3AF" style={{ marginTop: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Nom complet *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: Koné Mamadou"
                    value={paxName}
                    onChangeText={setPaxName}
                    autoCapitalize="words"
                    placeholderTextColor="#D1D5DB"
                  />
                </View>
              </View>

              {/* Téléphone */}
              {actionType !== "sp" && (
                <View style={styles.fieldRow}>
                  <Feather name="phone" size={15} color="#9CA3AF" style={{ marginTop: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Téléphone</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="+225 07 XX XX XX XX"
                      value={paxPhone}
                      onChangeText={setPaxPhone}
                      keyboardType="phone-pad"
                      placeholderTextColor="#D1D5DB"
                    />
                  </View>
                </View>
              )}

              {/* Mode paiement */}
              {actionType !== "sp" && (
                <View>
                  <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Mode de paiement *</Text>
                  <View style={styles.payRow}>
                    {PAY_METHODS.map(pm => {
                      const active = payMethod === pm.id;
                      return (
                        <TouchableOpacity
                          key={pm.id}
                          onPress={() => setPayMethod(pm.id)}
                          style={[styles.payBtn, active && styles.payBtnActive]}
                        >
                          <Feather name={pm.icon} size={13} color={active ? "#fff" : "#6B7280"} />
                          <Text style={[styles.payBtnText, active && { color: "#fff" }]}>{pm.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Bouton valider */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  actionType === "sp" && { backgroundColor: "#7C3AED" },
                  submitting && { opacity: 0.6 },
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Feather
                      name={actionType === "sp" ? "shield" : actionType === "réserver" ? "clock" : "check-circle"}
                      size={17}
                      color="white"
                    />
                    <Text style={styles.submitBtnText}>
                      {actionType === "vendre"   ? "Valider la vente"        :
                       actionType === "réserver" ? "Confirmer la réservation" :
                                                   "Créer billet SP"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════════ */
const SEAT_SIZE = 48;
const GAP       = 8;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center:    { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },

  /* Retry */
  retryBtn:  { marginTop: 4, backgroundColor: G, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptyText: { fontSize: 15, color: "#9CA3AF", fontWeight: "500" },
  loadingText: { fontSize: 14, color: "#9CA3AF" },

  /* Header */
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18, gap: 12,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "white" },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  /* Legend */
  legend: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    flexWrap: "wrap", gap: 14, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendBox:  {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    justifyContent: "center", alignItems: "center",
  },
  legendText: { fontSize: 11, color: "#374151", fontWeight: "600" },

  /* Scroll */
  scrollContent: { alignItems: "center", paddingTop: 20, paddingHorizontal: 20, paddingBottom: 32 },

  /* Column headers */
  colHeader:      { flexDirection: "row", alignItems: "center", marginBottom: 8, width: "100%", maxWidth: 300 },
  rowLabelSpace:  { width: 26 },
  colGroup:       { flexDirection: "row", gap: GAP },
  colLabelText:   { width: SEAT_SIZE, textAlign: "center", fontSize: 13, fontWeight: "800", color: G },
  aisleGap:       { width: 30 },

  /* Bus front */
  busFront: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 11, paddingHorizontal: 20,
    backgroundColor: G_LIGHT, borderRadius: 14, marginBottom: 6,
    width: "100%", maxWidth: 300,
    borderWidth: 1, borderColor: "#86EFAC",
  },
  steeringWrap:  { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  busFrontText:  { fontSize: 13, fontWeight: "700", color: G_DARK },
  busDivider:    {
    width: "100%", maxWidth: 300, height: 2,
    backgroundColor: "#CBD5E1", borderRadius: 1, marginBottom: 12,
    borderStyle: "dashed",
  },

  /* Seat rows */
  seatRow:   { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10, width: "100%", maxWidth: 300 },
  rowLabel:  { width: 22, fontSize: 11, fontWeight: "700", color: "#9CA3AF", textAlign: "center" },
  seatGroup: { flexDirection: "row", gap: GAP },
  aisle:     { width: 30, alignItems: "center", justifyContent: "center" },
  aisleText: { fontSize: 18, color: "#CBD5E1", lineHeight: 18 },

  /* Seat */
  seat: {
    width: SEAT_SIZE, height: SEAT_SIZE, borderRadius: 12, borderWidth: 2,
    justifyContent: "center", alignItems: "center", gap: 2,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  seatSelectedRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: G_DARK,
  },
  seatNum:      { fontSize: 11, fontWeight: "700", lineHeight: 13 },
  seatInitials: { fontSize: 8, fontWeight: "700", opacity: 0.85, lineHeight: 10 },

  /* Counters */
  counters: {
    flexDirection: "row", backgroundColor: "white",
    borderTopWidth: 1, borderTopColor: "#E2E8F0",
    paddingVertical: 10, paddingHorizontal: 16, gap: 10,
  },
  counterBox:   {
    flex: 1, alignItems: "center", borderRadius: 10,
    paddingVertical: 8, borderWidth: 1,
  },
  counterNum:   { fontSize: 22, fontWeight: "800", lineHeight: 26 },
  counterLabel: { fontSize: 10, color: "#6B7280", fontWeight: "500", marginTop: 1 },

  /* Booking panel */
  panel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
    gap: 0,
    maxHeight: 480,
  },
  panelHandle: {
    width: 40, height: 4, backgroundColor: "#D1D5DB",
    borderRadius: 2, alignSelf: "center", marginBottom: 14,
  },
  panelHeaderRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 14,
  },
  seatBadge: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1.5,
  },
  seatBadgeNum:    { fontSize: 18, fontWeight: "800" },
  seatBadgeStatus: { fontSize: 12, fontWeight: "600" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
  },

  /* Occupied info */
  occupiedInfo: { gap: 12, paddingTop: 4, paddingBottom: 8 },
  infoRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 15, color: "#374151", fontWeight: "500" },

  /* Action tabs */
  actionTabs: { flexDirection: "row", gap: 8 },
  actionTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  actionTabText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },

  /* Form */
  fieldRow:   { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: "#6B7280", marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: "#111827", backgroundColor: "#FAFAFA",
  },

  /* Payment methods */
  payRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  payBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  payBtnActive:  { backgroundColor: G, borderColor: G_DARK },
  payBtnText:    { fontSize: 12, fontWeight: "600", color: "#6B7280" },

  /* Submit */
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: G, borderRadius: 14,
    paddingVertical: 14, marginTop: 4,
    shadowColor: G, shadowOpacity: 0.30, shadowRadius: 8, elevation: 4,
  },
  submitBtnText: { fontSize: 14, fontWeight: "700", color: "white" },
});
