import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/utils/api";

/* ─── Colors ─────────────────────────────────────────────────────── */
const PRIMARY    = "#0B3C5D";
const ACCENT     = "#FF6B00";

/* ─── Status config ─────────────────────────────────────────────── */
interface StatusCfg { label: string; icon: string; color: string; bg: string; desc: string }

const STATUS_MAP: Record<string, StatusCfg> = {
  créé:        { label: "Créé",            icon: "plus-circle",  color: "#6366F1", bg: "#EEF2FF", desc: "Colis enregistré dans le système" },
  en_attente:  { label: "En attente",      icon: "clock",        color: "#6366F1", bg: "#EEF2FF", desc: "En attente de prise en charge" },
  en_gare:     { label: "En gare",         icon: "home",         color: "#0284C7", bg: "#E0F2FE", desc: "Colis reçu en agence de départ" },
  chargé_bus:  { label: "Chargé bus",      icon: "truck",        color: "#7C3AED", bg: "#F5F3FF", desc: "Colis chargé dans le bus" },
  en_transit:  { label: "En transit",      icon: "navigation",   color: "#D97706", bg: "#FFFBEB", desc: "Colis en route vers la destination" },
  arrivé:      { label: "Arrivé",          icon: "check-circle", color: "#059669", bg: "#ECFDF5", desc: "Colis arrivé à l'agence de destination" },
  livré:       { label: "Livré",           icon: "package",      color: "#16A34A", bg: "#F0FDF4", desc: "Colis livré au destinataire" },
  annulé:      { label: "Annulé",          icon: "x-circle",     color: "#DC2626", bg: "#FEF2F2", desc: "Colis annulé" },
};

const TIMELINE_ORDER = ["créé", "en_attente", "en_gare", "chargé_bus", "en_transit", "arrivé", "livré"];

function getStatusCfg(status: string): StatusCfg {
  return STATUS_MAP[status] ?? { label: status, icon: "activity", color: "#6b7280", bg: "#F3F4F6", desc: "" };
}
function getStepIndex(status: string): number {
  return TIMELINE_ORDER.indexOf(status);
}

/* ─── Types ─────────────────────────────────────────────────────── */
interface ColisEvent {
  id: string;
  action: string;
  agentName: string | null;
  notes: string | null;
  createdAt: string;
}

interface ParcelData {
  id: string;
  trackingRef: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  fromCity: string;
  toCity: string;
  status: string;
  location: string | null;
  weight: number;
  amount: number;
  createdAt: string;
  events: ColisEvent[];
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}
function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

/* ═══════════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════════ */
export default function ColisSuivi() {
  const insets   = useLocalSearchParams<{ ref?: string }>();
  const params   = useLocalSearchParams<{ ref?: string }>();
  const safeArea = useSafeAreaInsets();

  const [query, setQuery]       = useState(params.ref ?? "");
  const [loading, setLoading]   = useState(false);
  const [parcel, setParcel]     = useState<ParcelData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searched, setSearched] = useState(false);

  const inputRef  = useRef<TextInput>(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  /* Auto-search if ref passed as param */
  useEffect(() => {
    if (params.ref) handleSearch(params.ref);
  }, []);

  const animateIn = () => {
    fadeAnim.setValue(0); slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
    ]).start();
  };

  const handleSearch = async (overrideRef?: string) => {
    const ref = (overrideRef ?? query).trim().toUpperCase();
    if (!ref) return;
    Keyboard.dismiss();
    setLoading(true);
    setParcel(null);
    setNotFound(false);
    setSearched(true);

    try {
      const data = await apiFetch<ParcelData>(`/parcels/track/${ref}`);
      setParcel(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      animateIn();
    } catch {
      setNotFound(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  /* ── Current status info ── */
  const cfg          = parcel ? getStatusCfg(parcel.status) : null;
  const currentStep  = parcel ? getStepIndex(parcel.status) : -1;
  const isCancelled  = parcel?.status === "annulé";

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[S.root, { paddingTop: safeArea.top }]}>

        {/* ── Header ── */}
        <View style={S.header}>
          <Pressable style={S.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
            <Feather name="arrow-left" size={20} color="white" />
          </Pressable>
          <View style={S.headerText}>
            <Text style={S.headerTitle}>Suivi de colis</Text>
            <Text style={S.headerSub}>Localisation en temps réel</Text>
          </View>
          <View style={S.headerIcon}>
            <Feather name="package" size={20} color="rgba(255,255,255,0.8)" />
          </View>
        </View>

        {/* ── Search bar ── */}
        <View style={S.searchSection}>
          <View style={[S.searchBox, parcel && { borderColor: cfg?.color ?? PRIMARY }]}>
            <Feather name="search" size={16} color={parcel ? (cfg?.color ?? PRIMARY) : "#94a3b8"} />
            <TextInput
              ref={inputRef}
              style={S.searchInput}
              placeholder="GBX-XXXX-XXXX"
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={t => setQuery(t.toUpperCase())}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={() => handleSearch()}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(""); setParcel(null); setNotFound(false); setSearched(false); }}>
                <Feather name="x" size={15} color="#94a3b8" />
              </Pressable>
            )}
          </View>
          <Pressable
            style={[S.searchBtn, (!query.trim() || loading) && S.searchBtnDisabled]}
            onPress={() => handleSearch()}
            disabled={!query.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color="white" size="small" />
              : <><Feather name="map-pin" size={15} color="white" /><Text style={S.searchBtnTxt}>Suivre</Text></>
            }
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[S.scroll, { paddingBottom: safeArea.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Idle ── */}
          {!searched && !loading && (
            <View style={S.idle}>
              <View style={S.idleIcon}>
                <Feather name="package" size={44} color={PRIMARY} />
              </View>
              <Text style={S.idleTitle}>Où est mon colis ?</Text>
              <Text style={S.idleDesc}>
                Saisissez votre numéro de suivi pour voir en temps réel le statut et la localisation de votre colis.
              </Text>
              <View style={S.formatBox}>
                <Text style={S.formatLabel}>Format du numéro</Text>
                <Text style={S.formatRef}>GBX-XXXX-XXXX</Text>
              </View>
            </View>
          )}

          {/* ── Loading ── */}
          {loading && (
            <View style={S.center}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={S.loadingTxt}>Localisation en cours…</Text>
            </View>
          )}

          {/* ── Not found ── */}
          {notFound && !loading && (
            <View style={S.notFound}>
              <View style={S.notFoundIcon}>
                <Feather name="alert-circle" size={40} color="#EF4444" />
              </View>
              <Text style={S.notFoundTitle}>Colis introuvable</Text>
              <Text style={S.notFoundDesc}>
                Aucun colis ne correspond au numéro{" "}
                <Text style={{ fontFamily: "Inter_700Bold" }}>{query}</Text>
                {"\n"}Vérifiez et réessayez.
              </Text>
              <Pressable
                style={S.retryBtn}
                onPress={() => { setQuery(""); setNotFound(false); setSearched(false); inputRef.current?.focus(); }}
              >
                <Feather name="refresh-cw" size={14} color={PRIMARY} />
                <Text style={S.retryBtnTxt}>Réessayer</Text>
              </Pressable>
            </View>
          )}

          {/* ── Result ── */}
          {parcel && !loading && cfg && (
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

              {/* ── Status hero card ── */}
              <View style={[S.heroCard, { borderTopColor: cfg.color, borderTopWidth: 4 }]}>
                <View style={S.heroTop}>
                  <View style={[S.heroIconWrap, { backgroundColor: cfg.bg }]}>
                    <Feather name={cfg.icon as any} size={28} color={cfg.color} />
                  </View>
                  <View style={S.heroInfo}>
                    <Text style={S.heroRef}>{parcel.trackingRef}</Text>
                    <View style={[S.statusPill, { backgroundColor: cfg.bg }]}>
                      <View style={[S.statusDot, { backgroundColor: cfg.color }]} />
                      <Text style={[S.statusPillTxt, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={S.heroDesc}>{cfg.desc}</Text>
                  </View>
                </View>

                {/* Location pill */}
                {parcel.location && (
                  <View style={[S.locationPill, { backgroundColor: cfg.bg, borderColor: cfg.color + "40" }]}>
                    <Feather name="map-pin" size={14} color={cfg.color} />
                    <Text style={[S.locationTxt, { color: cfg.color }]}>{parcel.location}</Text>
                  </View>
                )}
              </View>

              {/* ── Route ── */}
              <View style={S.routeCard}>
                <View style={S.routeSide}>
                  <View style={[S.routeDot, { backgroundColor: PRIMARY }]} />
                  <View>
                    <Text style={S.routeCity}>{parcel.fromCity}</Text>
                    <Text style={S.routeLabel}>Départ</Text>
                  </View>
                </View>
                <View style={S.routeMid}>
                  <View style={S.routeLine} />
                  <View style={S.routePackage}>
                    <Feather name="package" size={14} color={PRIMARY} />
                  </View>
                  <View style={S.routeLine} />
                </View>
                <View style={[S.routeSide, { alignItems: "flex-end" }]}>
                  <View>
                    <Text style={[S.routeCity, { textAlign: "right" }]}>{parcel.toCity}</Text>
                    <Text style={[S.routeLabel, { textAlign: "right" }]}>Destination</Text>
                  </View>
                  <View style={[S.routeDot, { backgroundColor: "#EF4444" }]} />
                </View>
              </View>

              {/* ── People & details ── */}
              <View style={S.infoCard}>
                <View style={S.infoRow}>
                  <View style={[S.infoIcon, { backgroundColor: "#EEF2FF" }]}>
                    <Feather name="user" size={14} color={PRIMARY} />
                  </View>
                  <View style={S.infoText}>
                    <Text style={S.infoLabel}>Expéditeur</Text>
                    <Text style={S.infoValue}>{parcel.senderName}</Text>
                  </View>
                  <View style={[S.infoIcon, { backgroundColor: "#ECFDF5" }]}>
                    <Feather name="user-check" size={14} color="#059669" />
                  </View>
                  <View style={S.infoText}>
                    <Text style={S.infoLabel}>Destinataire</Text>
                    <Text style={S.infoValue}>{parcel.receiverName}</Text>
                  </View>
                </View>
                <View style={S.infoDivider} />
                <View style={S.infoRow}>
                  <Feather name="shopping-bag" size={13} color="#94a3b8" />
                  <Text style={S.infoDetail}>{parcel.weight} kg</Text>
                  <Text style={S.infoBullet}>·</Text>
                  <Feather name="credit-card" size={13} color="#94a3b8" />
                  <Text style={S.infoDetail}>{parcel.amount.toLocaleString()} FCFA</Text>
                  <Text style={S.infoBullet}>·</Text>
                  <Feather name="calendar" size={13} color="#94a3b8" />
                  <Text style={S.infoDetail}>{fmtDate(parcel.createdAt)}</Text>
                </View>
              </View>

              {/* ── Progress timeline (static steps) ── */}
              {!isCancelled && (
                <View style={S.progressCard}>
                  <Text style={S.sectionTitle}>Progression</Text>
                  {TIMELINE_ORDER.filter(s => s !== "en_attente").map((s, idx, arr) => {
                    const stepCfg = getStatusCfg(s);
                    const stepIdx = getStepIndex(s);
                    const done    = currentStep >= stepIdx;
                    const current = currentStep === stepIdx;
                    const isLast  = idx === arr.length - 1;
                    return (
                      <View key={s} style={S.progressRow}>
                        <View style={S.progressLeft}>
                          <View style={[
                            S.progressDot,
                            done ? { backgroundColor: stepCfg.color } : S.progressDotPending,
                            current && S.progressDotCurrent,
                          ]}>
                            <Feather
                              name={(done ? (current ? stepCfg.icon : "check") : "circle") as any}
                              size={current ? 13 : 11}
                              color={done ? "white" : "#d1d5db"}
                            />
                          </View>
                          {!isLast && <View style={[S.progressLine, done && { backgroundColor: stepCfg.color + "60" }]} />}
                        </View>
                        <View style={[S.progressContent, !isLast && { paddingBottom: 18 }]}>
                          <Text style={[
                            S.progressLabel,
                            done && { color: stepCfg.color, fontFamily: "Inter_600SemiBold" },
                            current && { fontFamily: "Inter_700Bold" },
                          ]}>
                            {stepCfg.label}
                          </Text>
                          <Text style={S.progressDesc}>{stepCfg.desc}</Text>
                          {current && (
                            <View style={[S.currentBadge, { backgroundColor: stepCfg.bg }]}>
                              <View style={[S.currentDot, { backgroundColor: stepCfg.color }]} />
                              <Text style={[S.currentTxt, { color: stepCfg.color }]}>Statut actuel</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* ── Real event history ── */}
              {parcel.events.length > 0 && (
                <View style={S.eventsCard}>
                  <Text style={S.sectionTitle}>Historique des événements</Text>
                  {parcel.events.map((ev, idx) => {
                    const evCfg = getStatusCfg(ev.action);
                    const isLast = idx === parcel.events.length - 1;
                    return (
                      <View key={ev.id} style={S.eventRow}>
                        <View style={S.eventLeft}>
                          <View style={[S.eventDot, { backgroundColor: evCfg.color }]}>
                            <Feather name={evCfg.icon as any} size={10} color="white" />
                          </View>
                          {!isLast && <View style={[S.eventLine, { backgroundColor: evCfg.color + "30" }]} />}
                        </View>
                        <View style={[S.eventContent, { marginBottom: isLast ? 0 : 12 }]}>
                          <View style={S.eventTop}>
                            <View style={[S.eventBadge, { backgroundColor: evCfg.bg }]}>
                              <Text style={[S.eventBadgeTxt, { color: evCfg.color }]}>{evCfg.label}</Text>
                            </View>
                            <Text style={S.eventTime}>{fmtDate(ev.createdAt)} {fmtTime(ev.createdAt)}</Text>
                          </View>
                          {ev.notes && (
                            <View style={S.eventLocation}>
                              <Feather name="map-pin" size={11} color="#94a3b8" />
                              <Text style={S.eventLocationTxt}>{ev.notes}</Text>
                            </View>
                          )}
                          {ev.agentName && (
                            <Text style={S.eventAgent}>Agent : {ev.agentName}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* ── Cancelled ── */}
              {isCancelled && (
                <View style={S.cancelCard}>
                  <Feather name="x-circle" size={28} color="#DC2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={S.cancelTitle}>Colis annulé</Text>
                    <Text style={S.cancelDesc}>Contactez l'agence pour plus d'informations.</Text>
                  </View>
                </View>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const S = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#F1F5F9" },
  scroll:  { padding: 16, gap: 0 },
  center:  { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 12 },

  /* Header */
  header: {
    backgroundColor: PRIMARY, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  headerText:  { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "white" },
  headerSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  headerIcon:  { width: 38, height: 38, justifyContent: "center", alignItems: "center" },

  /* Search */
  searchSection: {
    flexDirection: "row", gap: 10, backgroundColor: "white",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E2E8F0",
    shadowColor: "#000", shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0",
    paddingHorizontal: 12, height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", letterSpacing: 1 },
  searchBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 16, height: 46,
  },
  searchBtnDisabled: { backgroundColor: "#CBD5E1" },
  searchBtnTxt:      { color: "white", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  /* Idle */
  idle: { alignItems: "center", paddingVertical: 40, gap: 12 },
  idleIcon: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  idleTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY },
  idleDesc:  { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6b7280", textAlign: "center", lineHeight: 22, paddingHorizontal: 16 },
  formatBox: {
    backgroundColor: "white", borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", marginTop: 8,
  },
  formatLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
  formatRef:   { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY, letterSpacing: 2, marginTop: 4 },

  /* Loading */
  loadingTxt: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6b7280" },

  /* Not found */
  notFound: { alignItems: "center", paddingVertical: 40, gap: 12 },
  notFoundIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center",
  },
  notFoundTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#DC2626" },
  notFoundDesc:  { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6b7280", textAlign: "center", lineHeight: 22 },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  retryBtnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: PRIMARY },

  /* Hero card */
  heroCard: {
    backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  heroTop:      { flexDirection: "row", gap: 14, marginBottom: 12 },
  heroIconWrap: { width: 56, height: 56, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  heroInfo:     { flex: 1, gap: 6 },
  heroRef:      { fontSize: 18, fontFamily: "Inter_700Bold", color: PRIMARY, letterSpacing: 1 },
  statusPill:   { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20,
                  paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  statusDot:    { width: 7, height: 7, borderRadius: 3.5 },
  statusPillTxt:{ fontSize: 13, fontFamily: "Inter_600SemiBold" },
  heroDesc:     { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6b7280" },
  locationPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  locationTxt:  { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },

  /* Route */
  routeCard: {
    backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12,
    flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  routeSide:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  routeCity:    { fontSize: 16, fontFamily: "Inter_700Bold", color: PRIMARY },
  routeLabel:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  routeDot:     { width: 12, height: 12, borderRadius: 6 },
  routeMid:     { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  routeLine:    { flex: 1, height: 2, backgroundColor: "#E2E8F0" },
  routePackage: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center",
  },

  /* Info */
  infoCard: {
    backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  infoRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  infoIcon:    { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  infoText:    { flex: 1 },
  infoLabel:   { fontSize: 10, fontFamily: "Inter_500Medium", color: "#94a3b8", textTransform: "uppercase" },
  infoValue:   { fontSize: 14, fontFamily: "Inter_600SemiBold", color: PRIMARY },
  infoDivider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 10 },
  infoDetail:  { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6b7280" },
  infoBullet:  { color: "#d1d5db" },

  /* Progress */
  progressCard: {
    backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5 },
  progressRow:  { flexDirection: "row", gap: 12 },
  progressLeft: { alignItems: "center", width: 30 },
  progressDot: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: "center", alignItems: "center",
  },
  progressDotPending: { backgroundColor: "#F1F5F9", borderWidth: 2, borderColor: "#E2E8F0" },
  progressDotCurrent: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  progressLine:    { flex: 1, width: 2, backgroundColor: "#E2E8F0", marginTop: 2 },
  progressContent: { flex: 1 },
  progressLabel:   { fontSize: 14, fontFamily: "Inter_500Medium", color: "#9ca3af" },
  progressDesc:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9ca3af", marginTop: 2 },
  currentBadge:    { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8,
                     paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginTop: 6 },
  currentDot:      { width: 6, height: 6, borderRadius: 3 },
  currentTxt:      { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  /* Events */
  eventsCard: {
    backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  eventRow:      { flexDirection: "row", gap: 10 },
  eventLeft:     { alignItems: "center", width: 28 },
  eventDot:      { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  eventLine:     { flex: 1, width: 2, marginTop: 2 },
  eventContent:  { flex: 1 },
  eventTop:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  eventBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  eventBadgeTxt: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  eventTime:     { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  eventLocation: { flexDirection: "row", alignItems: "center", gap: 4 },
  eventLocationTxt: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6b7280" },
  eventAgent:    { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8", marginTop: 2 },

  /* Cancelled */
  cancelCard: {
    backgroundColor: "#FEF2F2", borderRadius: 16, padding: 16, marginBottom: 12,
    flexDirection: "row", gap: 14, alignItems: "center",
  },
  cancelTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#DC2626" },
  cancelDesc:  { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6b7280", marginTop: 2 },
});
