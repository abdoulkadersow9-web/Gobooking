import { router } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth, AGENT_ROLE_LABELS, AGENT_ROLE_COLORS, type AgentRole } from "@/context/AuthContext";

const GREEN = "#166534";
const GREEN_LIGHT = "#F0FDF4";
const ACCENT = "#FF6B00";

const AGENT_MENUS = [
  { id: "embarquement",    label: "Embarquement",    icon: "🚌", path: "/agent/embarquement",   desc: "Scanner les billets voyageurs" },
  { id: "vente",           label: "Vente de billets", icon: "🎫", path: "/agent/vente",          desc: "Vendre un billet au guichet" },
  { id: "reception_colis", label: "Réception colis",  icon: "📦", path: "/agent/reception-colis",desc: "Réceptionner un colis arrivé" },
  { id: "validation",      label: "Validation",       icon: "✅", path: "/agent/validation",     desc: "Valider les documents" },
  { id: "route",           label: "Suivi trajet",     icon: "🗺️", path: "/agent/route",          desc: "Suivre le trajet en cours" },
  { id: "scan",            label: "Scanner QR",       icon: "📷", path: "/agent/scan",           desc: "Scanner un code QR" },
];

export default function AgentHome() {
  const { user, logout } = useAuth();

  const filteredMenus = AGENT_MENUS.filter((m) => {
    if (!user?.agentRole) return true;
    if (m.id === "scan") return true;
    return m.id === user.agentRole;
  });

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <View>
          <Text style={S.hello}>Bonjour,</Text>
          <Text style={S.name}>{user?.name ?? "Agent"}</Text>
          {user?.agentRole && (
            <Text style={S.role}>{AGENT_ROLE_LABELS[user.agentRole as AgentRole] ?? user.agentRole}</Text>
          )}
        </View>
        <Pressable onPress={logout} style={S.logoutBtn}>
          <Text style={S.logoutTxt}>Déconnexion</Text>
        </Pressable>
      </View>

      <View style={S.body}>
        <Text style={S.sectionTitle}>Mes actions</Text>
        <View style={S.grid}>
          {filteredMenus.map((item) => (
            <Pressable
              key={item.id}
              style={S.tile}
              onPress={() => router.push(item.path as never)}
            >
              <Text style={S.tileIcon}>{item.icon}</Text>
              <Text style={S.tileLabel}>{item.label}</Text>
              <Text style={S.tileDesc}>{item.desc}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: GREEN_LIGHT },
  header:      { backgroundColor: GREEN, padding: 20, flexDirection: "row",
                 justifyContent: "space-between", alignItems: "center" },
  hello:       { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  name:        { color: "white", fontSize: 20, fontWeight: "700" },
  role:        { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2, textTransform: "capitalize" },
  logoutBtn:   { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8,
                 paddingHorizontal: 14, paddingVertical: 8 },
  logoutTxt:   { color: "white", fontSize: 13, fontWeight: "600" },
  body:        { flex: 1, padding: 16 },
  sectionTitle:{ fontSize: 16, fontWeight: "700", color: GREEN, marginBottom: 12 },
  grid:        { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile:        { width: "47%", backgroundColor: "white", borderRadius: 14, padding: 16,
                 elevation: 2, shadowColor: "#000", shadowOpacity: 0.06,
                 shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  tileIcon:    { fontSize: 28, marginBottom: 8 },
  tileLabel:   { fontSize: 15, fontWeight: "700", color: GREEN },
  tileDesc:    { fontSize: 12, color: "#6b7280", marginTop: 4 },
});
