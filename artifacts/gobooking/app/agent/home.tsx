import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth, hasRole } from "@/context/AuthContext";
import AlertBanner from "@/components/AlertBanner";
import { useRealtime } from "@/hooks/useRealtime";

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
    path: "/agent/embarquement",
    color: GREEN,
    gradient: ["#F0FDF4", "#DCFCE7"] as [string, string],
    border: "#4ADE80",
    roles: ["embarquement", "agent_embarquement", "agent_guichet", "guichet", "vente", "agent_ticket"],
  },
  {
    id: "colis",
    label: "Agent Colis",
    sub: "Gestion des envois",
    desc: "Créer, réceptionner et suivre les colis intercités",
    icon: "package" as const,
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
    path: "/agent/route",
    color: "#9A3412",
    gradient: ["#FFF7ED", "#FFEDD5"] as [string, string],
    border: "#FB923C",
    roles: ["route", "agent_route"],
  },
  {
    id: "suivi",
    label: "Agent Suivi & Alertes",
    sub: "Surveillance en temps réel",
    desc: "Surveiller les bus, gérer les alertes et situations critiques",
    icon: "radio" as const,
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
    path: "/agent/reservation",
    color: "#0E7490",
    gradient: ["#ECFEFF", "#CFFAFE"] as [string, string],
    border: "#67E8F9",
    roles: ["agent_reservation"],
  },
  {
    id: "bagage",
    label: "Agent Bagage",
    sub: "Enregistrement des bagages",
    desc: "Scanner le billet, enregistrer le bagage, définir le prix, confirmer le paiement",
    icon: "briefcase" as const,
    path: "/agent/bagage",
    color: "#92400E",
    gradient: ["#FFFBEB", "#FEF3C7"] as [string, string],
    border: "#FCD34D",
    roles: ["bagage", "agent_bagage"],
  },
  {
    id: "caisse",
    label: "Ma Caisse",
    sub: "Points · Versements · Validation",
    desc: "Consulter la caisse du départ ou de la journée, faire ses points et envoyer au chef d'agence",
    icon: "dollar-sign" as const,
    path: "/agent/caisse",
    color: "#065F46",
    gradient: ["#ECFDF5", "#D1FAE5"] as [string, string],
    border: "#6EE7B7",
    roles: ["agent_ticket", "guichet", "vente", "agent_guichet", "agent_bagage", "bagage", "agent_route", "route", "agent_colis", "colis", "reception_colis"],
  },
  {
    id: "validation_depart",
    label: "Validation Départ",
    sub: "Bordereau · Dépenses · Départ",
    desc: "Synthèse passagers, bagages, colis, dépenses — valider le départ en route",
    icon: "check-square" as const,
    path: "/agent/departure-validation",
    color: "#4338CA",
    gradient: ["#EEF2FF", "#E0E7FF"] as [string, string],
    border: "#A5B4FC",
    roles: ["validation_depart", "agent_validation_depart"],
  },
  {
    id: "chef_agence",
    label: "Chef d'Agence",
    sub: "Tableau de bord agence",
    desc: "Programmer les départs, gérer la flotte, suivre les agents et les passagers de l'agence",
    icon: "settings" as const,
    path: "/agent/chef-home",
    color: "#3730A3",
    gradient: ["#EEF2FF", "#E0E7FF"] as [string, string],
    border: "#A5B4FC",
    roles: ["chef_agence"],
  },
];

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const dayNames = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  const monthNames = ["jan.","fév.","mar.","avr.","mai","juin","juil.","aoû.","sep.","oct.","nov.","déc."];
  const day = dayNames[now.getDay()];
  const date = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const time = now.toLocaleTimeString("fr-CI", { hour: "2-digit", minute: "2-digit" });
  return { day, date, time };
}

export default function AgentHome() {
  const { user, token: authToken, logout, refreshUser } = useAuth();
  const token = authToken ?? "";
  const { preDepartureAlerts, validationAlerts, agentRole } = useRealtime(token);
  const clock = useLiveClock();
  const [photoUri, setPhotoUri] = useState<string | null>(user?.photoUrl ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
    : "";

  const handleAvatarPress = () => {
    Alert.alert("Photo de profil", "Choisir une option", [
      { text: "Galerie", onPress: pickFromGallery },
      { text: "Appareil photo", onPress: pickFromCamera },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission refusée"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ["images"] });
    if (!result.canceled && result.assets?.[0]?.base64) {
      await uploadPhoto(result.assets[0].base64!, result.assets[0].uri);
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission refusée"); return; }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets?.[0]?.base64) {
      await uploadPhoto(result.assets[0].base64!, result.assets[0].uri);
    }
  };

  const uploadPhoto = async (base64: string, localUri: string) => {
    setUploadingPhoto(true);
    setPhotoUri(localUri);
    try {
      const resp = await fetch(`${BASE_URL}/agent/profile/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ photoBase64: `data:image/jpeg;base64,${base64}` }),
      });
      const json = await resp.json();
      if (json.photoUrl) setPhotoUri(json.photoUrl);
      if (refreshUser) refreshUser();
    } catch {
      Alert.alert("Erreur", "Impossible d'uploader la photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const roleLabel = () => {
    const r = user?.agentRole;
    if (!r) return null;
    if (r === "agent_guichet" || r === "agent_ticket" || r === "vente") return "Agent Guichet";
    if (r === "agent_embarquement" || r === "embarquement") return "Agent Embarquement";
    if (r === "agent_colis" || r === "reception_colis") return "Agent Colis";
    if (r === "logistique") return "Agent Logistique";
    if (r === "agent_route" || r === "route") return "Agent En Route";
    if (r === "suivi") return "Agent Suivi";
    if (r === "agent_reservation") return "Agent Réservation";
    if (r === "agent_bagage" || r === "bagage") return "Agent Bagage";
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
    return mod.roles.some(r => hasRole(user, r));
  });

  return (
    <SafeAreaView style={S.root} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      {/* Header */}
      <LinearGradient colors={[NAVY, "#1A5C8A"]} style={S.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
          {/* Avatar avec photo */}
          <Pressable onPress={handleAvatarPress} style={{ position: "relative" }}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{(user?.name ?? "A").charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ position: "absolute", bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: uploadingPhoto ? "#9CA3AF" : "#34D399", borderWidth: 1.5, borderColor: NAVY, alignItems: "center", justifyContent: "center" }}>
              <Feather name={uploadingPhoto ? "loader" : "camera"} size={8} color="#fff" />
            </View>
          </Pressable>
          <View style={S.headerLeft}>
            <Text style={S.headerHello}>Bonjour</Text>
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
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Pressable onPress={logout} style={S.logoutBtn} hitSlop={8}>
            <Feather name="log-out" size={18} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.5 }}>{clock.time}</Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 }}>{clock.day} {clock.date}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Alertes temps réel — Module 6 */}
      <AlertBanner
        preDepartureAlerts={preDepartureAlerts}
        validationAlerts={validationAlerts}
        agentRole={agentRole}
        onAction={(tripId, type) => {
          if (type === "pre_departure") router.push("/agent/departure-validation");
          else router.push("/agent/tickets");
        }}
      />

      {/* Intro */}
      <View style={S.intro}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={S.introTitle}>Mon espace de travail</Text>
          <View style={{ backgroundColor: "#EFF6FF", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#BFDBFE" }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#1D4ED8" }}>
              {visibleModules.length} module{visibleModules.length > 1 ? "s" : ""}
            </Text>
          </View>
        </View>
        <Text style={S.introSub}>Sélectionnez votre module pour commencer</Text>
      </View>

      {/* Module cards */}
      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
              <View style={[S.cardIconBox, { backgroundColor: mod.color + "18", borderColor: mod.border }]}>
                <Feather name={mod.icon} size={26} color={mod.color} />
              </View>
              <View style={S.cardBody}>
                <Text style={[S.cardLabel, { color: mod.color }]}>{mod.label}</Text>
                <Text style={S.cardSub}>{mod.sub}</Text>
              </View>
              <View style={[S.cardArrow, { backgroundColor: mod.color + "18", borderWidth: 1, borderColor: mod.border }]}>
                <Feather name="arrow-right" size={16} color={mod.color} />
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

  intro:       { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  introTitle:  { fontSize: 20, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  introSub:    { fontSize: 13, color: "#64748B", marginTop: 2 },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 36, gap: 12 },

  card:        { borderRadius: 20, overflow: "hidden", shadowColor: "#0B3C5D", shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.04)" },
  cardPressed: { opacity: 0.86, transform: [{ scale: 0.978 }] },
  cardGradient:{ flexDirection: "row", alignItems: "center", paddingVertical: 22, paddingHorizontal: 18, gap: 15, position: "relative" },
  cardAccent:  { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },

  cardIconBox: { width: 58, height: 58, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 1.5, flexShrink: 0 },
  cardBody:    { flex: 1, gap: 3 },
  cardLabel:   { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  cardSub:     { fontSize: 12, color: "#475569", fontWeight: "600" },

  cardArrow:   { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", flexShrink: 0 },

  extraRow:    { flexDirection: "row", gap: 10, marginTop: 4 },
  extraBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: "#E2E8F0", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  extraBtnText:{ fontSize: 13, fontWeight: "700", color: NAVY },

});
