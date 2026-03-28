/**
 * Parcel payment screen via CinetPay (Wave / Orange / MTN).
 * Mirrors /payment/cinetpay.tsx but for parcel payments.
 * Params: parcelId, amount, trackingRef
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const METHODS = [
  { id: "wave",   label: "Wave",          sub: "Paiement Wave CI",         color: "#1BA5E0", icon: "zap"        },
  { id: "orange", label: "Orange Money",  sub: "Paiement mobile Orange",   color: "#FF6B00", icon: "smartphone" },
  { id: "mtn",    label: "MTN MoMo",      sub: "Mobile Money MTN",          color: "#FFCB00", icon: "smartphone" },
];

type Step = "choose" | "processing" | "success" | "failed";

interface VerifyResult { paid: boolean; paymentStatus: string; trackingRef: string; paymentId: string | null }

export default function ParcelCinetPayScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { parcelId, amount, trackingRef } = useLocalSearchParams<{ parcelId: string; amount: string; trackingRef: string }>();

  const [step, setStep]           = useState<Step>("choose");
  const [method, setMethod]       = useState("wave");
  const [error, setError]         = useState("");
  const [demo, setDemo]           = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const verifyRef                 = useRef<ReturnType<typeof setInterval> | null>(null);
  const successAnim               = useRef(new Animated.Value(0)).current;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => () => { if (verifyRef.current) clearInterval(verifyRef.current); }, []);

  const startPolling = useCallback(() => {
    if (verifyRef.current) clearInterval(verifyRef.current);
    let attempts = 0;
    const MAX = 40;
    verifyRef.current = setInterval(async () => {
      attempts++;
      try {
        const data = await apiFetch<VerifyResult>("/payment/verify-parcel", { token: token ?? undefined, method: "POST", body: { parcelId } });
        if (data.paid) {
          clearInterval(verifyRef.current!); verifyRef.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (data.paymentId) setPaymentId(data.paymentId);
          Animated.spring(successAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
          setStep("success");
        } else if (attempts >= MAX) {
          clearInterval(verifyRef.current!); verifyRef.current = null;
          setError("Le paiement n'a pas été confirmé. Vérifiez votre solde et réessayez.");
          setStep("failed");
        }
      } catch { /* keep polling */ }
    }, 3000);
  }, [parcelId, token, successAnim]);

  const handlePay = useCallback(async () => {
    if (!parcelId || !token) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep("processing"); setError("");
    try {
      const data = await apiFetch<{ paymentUrl: string; transactionId: string; demo: boolean }>("/payment/init-parcel", {
        token, method: "POST", body: { parcelId, paymentMethod: method },
      });
      setDemo(data.demo);
      if (Platform.OS === "web") {
        window.open(data.paymentUrl, "_blank");
        startPolling();
      } else {
        await WebBrowser.openBrowserAsync(data.paymentUrl, { dismissButtonStyle: "cancel", toolbarColor: "#0B3C5D" });
        startPolling();
      }
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors de l'initialisation du paiement");
      setStep("failed");
    }
  }, [parcelId, token, method, startPolling]);

  /* ── Success ── */
  if (step === "success") {
    return (
      <View style={[ss.flex, { paddingTop: topPad, backgroundColor: "#EFF6FF" }]}>
        <Animated.View style={[ss.successBox, { opacity: successAnim, transform: [{ scale: successAnim }] }]}>
          <View style={ss.successCircle}><Feather name="package" size={52} color="#0B3C5D" /></View>
          <Text style={ss.successTitle}>Colis confirmé !</Text>
          <Text style={ss.successSub}>Votre colis est enregistré. Vous pouvez le suivre avec votre référence.</Text>
          <View style={ss.successRef}>
            <Text style={ss.successRefLabel}>RÉFÉRENCE DE SUIVI</Text>
            <Text style={ss.successRefValue}>{trackingRef}</Text>
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
              <Pressable style={ss.primaryBtn} onPress={() => router.push({ pathname: "/payment/receipt/[id]", params: { id: paymentId! } })}>
                <Feather name="file-text" size={16} color="white" />
                <Text style={ss.primaryBtnText}>Voir le reçu</Text>
              </Pressable>
            )}
            <Pressable style={ss.outlineBtn} onPress={() => router.replace("/parcel/mes-colis" as never)}>
              <Feather name="package" size={16} color="#0B3C5D" />
              <Text style={ss.outlineBtnText}>Mes colis</Text>
            </Pressable>
            <Pressable style={ss.historyLink} onPress={() => router.push("/payment/history")}>
              <Feather name="clock" size={13} color="#64748B" />
              <Text style={ss.historyLinkText}>Historique des paiements</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    );
  }

  /* ── Failed ── */
  if (step === "failed") {
    return (
      <View style={[ss.flex, ss.center, { paddingTop: topPad }]}>
        <View style={ss.failedCircle}><Feather name="x-circle" size={48} color="#DC2626" /></View>
        <Text style={ss.failedTitle}>Paiement échoué</Text>
        <Text style={ss.failedSub}>{error || "Une erreur est survenue lors du paiement."}</Text>
        <Pressable style={[ss.primaryBtn, { backgroundColor: "#0B3C5D", marginTop: 24 }]} onPress={() => { setStep("choose"); setError(""); }}>
          <Feather name="refresh-cw" size={16} color="white" />
          <Text style={ss.primaryBtnText}>Réessayer</Text>
        </Pressable>
        <Pressable style={ss.backLink} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/colis")}>
          <Text style={ss.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  /* ── Processing ── */
  if (step === "processing") {
    return (
      <View style={[ss.flex, ss.center, { paddingTop: topPad }]}>
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

  /* ── Choose method ── */
  return (
    <View style={[ss.flex, { paddingTop: topPad }]}>
      <View style={ss.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/colis")} style={ss.backBtn}>
          <Feather name="arrow-left" size={22} color="#0B3C5D" />
        </Pressable>
        <View>
          <Text style={ss.headerTitle}>Payer le colis</Text>
          <Text style={ss.headerRef}>{trackingRef}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={ss.amountCard}>
          <Text style={ss.amountLabel}>Montant à payer</Text>
          <Text style={ss.amountValue}>{Number(amount || 0).toLocaleString()} FCFA</Text>
          <View style={ss.commissionRow}>
            <Feather name="info" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={ss.commissionText}>Commission GoBooking 10% incluse</Text>
          </View>
        </View>

        <Text style={ss.sectionTitle}>Choisissez votre moyen de paiement</Text>
        {METHODS.map((m) => {
          const sel = method === m.id;
          return (
            <Pressable key={m.id}
              style={[ss.methodCard, sel && { borderColor: m.color, borderWidth: 2, backgroundColor: m.color + "10" }]}
              onPress={() => { Haptics.selectionAsync(); setMethod(m.id); }}>
              <View style={[ss.methodIcon, { backgroundColor: m.color }]}>
                <Feather name={m.icon as never} size={22} color="white" />
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

        <View style={ss.securityRow}>
          <Feather name="shield" size={14} color="#059669" />
          <Text style={ss.securityText}>Paiement sécurisé via CinetPay — données bancaires protégées</Text>
        </View>

        <Pressable style={({ pressed }) => [ss.payBtn, pressed && { opacity: 0.85 }]} onPress={handlePay}>
          <Feather name="credit-card" size={18} color="white" />
          <Text style={ss.payBtnText}>Payer {Number(amount || 0).toLocaleString()} FCFA</Text>
        </Pressable>

        <Text style={ss.cancelNote}>
          Vous serez redirigé vers CinetPay pour finaliser le paiement en toute sécurité.
        </Text>
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  flex:             { flex: 1, backgroundColor: "#FFF" },
  center:           { alignItems: "center", justifyContent: "center", padding: 24 },
  header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", gap: 10, backgroundColor: "#FFF" },
  backBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  headerTitle:      { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0B3C5D" },
  headerRef:        { fontSize: 12, color: "#64748B", fontFamily: "Inter_400Regular" },
  amountCard:       { backgroundColor: "#0B3C5D", borderRadius: 18, padding: 24, alignItems: "center", marginBottom: 24 },
  amountLabel:      { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  amountValue:      { fontSize: 34, fontFamily: "Inter_700Bold", color: "white" },
  commissionRow:    { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  commissionText:   { fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular" },
  sectionTitle:     { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 12 },
  methodCard:       { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0", gap: 12 },
  methodIcon:       { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  methodInfo:       { flex: 1 },
  methodLabel:      { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#1E293B" },
  methodSub:        { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  radio:            { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  securityRow:      { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, marginBottom: 20 },
  securityText:     { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", flex: 1 },
  payBtn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#059669", borderRadius: 14, paddingVertical: 16, gap: 8 },
  payBtnText:       { fontSize: 17, fontFamily: "Inter_700Bold", color: "white" },
  cancelNote:       { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center", marginTop: 12 },
  successBox:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  successCircle:    { width: 100, height: 100, borderRadius: 50, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successTitle:     { fontSize: 26, fontFamily: "Inter_700Bold", color: "#1E3A8A", marginBottom: 8 },
  successSub:       { fontSize: 15, fontFamily: "Inter_400Regular", color: "#374151", textAlign: "center", marginBottom: 20 },
  successRef:       { backgroundColor: "#EFF6FF", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginBottom: 4, alignItems: "center" },
  successRefLabel:  { fontSize: 10, fontFamily: "Inter_500Medium", color: "#6B7280", letterSpacing: 1 },
  successRefValue:  { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E3A8A" },
  successAmount:    { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6B7280", marginBottom: 20 },
  demoBadge:        { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginBottom: 20 },
  demoText:         { fontSize: 11, fontFamily: "Inter_400Regular", color: "#0369A1", flex: 1 },
  primaryBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#059669", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, gap: 8, width: "100%" },
  primaryBtnText:   { fontSize: 16, fontFamily: "Inter_700Bold", color: "white" },
  outlineBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EFF6FF", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32, gap: 8, width: "100%", borderWidth: 1, borderColor: "#BFDBFE" },
  outlineBtnText:   { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#0B3C5D" },
  historyLink:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 6 },
  historyLinkText:  { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  failedCircle:     { width: 100, height: 100, borderRadius: 50, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  failedTitle:      { fontSize: 24, fontFamily: "Inter_700Bold", color: "#B91C1C", marginBottom: 8 },
  failedSub:        { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", textAlign: "center", lineHeight: 20 },
  backLink:         { marginTop: 16 },
  backLinkText:     { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0B3C5D" },
  processingTitle:  { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0B3C5D", marginTop: 20, marginBottom: 8 },
  processingSub:    { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  processingHint:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F0FDF4", borderRadius: 10, padding: 10 },
  processingHintText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
});
