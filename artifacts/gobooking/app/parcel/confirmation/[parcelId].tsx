import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { apiFetch } from "@/utils/api";

interface Parcel {
  id: string;
  trackingRef: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  fromCity: string;
  toCity: string;
  parcelType: string;
  weight: number;
  description?: string;
  deliveryType: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

function makeQrMatrix(seed: string, size = 21): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const drawFinder = (r: number, c: number) => {
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 7; j++) {
        const onBorder = i === 0 || i === 6 || j === 0 || j === 6;
        const inInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (r + i < size && c + j < size) matrix[r + i][c + j] = onBorder || inInner;
      }
  };
  drawFinder(0, 0); drawFinder(0, size - 7); drawFinder(size - 7, 0);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  for (let r = 8; r < size - 8; r++)
    for (let c = 8; c < size - 8; c++) {
      hash = (hash * 1664525 + 1013904223) & 0xffffffff;
      matrix[r][c] = (hash >>> 0) % 3 !== 0;
    }
  return matrix;
}

function QRCode({ value, size = 152 }: { value: string; size?: number }) {
  const matrix = makeQrMatrix(value, 21);
  const cell = size / 21;
  return (
    <View style={{ width: size, height: size, backgroundColor: "white", padding: cell, borderRadius: 12 }}>
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((on, c) => (
            <View key={c} style={{ width: cell, height: cell, backgroundColor: on ? "#0F172A" : "transparent", borderRadius: on ? 1.2 : 0 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const DELIVERY_LABELS: Record<string, string> = {
  depot_agence: "Dépôt en agence",
  livraison_domicile: "Livraison à domicile",
  retrait_agence: "Retrait en agence",
};

const TYPE_LABELS: Record<string, string> = {
  documents: "Documents", vetements: "Vêtements", electronique: "Électronique",
  alimentaire: "Alimentaire", cosmetique: "Cosmétique", autre: "Autre",
};

const METHOD_LABELS: Record<string, string> = {
  orange: "Orange Money", mtn: "MTN MoMo", wave: "Wave", card: "Carte bancaire",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B" }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A", maxWidth: "55%", textAlign: "right" }}>{value}</Text>
    </View>
  );
}

export default function ParcelConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(true);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 16 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();

    apiFetch<Parcel>(`/parcels/${parcelId}`)
      .then(setParcel)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [parcelId]);

  const handleShare = async () => {
    if (!parcel) return;
    await Share.share({
      title: `Colis GoBooking — ${parcel.trackingRef}`,
      message: [
        `📦 COLIS GOBOOKING`,
        `Référence de suivi : ${parcel.trackingRef}`,
        `Trajet : ${parcel.fromCity} → ${parcel.toCity}`,
        `Expéditeur : ${parcel.senderName} (${parcel.senderPhone})`,
        `Destinataire : ${parcel.receiverName} (${parcel.receiverPhone})`,
        `Type : ${TYPE_LABELS[parcel.parcelType] || parcel.parcelType} · ${parcel.weight} kg`,
        `Livraison : ${DELIVERY_LABELS[parcel.deliveryType] || parcel.deliveryType}`,
        `Montant : ${parcel.amount.toLocaleString()} FCFA`,
      ].join("\n"),
    });
  };

  if (loading) return <View style={[styles.center, { paddingTop: topPad }]}><ActivityIndicator size="large" color={Colors.light.primary} /></View>;
  if (!parcel) return (
    <View style={[styles.center, { paddingTop: topPad }]}>
      <Feather name="alert-circle" size={48} color="#CBD5E1" />
      <Text style={styles.errorText}>Colis introuvable</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 40 }} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <LinearGradient colors={["#059669", "#047857"]} style={styles.banner}>
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}>
            <Feather name="package" size={38} color="white" />
          </Animated.View>
          <Animated.View style={{ opacity: fadeAnim, alignItems: "center", gap: 6 }}>
            <Text style={styles.bannerTitle}>Colis enregistré !</Text>
            <Text style={styles.bannerSub}>Votre colis a bien été pris en charge</Text>
            <View style={styles.refBadge}>
              <Text style={styles.refLabel}>RÉFÉRENCE DE SUIVI</Text>
              <Text style={styles.refValue}>{parcel.trackingRef}</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* Ticket card */}
        <View style={styles.card}>
          <LinearGradient colors={["#059669", "#047857"]} style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>GoBooking Colis</Text>
            <View style={styles.confirmedBadge}>
              <Feather name="check-circle" size={11} color="#059669" />
              <Text style={styles.confirmedText}>Enregistré</Text>
            </View>
          </LinearGradient>

          <View style={styles.routeHero}>
            <View style={styles.heroCity}>
              <Text style={styles.heroCity1}>{parcel.fromCity}</Text>
              <Text style={styles.heroLabel}>Départ</Text>
            </View>
            <View style={styles.heroMid}>
              <Feather name="package" size={20} color="#059669" />
              <View style={styles.midLine} />
              <Feather name="arrow-right" size={16} color="#059669" />
            </View>
            <View style={[styles.heroCity, { alignItems: "flex-end" }]}>
              <Text style={styles.heroCity1}>{parcel.toCity}</Text>
              <Text style={[styles.heroLabel, { textAlign: "right" }]}>Destination</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8 }}>
            <Row label="Expéditeur" value={parcel.senderName} />
            <Row label="Tél. expéditeur" value={"+225 " + parcel.senderPhone} />
            <Row label="Destinataire" value={parcel.receiverName} />
            <Row label="Tél. destinataire" value={"+225 " + parcel.receiverPhone} />
            <Row label="Type de colis" value={TYPE_LABELS[parcel.parcelType] || parcel.parcelType} />
            <Row label="Poids" value={`${parcel.weight} kg`} />
            <Row label="Livraison" value={DELIVERY_LABELS[parcel.deliveryType] || parcel.deliveryType} />
            <Row label="Paiement" value={METHOD_LABELS[parcel.paymentMethod] || parcel.paymentMethod} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 }}>
              <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" }}>Montant payé</Text>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#059669" }}>{parcel.amount.toLocaleString()} FCFA</Text>
            </View>
          </View>

          {/* Perforation */}
          <View style={styles.perf}>
            <View style={styles.perfCircleL} />
            <View style={styles.perfDash} />
            <View style={styles.perfCircleR} />
          </View>

          {/* QR */}
          <View style={styles.qrSection}>
            <Text style={styles.qrHint}>Scanner pour suivre le colis</Text>
            <View style={{ position: "relative", justifyContent: "center", alignItems: "center" }}>
              <QRCode value={parcel.trackingRef} size={152} />
              <View style={{ position: "absolute", justifyContent: "center", alignItems: "center" }}>
                <LinearGradient colors={["#059669", "#047857"]} style={styles.qrLogo}>
                  <Text style={styles.qrLogoText}>GB</Text>
                </LinearGradient>
              </View>
            </View>
            <Text style={styles.qrRef}>{parcel.trackingRef}</Text>
            <Pressable style={styles.trackBtn} onPress={() => router.push({ pathname: "/parcel/tracking/[parcelId]", params: { parcelId: parcel.id } })}>
              <Feather name="map-pin" size={14} color={Colors.light.primary} />
              <Text style={styles.trackBtnText}>Suivre mon colis</Text>
            </Pressable>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Feather name="info" size={15} color={Colors.light.primary} />
          <Text style={styles.infoText}>
            Votre colis est enregistré. Utilisez la référence{" "}
            <Text style={{ fontFamily: "Inter_700Bold" }}>{parcel.trackingRef}</Text>{" "}
            pour suivre votre expédition à tout moment.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.7 }]} onPress={handleShare}>
            <Feather name="download" size={16} color={Colors.light.primary} />
            <Text style={styles.outlineBtnText}>Télécharger le reçu</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.solidBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]} onPress={() => router.replace("/(tabs)")}>
            <Feather name="home" size={16} color="white" />
            <Text style={styles.solidBtnText}>Retour à l'accueil</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { fontSize: 16, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 8 },
  banner: { alignItems: "center", paddingTop: 44, paddingBottom: 56, paddingHorizontal: 24, gap: 10 },
  checkCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(255,255,255,0.22)", justifyContent: "center", alignItems: "center", marginBottom: 6, borderWidth: 3, borderColor: "rgba(255,255,255,0.35)" },
  bannerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "white", textAlign: "center" },
  bannerSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.82)", textAlign: "center" },
  refBadge: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 16, paddingHorizontal: 28, paddingVertical: 12, alignItems: "center", marginTop: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  refLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.75)", letterSpacing: 1.2 },
  refValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: "white", marginTop: 3, letterSpacing: 1 },
  card: { backgroundColor: "white", marginHorizontal: 16, marginTop: -26, borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 7, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  cardHeaderTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "white" },
  confirmedBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "white", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  confirmedText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#059669" },
  routeHero: { flexDirection: "row", alignItems: "center", padding: 20, paddingBottom: 16, backgroundColor: "#F0FDF4" },
  heroCity: { flex: 1 },
  heroCity1: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#0F172A" },
  heroLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 2 },
  heroMid: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  midLine: { flex: 1, height: 1.5, backgroundColor: "#BBF7D0" },
  perf: { flexDirection: "row", alignItems: "center", marginVertical: 4 },
  perfCircleL: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#F1F5F9", marginLeft: -13 },
  perfDash: { flex: 1, height: 1.5, borderWidth: 1, borderColor: "#CBD5E1", borderStyle: "dashed" },
  perfCircleR: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#F1F5F9", marginRight: -13 },
  qrSection: { alignItems: "center", paddingVertical: 24, paddingBottom: 28, gap: 12 },
  qrHint: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.9 },
  qrLogo: { width: 34, height: 34, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  qrLogoText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "white" },
  qrRef: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0F172A", letterSpacing: 2.5 },
  trackBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EEF2FF", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  trackBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginHorizontal: 16, backgroundColor: "#EEF2FF", borderRadius: 16, padding: 14, marginBottom: 12 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.light.primary, lineHeight: 20 },
  actions: { paddingHorizontal: 16, gap: 10 },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: Colors.light.primary, borderRadius: 14, paddingVertical: 14 },
  outlineBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },
  solidBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.light.primary, borderRadius: 14, paddingVertical: 14, shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  solidBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "white" },
});
