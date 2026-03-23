import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
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
import { useParcel } from "@/context/ParcelContext";
import { generateQRData } from "@/utils/qr";

function makeQrMatrix(seed: string, size = 21): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const drawFinder = (r: number, c: number) => {
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 7; j++) {
        const onBorder = i === 0 || i === 6 || j === 0 || j === 6;
        const inInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (r + i < size && c + j < size)
          matrix[r + i][c + j] = onBorder || inInner;
      }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  for (let r = 8; r < size - 8; r++)
    for (let c = 8; c < size - 8; c++) {
      hash = (hash * 1664525 + 1013904223) & 0xffffffff;
      matrix[r][c] = (hash >>> 0) % 3 !== 0;
    }
  return matrix;
}

function QRCode({ value, size = 164 }: { value: string; size?: number }) {
  const matrix = makeQrMatrix(value, 21);
  const cell = size / 21;
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: "white",
        padding: cell,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E2E8F0",
      }}
    >
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((on, c) => (
            <View
              key={c}
              style={{
                width: cell,
                height: cell,
                backgroundColor: on ? "#0F172A" : "transparent",
                borderRadius: on ? 1.5 : 0,
              }}
            />
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
  documents: "Documents",
  vetements: "Vêtements",
  electronique: "Électronique",
  alimentaire: "Alimentaire",
  cosmetique: "Cosmétique",
  autre: "Autre",
};

const METHOD_LABELS: Record<string, string> = {
  orange: "Orange Money",
  mtn: "MTN MoMo",
  wave: "Wave",
  card: "Carte bancaire",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ParcelConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const { parcelId, trackingRef: refParam } = useLocalSearchParams<{
    parcelId: string;
    trackingRef: string;
  }>();
  const { parcel, resetParcel } = useParcel();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const trackingRef = parcel.trackingRef || refParam || "GBX-XXXXXXXX";

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 10,
        bounciness: 18,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 10,
        bounciness: 10,
      }),
    ]).start();
  }, []);

  const handleShare = async () => {
    await Share.share({
      title: `Colis GoBooking — ${trackingRef}`,
      message: [
        `📦 COLIS GOBOOKING — Confirmé`,
        `Référence : ${trackingRef}`,
        `Trajet : ${parcel.fromCity} → ${parcel.toCity}`,
        `Expéditeur : ${parcel.senderName} (+225 ${parcel.senderPhone})`,
        `Destinataire : ${parcel.receiverName} (+225 ${parcel.receiverPhone})`,
        `Type : ${TYPE_LABELS[parcel.parcelType ?? ""] || parcel.parcelType} — ${parcel.weight} kg`,
        `Livraison : ${DELIVERY_LABELS[parcel.deliveryType ?? ""] || parcel.deliveryType}`,
        `Montant payé : ${(parcel.amount ?? 0).toLocaleString()} FCFA`,
        `Statut : En préparation`,
      ].join("\n"),
    });
  };

  const goHome = () => {
    resetParcel();
    router.replace("/(tabs)");
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Green success banner */}
        <LinearGradient
          colors={["#059669", "#047857"]}
          style={styles.banner}
        >
          <Animated.View
            style={[
              styles.checkCircle,
              { transform: [{ scale: scaleAnim }], opacity: fadeAnim },
            ]}
          >
            <Feather name="package" size={42} color="white" />
          </Animated.View>

          <Animated.View
            style={[styles.bannerText, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <Text style={styles.bannerTitle}>Colis confirmé !</Text>
            <Text style={styles.bannerSub}>
              Votre colis a bien été enregistré et sera pris en charge sous peu
            </Text>

            <View style={styles.refBox}>
              <Text style={styles.refBoxLabel}>RÉFÉRENCE DE SUIVI</Text>
              <Text style={styles.refBoxValue}>{trackingRef}</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* Status pill */}
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>En préparation</Text>
          <Text style={styles.statusSub}>Votre colis sera bientôt pris en charge</Text>
        </View>

        {/* Ticket card */}
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Card header — tappable → tracking screen */}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(tabs)/suivi",
                params: { ref: trackingRef },
              })
            }
          >
            {({ pressed }) => (
              <LinearGradient
                colors={["#059669", "#047857"]}
                style={[styles.cardHeader, pressed && { opacity: 0.88 }]}
              >
                <View style={styles.cardHeaderLeft}>
                  <Feather name="package" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.cardHeaderTitle}>GoBooking Colis</Text>
                </View>
                <View style={styles.confirmedBadge}>
                  <Feather name="map-pin" size={11} color="#059669" />
                  <Text style={styles.confirmedText}>Suivre</Text>
                  <Feather name="chevron-right" size={11} color="#059669" />
                </View>
              </LinearGradient>
            )}
          </Pressable>

          {/* Route */}
          <View style={styles.routeSection}>
            <View style={styles.routeCity}>
              <Text style={styles.routeCityName}>{parcel.fromCity || "—"}</Text>
              <Text style={styles.routeLabel}>Départ</Text>
            </View>
            <View style={styles.routeMid}>
              <View style={styles.routeDot} />
              <View style={styles.routeLine} />
              <Feather name="package" size={18} color="#059669" />
              <View style={styles.routeLine} />
              <View style={[styles.routeDot, { backgroundColor: "#EF4444" }]} />
            </View>
            <View style={[styles.routeCity, { alignItems: "flex-end" }]}>
              <Text style={styles.routeCityName}>{parcel.toCity || "—"}</Text>
              <Text style={[styles.routeLabel, { textAlign: "right" }]}>
                Destination
              </Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.detailsSection}>
            <InfoRow label="Expéditeur" value={parcel.senderName || "—"} />
            <InfoRow label="Tél. expéditeur" value={`+225 ${parcel.senderPhone || "—"}`} />
            <InfoRow label="Destinataire" value={parcel.receiverName || "—"} />
            <InfoRow label="Tél. destinataire" value={`+225 ${parcel.receiverPhone || "—"}`} />
            <InfoRow
              label="Type de colis"
              value={TYPE_LABELS[parcel.parcelType ?? ""] || parcel.parcelType || "—"}
            />
            <InfoRow label="Poids" value={parcel.weight ? `${parcel.weight} kg` : "—"} />
            <InfoRow
              label="Livraison"
              value={DELIVERY_LABELS[parcel.deliveryType ?? ""] || parcel.deliveryType || "—"}
            />
            <InfoRow
              label="Paiement"
              value={METHOD_LABELS[parcel.paymentMethod ?? ""] || parcel.paymentMethod || "—"}
            />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Montant payé</Text>
              <Text style={styles.totalValue}>
                {(parcel.amount ?? 0).toLocaleString()} FCFA
              </Text>
            </View>
          </View>

          {/* Perforation divider */}
          <View style={styles.perf}>
            <View style={styles.perfCircleL} />
            <View style={styles.perfDash} />
            <View style={styles.perfCircleR} />
          </View>

          {/* QR code section */}
          <View style={styles.qrSection}>
            <Text style={styles.qrHint}>SCANNER POUR SUIVRE LE COLIS</Text>
            <View style={styles.qrWrapper}>
              <QRCode value={generateQRData(trackingRef, "colis")} size={164} />
              <View style={styles.qrLogoOverlay}>
                <LinearGradient
                  colors={["#059669", "#047857"]}
                  style={styles.qrLogo}
                >
                  <Text style={styles.qrLogoText}>GB</Text>
                </LinearGradient>
              </View>
            </View>
            <Text style={styles.qrRef}>{trackingRef}</Text>
          </View>
        </Animated.View>

        {/* Info box */}
        <View style={styles.infoBox}>
          <Feather name="info" size={14} color="#059669" />
          <Text style={styles.infoBoxText}>
            Conservez votre référence{" "}
            <Text style={{ fontFamily: "Inter_700Bold" }}>{trackingRef}</Text>{" "}
            pour suivre votre colis à tout moment dans l'onglet Colis.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.trackBtn, pressed && { opacity: 0.85 }]}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/suivi",
                params: { ref: trackingRef },
              })
            }
          >
            <Feather name="map-pin" size={17} color="white" />
            <Text style={styles.trackBtnText}>Suivre mon colis</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.75 }]}
            onPress={handleShare}
          >
            <Feather name="share-2" size={17} color="#059669" />
            <Text style={styles.shareBtnText}>Télécharger le reçu</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.75 }]}
            onPress={goHome}
          >
            <Feather name="home" size={17} color={Colors.light.primary} />
            <Text style={styles.homeBtnText}>Retour à l'accueil</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  // Banner
  banner: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 24,
    gap: 16,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
  },
  bannerText: { alignItems: "center", gap: 8, width: "100%" },
  bannerTitle: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "white",
    textAlign: "center",
  },
  bannerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    lineHeight: 20,
  },
  refBox: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 18,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    marginTop: 6,
  },
  refBoxLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  refBoxValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "white",
    letterSpacing: 1.5,
  },

  // Status pill
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderRadius: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#BBF7D0",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#059669",
  },
  statusText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#059669",
  },
  statusSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6EE7B7",
    flex: 1,
  },

  // Ticket card
  card: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: -28,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  confirmedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  confirmedText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#059669",
  },

  // Route
  routeSection: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
    backgroundColor: "#F0FDF4",
    gap: 0,
  },
  routeCity: { flex: 1 },
  routeCityName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  routeLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginTop: 2,
  },
  routeMid: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  routeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  routeLine: { flex: 1, height: 1.5, backgroundColor: "#BBF7D0" },

  // Details
  detailsSection: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  infoLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  infoValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
    maxWidth: "55%",
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  totalValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#059669",
  },

  // Perforation
  perf: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },
  perfCircleL: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    marginLeft: -12,
  },
  perfDash: {
    flex: 1,
    height: 1.5,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
  },
  perfCircleR: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    marginRight: -12,
  },

  // QR code
  qrSection: {
    alignItems: "center",
    paddingVertical: 24,
    paddingBottom: 30,
    gap: 14,
  },
  qrHint: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
    letterSpacing: 1.5,
  },
  qrWrapper: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  qrLogoOverlay: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  qrLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  qrLogoText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  qrRef: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    letterSpacing: 2,
  },

  // Info box
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    backgroundColor: "#ECFDF5",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#065F46",
    lineHeight: 20,
  },

  // Actions
  actions: {
    paddingHorizontal: 16,
    gap: 10,
  },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#059669",
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  trackBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#059669",
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#059669",
  },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  homeBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
});
