import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth, hasRole } from "@/context/AuthContext";

const GREEN   = "#166534";
const AMBER   = "#D97706";
const PURPLE  = "#7C3AED";
const NAVY    = "#0B3C5D";
const BLUE    = "#0369A1";

const ALL_MODULES = [
  {
    id: "guichet",
    label: "Agent Guichet",
    sub: "Vente de billets",
    desc: "Émettre et imprimer des billets, encaisser les paiements",
    icon: "credit-card" as const,
    emoji: "🎫",
    path: "/agent/tickets",
    color: AMBER,
    gradient: ["#FFF7ED", "#FEF3C7"] as [string, string],
    border: "#FBBF24",
    roles: ["guichet", "vente", "agent_ticket", "agent_guichet"],
  },
  {
    id: "embarquement",
    label: "Agent Embarquement",
    sub: "Contrôle d'accès",
    desc: "Scanner les QR codes, valider les billets, gérer l'embarquement",
    icon: "check-square" as const,
    emoji: "🚌",
    path: "/agent/embarquement",
    color: GREEN,
    gradient: ["#F0FDF4", "#DCFCE7"] as [string, string],
    border: "#4ADE80",
    roles: ["embarquement", "agent_embarquement"],
  },
  {
    id: "colis",
    label: "Agent Colis",
    sub: "Gestion des envois",
    desc: "Créer, réceptionner et suivre les colis intercités",
    icon: "package" as const,
    emoji: "📦",
    path: "/agent/colis",
    color: PURPLE,
    gradient: ["#FAF5FF", "#EDE9FE"] as [string, string],
    border: "#A78BFA",
    roles: ["colis", "reception_colis", "agent_colis"],
  },
  {
    id: "logistique",
    label: "Agent Logistique",
    sub: "Suivi des bus & trajets",
    desc: "Gérer les bus, suivre les trajets en temps réel, état des véhicules",
    icon: "truck" as const,
    emoji: "🚛",
    path: "/agent/logistique",
    color: BLUE,
    gradient: ["#F0F9FF", "#E0F2FE"] as [string, string],
    border: "#38BDF8",
    roles: ["logistique"],
  },
  {
    id: "route",
    label: "Agent En Route",
    sub: "Trajet & alertes à bord",
    desc: "Voir mon départ assigné, les alertes en cours, répondre aux situations d'urgence",
    icon: "navigation" as const,
    emoji: "🚍",
    path: "/agent/route",
    color: "#9A3412",
    gradient: ["#FFF7ED", "#FFEDD5"] as [string, string],
    border: "#FB923C",
    roles: ["route"],
  },
  {
    id: "suivi",
    label: "Agent Suivi & Alertes",
    sub: "Surveillance en temps réel",
    desc: "Surveiller les bus, gérer les alertes et situations critiques",
    icon: "radio-outline" as const,
    emoji: "📡",
    path: "/agent/suivi",
    color: "#BE123C",
    gradient: ["#FFF1F2", "#FFE4E6"] as [string, string],
    border: "#FDA4AF",
    roles: ["suivi"],
  },
  {
    id: "reservation",
    label: "Agent Réservation",
    sub: "Réservations en ligne",
    desc: "Confirmer les réservations en ligne, assigner les sièges, générer les tickets",
    icon: "monitor" as const,
    emoji: "🖥️",
    path: "/agent/reservation",
    color: "#0E7490",
    gradient: ["#ECFEFF", "#CFFAFE"] as [string, string],
    border: "#67E8F9",
    roles: ["agent_reservation"],
  },
];

export default function AgentHome() {
  const { user, logout } = useAuth();

  const roleLabel = () => {
    const r = user?.agentRole;
    if (!r) return null;
    if (r === "agent_guichet" || r === "agent_ticket" || r === "vente") return "Agent Guichet";
    if (r === "agent_embarquement" || r === "embarquement") return "Agent Embarquement";
    if (r === "agent_colis" || r === "reception_colis") return "Agent Colis";
    if (r === "logistique") return "Agent Logistique";
    if (r === "agent_reservation") return "Agent Réservation";
    return r;
  };

  const extraRoleLabels = () => {
    const extras = user?.extraRoles ?? [];
    if (extras.length === 0) return null;
    return extras.map(r => {
      if (r === "logistique") return "Logistique";
      return r;
    }).join(" · ");
  };

  const visibleModules = ALL_MODULES.filter(mod => {
    return mod.roles.some(r => hasRole(user, r)) || true;
  });

  return (
    <SafeAreaView style={S.root} edges={["top"]}>
      {/* Header */}
      <LinearGradient colors={[NAVY, "#1A5C8A"]} style={S.header}>
        <View style={S.headerLeft}>
          <Text style={S.headerHello}>Bonjour 👋</Text>
          <Text style={S.headerName}>{user?.name ?? "Agent"}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {roleLabel() && (
              <View style={S.rolePill}>
                <Text style={S.rolePillText}>{roleLabel()}</Text>
              </View>
            )}
            {extraRoleLabels() && (
              <View style={[S.rolePill, { backgroundColor: "rgba(56,189,248,0.25)" }]}>
                <Text style={S.rolePillText}>+ {extraRoleLabels()}</Text>
              </View>
            )}
          </View>
        </View>
        <Pressable onPress={logout} style={S.logoutBtn} hitSlop={8}>
          <Feather name="log-out" size={18} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </LinearGradient>

      {/* Intro */}
      <View style={S.intro}>
        <Text style={S.introTitle}>Choisissez votre module</Text>
        <Text style={S.introSub}>Accédez à votre espace de travail</Text>
      </View>

      {/* Module cards */}
      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {visibleModules.map(mod => (
          <Pressable
            key={mod.id}
            style={({ pressed }) => [S.card, pressed && S.cardPressed]}
            onPress={() => router.push(mod.path as never)}
          >
            <LinearGradient
              colors={mod.gradient}
              style={S.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={[S.cardAccent, { backgroundColor: mod.color }]} />
              <View style={[S.cardIconBox, { backgroundColor: mod.color + "20", borderColor: mod.border }]}>
                <Text style={S.cardEmoji}>{mod.emoji}</Text>
              </View>
              <View style={S.cardBody}>
                <Text style={[S.cardLabel, { color: mod.color }]}>{mod.label}</Text>
                <Text style={S.cardSub}>{mod.sub}</Text>
                <Text style={S.cardDesc}>{mod.desc}</Text>
              </View>
              <View style={[S.cardArrow, { backgroundColor: mod.color }]}>
                <Feather name="arrow-right" size={16} color="#fff" />
              </View>
            </LinearGradient>
          </Pressable>
        ))}

        {/* Extra links */}
        <View style={S.extraRow}>
          <Pressable style={S.extraBtn} onPress={() => router.push("/agent/scan" as never)}>
            <Feather name="maximize" size={16} color={NAVY} />
            <Text style={S.extraBtnText}>Scanner QR</Text>
          </Pressable>
          <Pressable style={S.extraBtn} onPress={() => router.push("/agent/gains" as never)}>
            <Feather name="trending-up" size={16} color={NAVY} />
            <Text style={S.extraBtnText}>Mes gains</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  header:     { paddingHorizontal: 20, paddingVertical: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flex: 1, gap: 2 },
  headerHello:{ color: "rgba(255,255,255,0.7)", fontSize: 13 },
  headerName: { color: "#fff", fontSize: 22, fontWeight: "800" },
  rolePill:   { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 4 },
  rolePillText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  logoutBtn:  { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },

  intro:       { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  introTitle:  { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  introSub:    { fontSize: 14, color: "#64748B", marginTop: 2 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },

  card:        { borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  cardGradient:{ flexDirection: "row", alignItems: "center", padding: 18, gap: 14, position: "relative" },
  cardAccent:  { position: "absolute", left: 0, top: 0, bottom: 0, width: 5, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },

  cardIconBox: { width: 58, height: 58, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 1.5, flexShrink: 0 },
  cardEmoji:   { fontSize: 26 },

  cardBody:    { flex: 1, gap: 2 },
  cardLabel:   { fontSize: 16, fontWeight: "800" },
  cardSub:     { fontSize: 12, color: "#475569", fontWeight: "600" },
  cardDesc:    { fontSize: 12, color: "#64748B", marginTop: 4, lineHeight: 17 },

  cardArrow:   { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", flexShrink: 0 },

  extraRow:    { flexDirection: "row", gap: 12, marginTop: 6 },
  extraBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: "#E2E8F0", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  extraBtnText:{ fontSize: 13, fontWeight: "700", color: NAVY },
});
