import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ── Payment method config ─────────────────────────────────────────────── */
const METHODS = [
  { id: "wave",   label: "Wave",          sub: "Paiement Wave CI",         color: "#1BA5E0", textColor: "white", icon: "💙" },
  { id: "orange", label: "Orange Money",  sub: "Paiement mobile Orange",   color: "#FF6B00", textColor: "white", icon: "🟠" },
  { id: "mtn",    label: "MTN MoMo",      sub: "Mobile Money MTN",          color: "#FFCB00", textColor: "#000", icon: "💛" },
];

type PayStep = "choose" | "processing" | "success" | "failed";

interface VerifyResult {
  paid: boolean;
  status: string;
  paymentStatus: string;
  bookingRef: string;
  bookingId: string;
  paymentId: string | null;
}

export default function CinetPayScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { bookingId, amount, bookingRef } = useLocalSearchParams<{
    bookingId: string;
    amount: string;
    bookingRef: string;
  }>();

  const [step, setStep]           = useState<PayStep>("choose");
  const [method, setMethod]       = useState<string>("wave");
  const [error, setError]         = useState<string>("");
  const [demo, setDemo]           = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const verifyRef                 = useRef<ReturnType<typeof setInterval> | null>(null);
  const successAnim               = useRef(new Animated.Value(0)).current;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  /* ── Cleanup on unmount ──────────────────────────────────────────────── */
  useEffect(() => () => { if (verifyRef.current) clearInterval(verifyRef.current); }, []);

  /* ── Poll verify endpoint until paid ─────────────────────────────────── */
  const startPolling = useCallback(() => {
    if (verifyRef.current) clearInterval(verifyRef.current);
    let attempts = 0;
    const MAX = 40; /* ~120 s */
    verifyRef.current = setInterval(async () => {
      attempts++;
      try {
        const data = await apiFetch<VerifyResult>("/payment/verify", {
          token: token ?? undefined,
          method: "POST",
          body: { bookingId },
        });
        if (data.paid) {
          clearInterval(verifyRef.current!);
          verifyRef.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (data.paymentId) setPaymentId(data.paymentId);
          Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
          setStep("success");
        } else if (attempts >= MAX) {
          clearInterval(verifyRef.current!);
          verifyRef.current = null;
          const msg = "Le paiement n'a pas été confirmé dans le délai imparti. Vérifiez votre solde et réessayez.";
          /* Persist failure in DB so booking shows correct status */
          apiFetch("/payment/failed", {
            token: token ?? undefined, method: "POST",
            body: { bookingId, reason: "Délai de confirmation dépassé" },
          }).catch(() => {});
          setError(msg);
          setStep("failed");
        }
      } catch {
        /* Keep polling silently */
      }
    }, 3000);
  }, [bookingId, token, successAnim]);

  /* ── Initiate payment ────────────────────────────────────────────────── */
  const handlePay = useCallback(async () => {
    if (!bookingId || !token) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep("processing");
    setError("");

    try {
      const data = await apiFetch<{
        paymentUrl: string;
        transactionId: string;
        demo: boolean;
        bookingRef: string;
      }>("/payment/init", {
        token,
        method: "POST",
        body: { bookingId, paymentMethod: method },
      });

      setDemo(data.demo);

      if (Platform.OS === "web") {
        /* On web open in same tab since deep links don't work */
        window.open(data.paymentUrl, "_blank");
        /* Poll immediately — demo redirect confirms synchronously */
        startPolling();
      } else {
        /* Mobile: open in in-app browser */
        const result = await WebBrowser.openBrowserAsync(data.paymentUrl, {
          dismissButtonStyle: "cancel",
          toolbarColor: "#0B3C5D",
        });
        /* Whether user closed browser or completed, poll verify endpoint */
        if (result.type === "cancel" || result.type === "dismiss") {
          /* User closed the browser — check if payment went through anyway */
        }
        startPolling();
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors de l'initialisation du paiement");
      setStep("failed");
    }
  }, [bookingId, token, method, startPolling]);

  /* ── Navigate to booking detail after success ─────────────────────────── */
  const goToBooking = () => {
    router.replace({ pathname: "/booking/[id]", params: { id: bookingId } });
  };

  /* ── Retry ────────────────────────────────────────────────────────────── */
  const handleRetry = () => {
    if (verifyRef.current) { clearInterval(verifyRef.current); verifyRef.current = null; }
    setStep("choose");
    setError("");
  };

  /* ── Success screen ──────────────────────────────────────────────────── */
  if (step === "success") {
    return (
      <View style={[ss.flex, { paddingTop: topPad, backgroundColor: "#F0FDF4" }]}>
        <Animated.View style={[ss.successBox, { opacity: successAnim, transform: [{ scale: successAnim }] }]}>
          <View style={ss.successCircle}>
            <Text style={{ fontSize: 52 }}>✅</Text>
          </View>
          <Text style={ss.successTitle}>Paiement confirmé ✅</Text>
          <Text style={ss.successSub}>Votre billet est prêt. Bon voyage !</Text>
          <View style={ss.successRef}>
            <Text style={ss.successRefLabel}>RÉFÉRENCE</Text>
            <Text style={ss.successRefValue}>#{bookingRef}</Text>
          </View>
          <Text style={ss.successAmount}>{Number(amount || 0).toLocaleString()} FCFA</Text>
          {demo && (
            <View style={ss.demoBadge}>
              <Feather name="info" size={12} color="#0369A1" />
              <Text style={ss.demoText}>Mode simulation — intégrez vos clés CinetPay pour le paiement réel</Text>
            </View>
          )}
          <View style={{ width: "100%", gap: 10 }}>
            {paymentId && (
              <Pressable
                style={ss.successBtn}
                onPress={() => router.push({ pathname: "/payment/receipt/[id]", params: { id: paymentId! } })}
              >
                <Feather name="file-text" size={16} color="white" />
                <Text style={ss.successBtnText}>Voir le reçu</Text>
              </Pressable>
            )}
            <Pressable
              style={[ss.successBtnOutline]}
              onPress={goToBooking}
            >
              <Feather name="calendar" size={16} color="#0B3C5D" />
              <Text style={ss.successBtnOutlineText}>Voir mon billet</Text>
            </Pressable>
            <Pressable
              style={ss.historyLink}
              onPress={() => router.push("/payment/history")}
            >
              <Feather name="clock" size={13} color="#64748B" />
              <Text style={ss.historyLinkText}>Historique des paiements</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    );
  }

  /* ── Failed screen ──────────────────────────────────────────────────── */
  if (step === "failed") {
    return (
      <View style={[ss.flex, ss.center, { paddingTop: topPad, backgroundColor: "#FFF" }]}>
        <View style={ss.failedCircle}>
          <Text style={{ fontSize: 48 }}>❌</Text>
        </View>
        <Text style={ss.failedTitle}>Paiement échoué</Text>
        <Text style={ss.failedSub}>{error || "Une erreur est survenue lors du paiement."}</Text>
        <Pressable style={[ss.successBtn, { backgroundColor: "#0B3C5D", marginTop: 24 }]} onPress={handleRetry}>
          <Feather name="refresh-cw" size={16} color="white" />
          <Text style={ss.successBtnText}>Réessayer</Text>
        </Pressable>
        <Pressable style={ss.backLink} onPress={() => router.back()}>
          <Text style={ss.backLinkText}>Revenir à ma réservation</Text>
        </Pressable>
      </View>
    );
  }

  /* ── Processing screen ──────────────────────────────────────────────── */
  if (step === "processing") {
    return (
      <View style={[ss.flex, ss.center, { paddingTop: topPad, backgroundColor: "#FFF" }]}>
        <ActivityIndicator size="large" color="#0B3C5D" />
        <Text style={ss.processingTitle}>Traitement du paiement…</Text>
        <Text style={ss.processingSub}>Veuillez compléter le paiement dans la page qui s'est ouverte.</Text>
        <View style={ss.processingHint}>
          <Feather name="lock" size={13} color="#6B7280" />
          <Text style={ss.processingHintText}>Transaction sécurisée via CinetPay</Text>
        </View>
      </View>
    );
  }

  /* ── Choose method screen ─────────────────────────────────────────────── */
  return (
    <View style={[ss.flex, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={ss.header}>
        <Pressable onPress={() => router.back()} style={ss.backBtn}>
          <Feather name="arrow-left" size={22} color="#0B3C5D" />
        </Pressable>
        <Text style={ss.headerTitle}>Payer avec Mobile Money</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Amount card */}
        <View style={ss.amountCard}>
          <Text style={ss.amountLabel}>Montant à payer</Text>
          <Text style={ss.amountValue}>{Number(amount || 0).toLocaleString()} FCFA</Text>
          <Text style={ss.amountRef}>Réservation #{bookingRef}</Text>
        </View>

        {/* Method picker */}
        <Text style={ss.sectionTitle}>Choisissez votre moyen de paiement</Text>
        {METHODS.map((m) => {
          const sel = method === m.id;
          return (
            <Pressable
              key={m.id}
              style={[ss.methodCard, sel && { borderColor: m.color, borderWidth: 2, backgroundColor: m.color + "10" }]}
              onPress={() => { Haptics.selectionAsync(); setMethod(m.id); }}
            >
              <View style={[ss.methodIcon, { backgroundColor: m.color }]}>
                <Text style={{ fontSize: 22 }}>{m.icon}</Text>
              </View>
              <View style={ss.methodInfo}>
                <Text style={[ss.methodLabel, sel && { color: m.color }]}>{m.label}</Text>
                <Text style={ss.methodSub}>{m.sub}</Text>
              </View>
              <View style={[ss.radio, sel && { backgroundColor: m.color, borderColor: m.color }]}>
                {sel && <Feather name="check" size={12} color="white" />}
              </View>
            </Pressable>
          );
        })}

        {/* Security info */}
        <View style={ss.securityRow}>
          <Feather name="shield" size={14} color="#059669" />
          <Text style={ss.securityText}>Paiement sécurisé via CinetPay — vos données bancaires sont protégées</Text>
        </View>

        {/* Demo mode notice */}
        <View style={ss.demoNotice}>
          <Feather name="info" size={14} color="#0369A1" />
          <Text style={ss.demoNoticeText}>
            Mode démonstration actif. Pour activer les paiements réels, configurez vos clés CinetPay dans les paramètres serveur.
          </Text>
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [ss.payBtn, pressed && { opacity: 0.85 }]}
          onPress={handlePay}
        >
          <Feather name="credit-card" size={18} color="white" />
          <Text style={ss.payBtnText}>Payer {Number(amount || 0).toLocaleString()} FCFA</Text>
        </Pressable>

        <Text style={ss.cancelNote}>
          Vous serez redirigé vers la plateforme CinetPay pour finaliser le paiement en toute sécurité.
        </Text>
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  flex:              { flex: 1, backgroundColor: "#FFF" },
  center:            { alignItems: "center", justifyContent: "center", padding: 24 },
  header:            { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", gap: 10, backgroundColor: "#FFF" },
  backBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  headerTitle:       { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0B3C5D" },
  amountCard:        { backgroundColor: "#0B3C5D", borderRadius: 18, padding: 24, alignItems: "center", marginBottom: 24, shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 },
  amountLabel:       { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  amountValue:       { fontSize: 34, fontFamily: "Inter_700Bold", color: "white" },
  amountRef:         { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 4 },
  sectionTitle:      { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 12 },
  methodCard:        { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0", gap: 12 },
  methodIcon:        { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  methodInfo:        { flex: 1 },
  methodLabel:       { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#1E293B" },
  methodSub:         { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  radio:             { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  securityRow:       { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, marginBottom: 10 },
  securityText:      { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", flex: 1 },
  demoNotice:        { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, marginBottom: 20 },
  demoNoticeText:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "#1D4ED8", flex: 1, lineHeight: 17 },
  payBtn:            { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#059669", borderRadius: 14, paddingVertical: 16, gap: 8, shadowColor: "#059669", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  payBtnText:        { fontSize: 17, fontFamily: "Inter_700Bold", color: "white" },
  cancelNote:        { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center", marginTop: 12, lineHeight: 16 },
  successBox:        { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  successCircle:     { width: 100, height: 100, borderRadius: 50, backgroundColor: "#D1FAE5", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successTitle:      { fontSize: 26, fontFamily: "Inter_700Bold", color: "#065F46", marginBottom: 8 },
  successSub:        { fontSize: 15, fontFamily: "Inter_400Regular", color: "#374151", textAlign: "center", marginBottom: 20 },
  successRef:        { backgroundColor: "#ECFDF5", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 4, alignItems: "center" },
  successRefLabel:   { fontSize: 10, fontFamily: "Inter_500Medium", color: "#6B7280", letterSpacing: 1 },
  successRefValue:   { fontSize: 22, fontFamily: "Inter_700Bold", color: "#065F46" },
  successAmount:     { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6B7280", marginBottom: 20 },
  demoBadge:         { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginBottom: 20, maxWidth: 320 },
  demoText:          { fontSize: 11, fontFamily: "Inter_400Regular", color: "#0369A1", flex: 1 },
  successBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#059669", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, gap: 8, width: "100%" },
  successBtnText:    { fontSize: 16, fontFamily: "Inter_700Bold", color: "white" },
  successBtnOutline: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EFF6FF", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32, gap: 8, width: "100%", borderWidth: 1, borderColor: "#BFDBFE" },
  successBtnOutlineText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#0B3C5D" },
  historyLink:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 6 },
  historyLinkText:   { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  failedCircle:      { width: 100, height: 100, borderRadius: 50, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  failedTitle:       { fontSize: 24, fontFamily: "Inter_700Bold", color: "#B91C1C", marginBottom: 8 },
  failedSub:         { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", textAlign: "center", lineHeight: 20 },
  backLink:          { marginTop: 16 },
  backLinkText:      { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0B3C5D" },
  processingTitle:   { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0B3C5D", marginTop: 20, marginBottom: 8 },
  processingSub:     { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  processingHint:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10 },
  processingHintText:{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
});
