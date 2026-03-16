import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

type ServiceCard = {
  icon: string;
  title: string;
  desc: string;
  color: string;
  bg: string;
  action: () => void;
  cta: string;
};

export default function ColisTab() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const SERVICES: ServiceCard[] = [
    {
      icon: "send",
      title: "Envoyer un colis",
      desc: "Expédiez un colis vers n'importe quelle ville de Côte d'Ivoire",
      color: "white",
      bg: Colors.light.primary,
      action: () => router.push("/parcel/send"),
      cta: "Commencer",
    },
    {
      icon: "package",
      title: "Mes colis",
      desc: "Consultez la liste de tous vos envois et leur statut",
      color: Colors.light.primary,
      bg: "#EEF2FF",
      action: () => router.push("/parcel/mes-colis"),
      cta: "Voir mes colis",
    },
    {
      icon: "search",
      title: "Suivre un colis",
      desc: "Entrez un numéro de suivi GBX-XXXX-XXXX pour localiser un envoi",
      color: "#059669",
      bg: "#ECFDF5",
      action: () => router.push("/(tabs)/suivi"),
      cta: "Rechercher",
    },
  ];

  const STEPS = [
    { icon: "edit-3", label: "Créer l'envoi",       desc: "Renseignez l'expéditeur et le destinataire" },
    { icon: "credit-card", label: "Payer",           desc: "Orange Money, MTN MoMo, Wave ou carte" },
    { icon: "truck", label: "Déposer en agence",     desc: "Déposez votre colis dans l'agence GoBooking" },
    { icon: "map-pin", label: "Suivi en temps réel", desc: "Suivez l'avancement à chaque étape" },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={styles.header}
      >
        <View>
          <Text style={styles.headerTitle}>GoBooking Colis</Text>
          <Text style={styles.headerSub}>Expédition rapide en Côte d'Ivoire</Text>
        </View>
        <View style={styles.headerBadge}>
          <Feather name="zap" size={14} color="#F59E0B" />
          <Text style={styles.headerBadgeText}>Rapide & Fiable</Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Services ── */}
        <Text style={styles.sectionTitle}>Services</Text>

        {SERVICES.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.serviceCard, { backgroundColor: s.bg }]}
            activeOpacity={0.82}
            onPress={s.action}
          >
            <View style={[styles.serviceIcon, { backgroundColor: s.color === "white" ? "rgba(255,255,255,0.2)" : s.bg === "#EEF2FF" ? "#DBEAFE" : "#D1FAE5" }]}>
              <Feather name={s.icon as never} size={22} color={s.color} />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceTitle, { color: s.color }]}>{s.title}</Text>
              <Text style={[styles.serviceDesc, { color: s.color === "white" ? "rgba(255,255,255,0.8)" : "#64748B" }]}>
                {s.desc}
              </Text>
            </View>
            <View style={[styles.serviceCta, { backgroundColor: s.color === "white" ? "rgba(255,255,255,0.2)" : s.color + "18" }]}>
              <Text style={[styles.serviceCtaText, { color: s.color }]}>{s.cta}</Text>
              <Feather name="arrow-right" size={13} color={s.color} />
            </View>
          </TouchableOpacity>
        ))}

        {/* ── How it works ── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Comment ça marche</Text>

        <View style={styles.stepsCard}>
          {STEPS.map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepLeft}>
                <View style={styles.stepCircle}>
                  <Feather name={step.icon as never} size={15} color={Colors.light.primary} />
                </View>
                {i < STEPS.length - 1 && <View style={styles.stepLine} />}
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepLabel}>{step.label}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Cities info ── */}
        <View style={styles.citiesCard}>
          <View style={styles.citiesHeader}>
            <Feather name="map" size={16} color={Colors.light.primary} />
            <Text style={styles.citiesTitle}>Destinations disponibles</Text>
          </View>
          <View style={styles.citiesGrid}>
            {["Abidjan", "Bouaké", "Yamoussoukro", "San Pédro", "Korhogo", "Man", "Daloa", "Gagnoa"].map((c) => (
              <View key={c} style={styles.cityChip}>
                <Text style={styles.cityChipText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Payment methods ── */}
        <View style={styles.payCard}>
          <Text style={styles.payTitle}>Moyens de paiement acceptés</Text>
          <View style={styles.payRow}>
            {[
              { name: "Orange Money", color: "#FF6B00" },
              { name: "MTN MoMo",    color: "#FFCB00" },
              { name: "Wave",        color: "#1BA5E0" },
              { name: "Visa / MC",   color: "#1A56DB" },
            ].map((p) => (
              <View key={p.name} style={[styles.payChip, { borderColor: p.color + "40", backgroundColor: p.color + "12" }]}>
                <View style={[styles.payDot, { backgroundColor: p.color }]} />
                <Text style={[styles.payChipText, { color: p.color }]}>{p.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.72)", marginTop: 2 },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  headerBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#FDE68A" },

  // Scroll
  scroll: { padding: 16 },

  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    marginBottom: 10,
  },

  // Service cards
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    flexShrink: 0,
  },
  serviceInfo: { flex: 1, gap: 3 },
  serviceTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  serviceDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  serviceCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 0,
  },
  serviceCtaText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  // Steps
  stepsCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 56,
  },
  stepLeft: { alignItems: "center", width: 32 },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#EEF2FF",
    justifyContent: "center", alignItems: "center",
  },
  stepLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#E2E8F0",
    marginVertical: 2,
    minHeight: 20,
  },
  stepContent: { flex: 1, paddingTop: 5 },
  stepLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  stepDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 2 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.light.primary,
    justifyContent: "center", alignItems: "center",
    marginTop: 5,
  },
  stepNumText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "white" },

  // Cities
  citiesCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  citiesHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  citiesTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" },
  citiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cityChip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cityChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#475569" },

  // Payment
  payCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  payTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 12 },
  payRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  payChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  payDot: { width: 8, height: 8, borderRadius: 4 },
  payChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
