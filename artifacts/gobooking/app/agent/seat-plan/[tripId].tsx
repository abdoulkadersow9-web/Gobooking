import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
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

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";
import { getSeatColor, SEAT_LEGEND } from "@/utils/seatColors";

const G = "#16A34A";

interface AgentSeat {
  id: string;
  number: string;
  row: number;
  column: number;
  status: "available" | "reserved" | "occupied" | "sp";
  clientName?: string | null;
  clientPhone?: string | null;
  bookingRef?: string | null;
  paymentMethod?: string | null;
}

const ICON_MAP: Record<string, any> = {
  available: "check",
  reserved:  "clock",
  occupied:  "x",
  sp:        "shield",
};

export default function AgentSeatPlanScreen() {
  const { tripId, from, to, date, time, busType } = useLocalSearchParams<{
    tripId: string; from?: string; to?: string;
    date?: string;  time?: string; busType?: string;
  }>();
  const { token } = useAuth();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 0 : insets.top;

  const [seats, setSeats]         = useState<AgentSeat[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* action modal */
  const [clicked, setClicked]     = useState<AgentSeat | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<"vendre" | "réserver" | "sp">("vendre");
  const [paxName, setPaxName]     = useState("");
  const [paxPhone, setPaxPhone]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* pop animation on seat tap */
  const popAnim = useRef(new Animated.Value(0)).current;
  const [lastTapped, setLastTapped] = useState<string | null>(null);

  const loadSeats = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else        setRefreshing(true);
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

  /* auto-refresh every 15 s */
  useEffect(() => {
    const interval = setInterval(() => loadSeats(true), 15_000);
    return () => clearInterval(interval);
  }, [loadSeats]);

  const openSeat = (seat: AgentSeat) => {
    setClicked(seat);
    setLastTapped(seat.id);
    Animated.sequence([
      Animated.spring(popAnim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 12 }),
      Animated.delay(600),
      Animated.spring(popAnim, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 0 }),
    ]).start();
    if (seat.status !== "available") {
      setPaxName(seat.clientName ?? "");
      setPaxPhone(seat.clientPhone ?? "");
    } else {
      setPaxName(""); setPaxPhone(""); setActionType("vendre");
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!clicked) return;
    if (clicked.status !== "available") { setShowModal(false); return; }
    if (!paxName.trim()) { Alert.alert("Champ requis", "Saisissez le nom du passager."); return; }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ bookingRef?: string; id?: string }>("/agent/reservations", {
        token: token ?? undefined,
        method: "POST",
        body: {
          tripId,
          clientName:          paxName.trim(),
          clientPhone:         paxPhone.trim(),
          seatCount:           1,
          paymentMethod:       actionType === "sp" ? "sp" : "cash",
          isSP:                actionType === "sp",
          isReservation:       actionType === "réserver",
          preferredSeatNumber: clicked.number,
        },
      });
      setShowModal(false);
      const label = actionType === "sp" ? "SP créé" : actionType === "réserver" ? "Réservé" : "Vendu";
      Alert.alert("✓ Succès", `Siège ${clicked.number} — ${label}\nRéf: ${res.bookingRef ?? res.id}`);
      loadSeats(true);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de traiter la demande");
    } finally { setSubmitting(false); }
  };

  /* derived */
  const rows      = Array.from(new Set(seats.map(s => s.row))).sort((a, b) => a - b);
  const cntAvail  = seats.filter(s => s.status === "available").length;
  const cntResvd  = seats.filter(s => s.status === "reserved").length;
  const cntOccup  = seats.filter(s => s.status === "occupied" || s.status === "sp").length;
  const tappedSeat = seats.find(s => s.id === lastTapped);

  const renderSeat = (seat: AgentSeat) => {
    const c    = getSeatColor(seat.status);
    const icon = ICON_MAP[seat.status] ?? "help-circle";
    const initials = seat.clientName
      ? seat.clientName.trim().split(/\s+/).map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase()
      : null;
    const isLast = seat.id === lastTapped;
    return (
      <Pressable
        key={seat.id}
        onPress={() => openSeat(seat)}
        style={({ pressed }) => [
          styles.seat,
          { backgroundColor: c.bg, borderColor: c.border },
          pressed && { transform: [{ scale: 0.91 }] },
          isLast && { transform: [{ scale: 1.04 }] },
        ]}
      >
        <Feather name={icon} size={11} color={c.text} />
        <Text style={[styles.seatNum, { color: c.text }]}>{seat.number}</Text>
        {initials && (
          <Text style={{ fontSize: 8, fontWeight: "700", color: c.text, opacity: 0.85, lineHeight: 10 }}>
            {initials}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>

      {/* ── Header ── */}
      <LinearGradient
        colors={["#16A34A", "#15803D"]}
        style={styles.header}
      >
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/agent/tickets" as any)} style={styles.backBtn}>
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
        <TouchableOpacity
          onPress={() => loadSeats(true)}
          style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
        >
          {refreshing
            ? <ActivityIndicator size="small" color="white" />
            : <Feather name="refresh-cw" size={16} color="white" />}
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Légende ── */}
      <View style={styles.legend}>
        {SEAT_LEGEND.map(item => {
          const c = getSeatColor(item.status);
          const icon = ICON_MAP[item.status];
          return (
            <View key={item.status} style={styles.legendItem}>
              <View style={[styles.legendSeat, { backgroundColor: c.bg, borderColor: c.border }]}>
                <Feather name={icon} size={10} color={c.text} />
              </View>
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Plan ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={G} />
          <Text style={styles.loadingText}>Chargement du plan de sièges...</Text>
        </View>
      ) : seats.length === 0 ? (
        <View style={styles.center}>
          <Feather name="grid" size={52} color="#D1D5DB" />
          <Text style={[styles.loadingText, { fontSize: 16 }]}>Aucun siège configuré</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadSeats()}>
            <Text style={styles.retryText}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Column header */}
          <View style={styles.colHeader}>
            <View style={styles.rowLabelSpace} />
            <View style={styles.colLabels}>
              <Text style={styles.colLabelText}>A</Text>
              <Text style={styles.colLabelText}>B</Text>
            </View>
            <View style={styles.aisleGap} />
            <View style={styles.colLabels}>
              <Text style={styles.colLabelText}>C</Text>
              <Text style={styles.colLabelText}>D</Text>
            </View>
          </View>

          {/* Bus front */}
          <View style={styles.busFront}>
            <View style={styles.steeringWheel}>
              <Feather name="circle" size={22} color={G} />
              <Feather name="navigation" size={12} color={G} style={StyleSheet.absoluteFill as any} />
            </View>
            <Text style={styles.busFrontText}>Conducteur</Text>
          </View>
          <View style={styles.busDivider} />

          {/* Rows */}
          {rows.map(row => {
            const rowSeats = seats.filter(s => s.row === row).sort((a, b) => a.column - b.column);
            const left  = rowSeats.filter(s => s.column <= 2);
            const right = rowSeats.filter(s => s.column > 2);
            return (
              <View key={row} style={styles.seatRow}>
                <Text style={styles.rowLabel}>{row}</Text>
                <View style={styles.seatPair}>{left.map(renderSeat)}</View>
                <View style={styles.aisle}>
                  <Text style={styles.aisleText}>│</Text>
                </View>
                <View style={styles.seatPair}>{right.map(renderSeat)}</View>
              </View>
            );
          })}

          {/* Tap tooltip */}
          {tappedSeat && (
            <Animated.View
              style={[
                styles.tooltip,
                {
                  opacity: popAnim,
                  transform: [{ scale: popAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
                },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.tooltipStatus}>
                {tappedSeat.status === "available" ? "Siège libre" :
                 tappedSeat.status === "reserved"  ? "Réservé"    :
                 tappedSeat.status === "sp"         ? "SP"         : "Vendu"}
              </Text>
              <Text style={styles.tooltipSeat}>{tappedSeat.number}</Text>
              {tappedSeat.clientName && (
                <Text style={styles.tooltipName}>{tappedSeat.clientName}</Text>
              )}
            </Animated.View>
          )}
        </ScrollView>
      )}

      {/* ── Compteurs ── */}
      {!loading && seats.length > 0 && (
        <View style={styles.counters}>
          {[
            { label: "Libres",   count: cntAvail, color: "#059669", bg: "#F0FDF4" },
            { label: "Réservés", count: cntResvd, color: "#D97706", bg: "#FFFBEB" },
            { label: "Vendus",   count: cntOccup, color: "#DC2626", bg: "#FEF2F2" },
          ].map(b => (
            <View key={b.label} style={[styles.counterBox, { backgroundColor: b.bg }]}>
              <Text style={[styles.counterNum, { color: b.color }]}>{b.count}</Text>
              <Text style={styles.counterLabel}>{b.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ══════════ Modal action siège ══════════ */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)} />
        <View style={styles.sheet}>
          {clicked && clicked.status !== "available" ? (
            /* ── Vue passager ── */
            <>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Passager — {clicked.number}</Text>

              <View style={{ gap: 12, marginTop: 4 }}>
                <View style={styles.infoRow}>
                  <Feather name="user" size={16} color="#6B7280" />
                  <Text style={styles.infoText}>{clicked.clientName ?? "—"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Feather name="phone" size={16} color="#6B7280" />
                  <Text style={styles.infoText}>{clicked.clientPhone ?? "—"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Feather name="hash" size={16} color="#6B7280" />
                  <Text style={styles.infoText}>{clicked.bookingRef ?? "—"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Feather name="credit-card" size={16} color="#6B7280" />
                  <Text style={styles.infoText}>
                    {clicked.paymentMethod === "sp"   ? "SP (service)"     :
                     clicked.paymentMethod === "cash" ? "Espèces"          :
                     clicked.paymentMethod === "wave" ? "Wave"             :
                     clicked.paymentMethod ?? "—"}
                  </Text>
                </View>
                <View style={[styles.infoRow, { marginTop: 4 }]}>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getSeatColor(clicked.status).bg, borderColor: getSeatColor(clicked.status).border },
                  ]}>
                    <Text style={[styles.statusBadgeText, { color: getSeatColor(clicked.status).text }]}>
                      {clicked.status === "reserved" ? "RÉSERVÉ" :
                       clicked.status === "sp"       ? "SP"      : "VENDU"}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#F3F4F6", marginTop: 20 }]} onPress={() => setShowModal(false)}>
                <Text style={[styles.actionBtnText, { color: "#374151" }]}>Fermer</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* ── Formulaire vente ── */
            <>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Siège {clicked?.number}</Text>

              {/* Type d'action */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {(["vendre", "réserver", "sp"] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeBtn, actionType === type && styles.typeBtnActive]}
                    onPress={() => setActionType(type)}
                  >
                    <Text style={[styles.typeBtnText, actionType === type && styles.typeBtnTextActive]}>
                      {type === "vendre" ? "Vendre" : type === "réserver" ? "Réserver" : "SP"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Nom complet *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Koné Mamadou"
                value={paxName}
                onChangeText={setPaxName}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Téléphone</Text>
              <TextInput
                style={styles.input}
                placeholder="+225 07 XX XX XX XX"
                value={paxPhone}
                onChangeText={setPaxPhone}
                keyboardType="phone-pad"
              />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 1, backgroundColor: "#F3F4F6" }]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={[styles.actionBtnText, { color: "#374151" }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { flex: 2, backgroundColor: G }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={styles.actionBtnText}>
                        {actionType === "vendre" ? "Confirmer la vente" :
                         actionType === "réserver" ? "Confirmer la réservation" : "Créer SP"}
                      </Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center:    { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingText: { fontSize: 14, color: "#9CA3AF" },

  retryBtn: {
    marginTop: 4, backgroundColor: G, paddingHorizontal: 28,
    paddingVertical: 12, borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  /* Header */
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingTop: 14, paddingBottom: 18, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "white" },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.78)", marginTop: 2 },

  /* Legend */
  legend: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 12, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSeat: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  legendText: { fontSize: 10, color: "#6B7280", fontWeight: "500" },

  /* Scroll */
  scrollContent: { alignItems: "center", paddingTop: 18, paddingHorizontal: 20, paddingBottom: 30 },

  /* Column header */
  colHeader:     { flexDirection: "row", alignItems: "center", marginBottom: 6, width: "100%", maxWidth: 280 },
  rowLabelSpace: { width: 24 },
  colLabels:     { flexDirection: "row", gap: 8 },
  colLabelText:  { width: 44, textAlign: "center", fontSize: 12, fontWeight: "800", color: G },
  aisleGap:      { width: 28 },

  /* Bus front */
  busFront: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 10, paddingHorizontal: 20,
    backgroundColor: "#DCFCE7", borderRadius: 12, marginBottom: 4,
    width: "100%", maxWidth: 280,
  },
  steeringWheel: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  busFrontText:  { fontSize: 13, fontWeight: "600", color: G },
  busDivider:    {
    width: "100%", maxWidth: 280, height: 2,
    backgroundColor: "#CBD5E1", borderRadius: 1, marginBottom: 10,
  },

  /* Seat row */
  seatRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8, width: "100%", maxWidth: 280 },
  rowLabel: { width: 20, fontSize: 11, fontWeight: "600", color: "#9CA3AF", textAlign: "center" },
  seatPair: { flexDirection: "row", gap: 8 },
  aisle:    { width: 28, alignItems: "center", justifyContent: "center" },
  aisleText:{ fontSize: 18, color: "#CBD5E1", lineHeight: 18 },

  /* Seat */
  seat: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1.5,
    justifyContent: "center", alignItems: "center", gap: 1,
  },
  seatNum: { fontSize: 10, fontWeight: "700", lineHeight: 12 },

  /* Tooltip */
  tooltip: {
    position: "absolute", alignSelf: "center", top: "42%",
    backgroundColor: "white", borderRadius: 16,
    paddingHorizontal: 28, paddingVertical: 18, alignItems: "center",
    shadowColor: "#16A34A", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
    borderWidth: 1.5, borderColor: "#DCFCE7", zIndex: 100,
  },
  tooltipStatus: { fontSize: 11, color: "#6B7280", marginBottom: 2 },
  tooltipSeat:   { fontSize: 30, fontWeight: "800", color: G, lineHeight: 34 },
  tooltipName:   { fontSize: 12, color: "#374151", marginTop: 2 },

  /* Counters */
  counters: {
    flexDirection: "row", backgroundColor: "white",
    borderTopWidth: 1, borderTopColor: "#E2E8F0",
    paddingVertical: 12, paddingHorizontal: 20, gap: 12,
  },
  counterBox:   { flex: 1, alignItems: "center", borderRadius: 10, paddingVertical: 8 },
  counterNum:   { fontSize: 22, fontWeight: "800", lineHeight: 26 },
  counterLabel: { fontSize: 10, color: "#6B7280", marginTop: 1 },

  /* Bottom sheet */
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: "white", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 36, gap: 0,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: "#D1D5DB",
    borderRadius: 2, alignSelf: "center", marginBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 16 },

  /* Info rows */
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 15, color: "#374151", fontWeight: "500" },
  statusBadge: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1.5,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },

  /* Form */
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#6B7280", marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: "#111827",
    backgroundColor: "#FAFAFA",
  },

  /* Action type tabs */
  typeBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5,
    borderColor: "#E5E7EB", alignItems: "center",
  },
  typeBtnActive: { backgroundColor: G, borderColor: G },
  typeBtnText:   { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  typeBtnTextActive: { color: "white" },

  /* Submit */
  actionBtn: {
    paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
  },
  actionBtnText: { fontSize: 14, fontWeight: "700", color: "white" },
});
