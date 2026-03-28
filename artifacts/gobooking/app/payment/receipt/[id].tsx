import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const METHOD_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  wave:   { label: "Wave",          color: "#1BA5E0", icon: "zap"         },
  orange: { label: "Orange Money",  color: "#FF6B00", icon: "smartphone"  },
  mtn:    { label: "MTN MoMo",      color: "#FFCB00", icon: "smartphone"  },
  card:   { label: "Carte bancaire",color: "#1A56DB", icon: "credit-card" },
};

interface Receipt {
  id: string;
  transactionId: string | null;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  user: { name: string; email: string; phone: string };
  booking: {
    bookingRef: string;
    seatNumbers: string[];
    passengers: { name: string; age: number; gender: string; seatNumber: string }[];
    totalAmount: number;
    status: string;
    paymentStatus: string;
    from: string;
    to: string;
    date: string;
    departureTime: string;
    arrivalTime: string;
  } | null;
}

export default function ReceiptScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!id || !token) return;
    apiFetch<Receipt>(`/payment/receipts/${id}`, { token })
      .then(setReceipt)
      .catch(() => setReceipt(null))
      .finally(() => setLoading(false));
  }, [id, token]);

  const handleDownload = async () => {
    if (!receipt) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDownloading(true);
    try {
      const paidAt = new Date(receipt.createdAt).toLocaleString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      });

      const html = `<!DOCTYPE html><html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1E293B; padding: 40px; max-width: 600px; margin: 0 auto; }
    .header { background: #0B3C5D; color: white; padding: 32px; border-radius: 12px; margin-bottom: 24px; text-align: center; }
    .logo { font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 4px; }
    .logo span { color: #FF6B00; }
    .receipt-title { font-size: 14px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }
    .ref { background: white; color: #0B3C5D; padding: 16px 24px; border-radius: 8px; margin: 16px 0 0; font-size: 22px; font-weight: 800; }
    .section { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 20px; margin-bottom: 16px; }
    .section-title { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #E2E8F0; }
    .row:last-child { border-bottom: none; }
    .label { font-size: 13px; color: #64748B; }
    .value { font-size: 13px; font-weight: 600; color: #1E293B; }
    .amount-big { text-align: center; padding: 20px; background: #ECFDF5; border: 2px solid #A7F3D0; border-radius: 12px; margin-bottom: 16px; }
    .amount-value { font-size: 36px; font-weight: 800; color: #065F46; }
    .amount-label { font-size: 12px; color: #6B7280; margin-top: 4px; }
    .badge-paid { display: inline-block; background: #D1FAE5; color: #065F46; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .route { display: flex; align-items: center; justify-content: space-between; background: #EFF6FF; border-radius: 8px; padding: 16px; }
    .city { font-size: 18px; font-weight: 700; color: #0B3C5D; }
    .time { font-size: 12px; color: #64748B; }
    .arrow { font-size: 20px; color: #0B3C5D; }
    .footer { text-align: center; margin-top: 32px; color: #94A3B8; font-size: 11px; border-top: 1px solid #E2E8F0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Go<span>Booking</span></div>
    <div class="receipt-title">Reçu de paiement officiel</div>
    <div class="ref">#${receipt.booking?.bookingRef ?? receipt.id}</div>
  </div>

  <div class="amount-big">
    <div class="amount-value">${receipt.amount.toLocaleString("fr-CI")} FCFA</div>
    <div class="amount-label">Montant total payé</div>
  </div>

  <div class="section">
    <div class="section-title">Détails du paiement</div>
    <div class="row"><span class="label">Statut</span><span class="badge-paid">✅ Payé</span></div>
    <div class="row"><span class="label">Méthode</span><span class="value">${METHOD_LABELS[receipt.method]?.label ?? receipt.method}</span></div>
    <div class="row"><span class="label">Date du paiement</span><span class="value">${paidAt}</span></div>
    <div class="row"><span class="label">ID Transaction</span><span class="value" style="font-size:11px;font-family:monospace">${receipt.transactionId ?? "—"}</span></div>
    <div class="row"><span class="label">Réf. reçu</span><span class="value" style="font-size:11px;font-family:monospace">${receipt.id}</span></div>
  </div>

  ${receipt.booking ? `
  <div class="section">
    <div class="section-title">Trajet</div>
    <div class="route">
      <div><div class="city">${receipt.booking.from}</div><div class="time">${receipt.booking.departureTime}</div></div>
      <div class="arrow">→</div>
      <div style="text-align:right"><div class="city">${receipt.booking.to}</div><div class="time">${receipt.booking.arrivalTime}</div></div>
    </div>
    <div class="row" style="margin-top:12px"><span class="label">Date</span><span class="value">${receipt.booking.date}</span></div>
    <div class="row"><span class="label">Sièges</span><span class="value">${receipt.booking.seatNumbers?.join(", ") ?? "—"}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Passagers</div>
    ${(receipt.booking.passengers ?? []).map((p) =>
      `<div class="row"><span class="label">${p.name}</span><span class="value">Siège ${p.seatNumber}</span></div>`
    ).join("")}
  </div>
  ` : ""}

  <div class="section">
    <div class="section-title">Client</div>
    <div class="row"><span class="label">Nom</span><span class="value">${receipt.user.name}</span></div>
    <div class="row"><span class="label">Email</span><span class="value">${receipt.user.email}</span></div>
    <div class="row"><span class="label">Téléphone</span><span class="value">${receipt.user.phone || "—"}</span></div>
  </div>

  <div class="footer">
    <strong>GoBooking CI</strong> — Côte d'Ivoire<br>
    Ce reçu est un justificatif officiel de votre paiement.<br>
    Généré le ${new Date().toLocaleString("fr-FR")}
  </div>
</body>
</html>`;

      if (Platform.OS === "web") {
        const blob = new Blob([html], { type: "text/html" });
        const url  = URL.createObjectURL(blob);
        const win  = window.open(url, "_blank");
        win?.print();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType:    "application/pdf",
            dialogTitle: `Reçu GoBooking ${receipt.booking?.bookingRef ?? ""}`,
            UTI:         "com.adobe.pdf",
          });
        } else {
          Alert.alert("Reçu généré", `Fichier PDF enregistré : ${uri}`);
        }
      }
    } catch (err) {
      Alert.alert("Erreur", "Impossible de générer le reçu PDF.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View style={[ss.flex, ss.center, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color="#0B3C5D" />
        <Text style={ss.loadingText}>Chargement du reçu…</Text>
      </View>
    );
  }

  if (!receipt) {
    return (
      <View style={[ss.flex, ss.center, { paddingTop: topPad }]}>
        <Feather name="alert-circle" size={40} color="#EF4444" />
        <Text style={ss.errorText}>Reçu introuvable</Text>
        <Pressable style={ss.backLink} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/bookings")}>
          <Text style={ss.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const m = METHOD_LABELS[receipt.method] ?? { label: receipt.method, color: "#6B7280", icon: "credit-card" };
  const paidAt = new Date(receipt.createdAt).toLocaleString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <View style={[ss.flex, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={ss.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/bookings")} style={ss.backBtn}>
          <Feather name="arrow-left" size={22} color="#0B3C5D" />
        </Pressable>
        <Text style={ss.headerTitle}>Reçu de paiement</Text>
        <Pressable onPress={handleDownload} style={ss.downloadBtn} disabled={downloading}>
          {downloading
            ? <ActivityIndicator size="small" color="#0B3C5D" />
            : <Feather name="download" size={20} color="#0B3C5D" />
          }
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === "web" ? 80 : insets.bottom + 80 }}
      >
        {/* Amount card */}
        <View style={ss.amountCard}>
          <View style={ss.amountRow}>
            <Text style={ss.amountValue}>{(receipt.amount ?? 0).toLocaleString()} FCFA</Text>
            <View style={ss.paidBadge}>
              <Feather name="check-circle" size={12} color="#065F46" />
              <Text style={ss.paidBadgeText}>Payé</Text>
            </View>
          </View>
          <Text style={ss.amountLabel}>Montant total payé</Text>
          <View style={ss.methodPill}>
            <Feather name={m.icon as never} size={16} color={m.color} />
            <Text style={[ss.methodPillLabel, { color: m.color }]}>{m.label}</Text>
          </View>
        </View>

        {/* Booking ref + route */}
        {receipt.booking && (
          <View style={ss.section}>
            <Text style={ss.sectionTitle}>Réservation</Text>
            <View style={ss.refRow}>
              <Text style={ss.refLabel}>Référence</Text>
              <Text style={ss.refValue}>#{receipt.booking.bookingRef}</Text>
            </View>
            <View style={ss.routeCard}>
              <View style={ss.cityBlock}>
                <Text style={ss.cityName}>{receipt.booking.from}</Text>
                <Text style={ss.cityTime}>{receipt.booking.departureTime}</Text>
              </View>
              <View style={ss.arrowBlock}>
                <Feather name="arrow-right" size={16} color="#94A3B8" />
                <Text style={ss.dateText}>{receipt.booking.date}</Text>
              </View>
              <View style={[ss.cityBlock, { alignItems: "flex-end" }]}>
                <Text style={ss.cityName}>{receipt.booking.to}</Text>
                <Text style={ss.cityTime}>{receipt.booking.arrivalTime}</Text>
              </View>
            </View>
            {(receipt.booking.seatNumbers?.length ?? 0) > 0 && (
              <View style={ss.dataRow}>
                <Text style={ss.dataLabel}>Sièges</Text>
                <Text style={ss.dataValue}>{receipt.booking.seatNumbers.join(", ")}</Text>
              </View>
            )}
          </View>
        )}

        {/* Passengers */}
        {(receipt.booking?.passengers?.length ?? 0) > 0 && (
          <View style={ss.section}>
            <Text style={ss.sectionTitle}>Passagers</Text>
            {(receipt.booking?.passengers ?? []).map((p, i) => (
              <View key={i} style={ss.paxRow}>
                <View style={ss.paxAvatar}>
                  <Text style={ss.paxAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.paxName}>{p.name}</Text>
                  <Text style={ss.paxDetails}>{p.age} ans · {p.gender}</Text>
                </View>
                <View style={ss.seatChip}>
                  <Text style={ss.seatChipText}>Siège {p.seatNumber}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Payment details */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Paiement</Text>
          <View style={ss.dataRow}>
            <Text style={ss.dataLabel}>Date</Text>
            <Text style={ss.dataValue}>{paidAt}</Text>
          </View>
          <View style={ss.dataRow}>
            <Text style={ss.dataLabel}>Méthode</Text>
            <Text style={[ss.dataValue, { color: m.color }]}>{m.label}</Text>
          </View>
          {receipt.transactionId && (
            <View style={ss.dataRow}>
              <Text style={ss.dataLabel}>ID Transaction</Text>
              <Text style={[ss.dataValue, ss.mono]} numberOfLines={1} ellipsizeMode="middle">
                {receipt.transactionId}
              </Text>
            </View>
          )}
          <View style={ss.dataRow}>
            <Text style={ss.dataLabel}>Réf. reçu</Text>
            <Text style={[ss.dataValue, ss.mono]} numberOfLines={1} ellipsizeMode="middle">
              {receipt.id}
            </Text>
          </View>
        </View>

        {/* Client */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Client</Text>
          <View style={ss.dataRow}>
            <Text style={ss.dataLabel}>Nom</Text>
            <Text style={ss.dataValue}>{receipt.user.name}</Text>
          </View>
          <View style={ss.dataRow}>
            <Text style={ss.dataLabel}>Email</Text>
            <Text style={ss.dataValue}>{receipt.user.email}</Text>
          </View>
          {receipt.user.phone && (
            <View style={ss.dataRow}>
              <Text style={ss.dataLabel}>Téléphone</Text>
              <Text style={ss.dataValue}>{receipt.user.phone}</Text>
            </View>
          )}
        </View>

        {/* Download button */}
        <Pressable
          style={({ pressed }) => [ss.downloadBig, pressed && { opacity: 0.85 }]}
          onPress={handleDownload}
          disabled={downloading}
        >
          {downloading
            ? <ActivityIndicator color="white" />
            : <>
                <Feather name="download" size={18} color="white" />
                <Text style={ss.downloadBigText}>Télécharger le reçu (PDF)</Text>
              </>
          }
        </Pressable>

        <Text style={ss.disclaimer}>
          Ce reçu est un justificatif officiel de votre paiement GoBooking CI.
        </Text>
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  flex:             { flex: 1, backgroundColor: "#FFF" },
  center:           { alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText:      { marginTop: 12, fontSize: 14, color: "#6B7280", fontFamily: "Inter_400Regular" },
  errorText:        { fontSize: 16, color: "#EF4444", fontFamily: "Inter_600SemiBold", marginTop: 8 },
  backLink:         { marginTop: 12 },
  backLinkText:     { fontSize: 14, color: "#0B3C5D", fontFamily: "Inter_600SemiBold" },
  header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", gap: 10, backgroundColor: "#FFF" },
  backBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  headerTitle:      { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#0B3C5D" },
  downloadBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  amountCard:       { backgroundColor: "#0B3C5D", borderRadius: 18, padding: 22, marginBottom: 14, shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 },
  amountRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  amountValue:      { fontSize: 32, fontFamily: "Inter_700Bold", color: "white" },
  amountLabel:      { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginBottom: 10 },
  paidBadge:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#D1FAE5", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  paidBadgeText:    { fontSize: 12, fontFamily: "Inter_700Bold", color: "#065F46" },
  methodPill:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start" },
  methodEmoji:      { fontSize: 16 },
  methodPillLabel:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },
  section:          { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  sectionTitle:     { fontSize: 11, fontFamily: "Inter_700Bold", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },
  refRow:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  refLabel:         { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B" },
  refValue:         { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0B3C5D" },
  routeCard:        { flexDirection: "row", alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 10, padding: 14, marginBottom: 10 },
  cityBlock:        { flex: 1 },
  cityName:         { fontSize: 17, fontFamily: "Inter_700Bold", color: "#0B3C5D" },
  cityTime:         { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },
  arrowBlock:       { alignItems: "center", paddingHorizontal: 10, gap: 4 },
  dateText:         { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center" },
  dataRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  dataLabel:        { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", flex: 1 },
  dataValue:        { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E293B", flex: 2, textAlign: "right" },
  mono:             { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11 },
  paxRow:           { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  paxAvatar:        { width: 34, height: 34, borderRadius: 17, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  paxAvatarText:    { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1D4ED8" },
  paxName:          { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E293B" },
  paxDetails:       { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  seatChip:         { backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  seatChipText:     { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#1D4ED8" },
  downloadBig:      { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#0B3C5D", borderRadius: 14, paddingVertical: 15, gap: 8, marginTop: 8, shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  downloadBigText:  { fontSize: 16, fontFamily: "Inter_700Bold", color: "white" },
  disclaimer:       { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center", marginTop: 12, marginBottom: 8, lineHeight: 16 },
});
