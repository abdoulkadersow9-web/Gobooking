import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth, AGENT_ROLE_LABELS, AGENT_ROLE_COLORS, type AgentRole } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const GREEN = "#166534";
const GREEN_LIGHT = "#F0FDF4";

const ROLE_TILES = [
  {
    role: "agent_ticket" as AgentRole,
    label: "Vente de billets",
    icon: "🎫",
    path: "/agent/tickets",
    desc: "Vendre un billet au guichet",
    color: "#D97706",
    bg: "#FEF3C7",
  },
  {
    role: "agent_embarquement" as AgentRole,
    label: "Embarquement",
    icon: "🚌",
    path: "/agent/embarquement",
    desc: "Scanner billets et gérer l'embarquement",
    color: "#166534",
    bg: "#DCFCE7",
  },
  {
    role: "agent_colis" as AgentRole,
    label: "Gestion colis",
    icon: "📦",
    path: "/agent/colis",
    desc: "Créer, réceptionner et suivre les colis",
    color: "#7C3AED",
    bg: "#EDE9FE",
  },
];

interface BusInfo {
  busName: string;
  plateNumber: string;
  busType: string;
}

export default function AgentHome() {
  const { user, token, logout } = useAuth();
  const [bus, setBus] = useState<BusInfo | null>(null);
  const [busLoading, setBusLoading] = useState(true);

  useEffect(() => {
    if (!token) { setBusLoading(false); return; }
    apiFetch<{ agent?: any; bus?: Record<string, any> | null }>("/agent/info", { token })
      .then(d => {
        if (d?.bus) {
          setBus({
            busName:     d.bus.busName     ?? d.bus.bus_name    ?? "—",
            plateNumber: d.bus.plateNumber ?? d.bus.plate_number ?? "—",
            busType:     d.bus.busType     ?? d.bus.bus_type     ?? "—",
          });
        } else {
          setBus(null);
        }
      })
      .catch(() => setBus(null))
      .finally(() => setBusLoading(false));
  }, [token]);

  useEffect(() => {
    if (!user?.agentRole) return;
    const role = user.agentRole;
    if (role === "agent_ticket"       || role === "vente")           { router.replace("/agent/tickets" as never); return; }
    if (role === "agent_embarquement" || role === "embarquement")    { router.replace("/agent/embarquement" as never); return; }
    if (role === "agent_colis"        || role === "reception_colis") { router.replace("/agent/colis" as never); return; }
  }, [user?.agentRole]);

  const roleLabel = user?.agentRole ? (AGENT_ROLE_LABELS[user.agentRole as AgentRole] ?? user.agentRole) : null;

  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}>
        <View>
          <Text style={S.hello}>Bonjour,</Text>
          <Text style={S.name}>{user?.name ?? "Agent"}</Text>
          {roleLabel && <Text style={S.role}>{roleLabel}</Text>}
        </View>
        <Pressable onPress={logout} style={S.logoutBtn}>
          <Text style={S.logoutTxt}>Déconnexion</Text>
        </Pressable>
      </View>

      <View style={S.body}>
        <View style={S.busCard}>
          <View style={S.busCardLeft}>
            <View style={S.busIconBox}>
              <Text style={{ fontSize: 20 }}>🚌</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.busCardLabel}>Mon bus affecté</Text>
              {busLoading ? (
                <ActivityIndicator size="small" color={GREEN} style={{ marginTop: 4, alignSelf: "flex-start" }} />
              ) : bus ? (
                <>
                  <Text style={S.busCardName}>{bus.busName}</Text>
                  <Text style={S.busCardMeta}>{bus.plateNumber} · {bus.busType}</Text>
                </>
              ) : (
                <Text style={S.busCardNone}>Aucun bus assigné</Text>
              )}
            </View>
          </View>
          {bus && (
            <View style={S.busAssignedBadge}>
              <Feather name="check-circle" size={12} color={GREEN} />
              <Text style={S.busAssignedText}>Assigné</Text>
            </View>
          )}
        </View>

        <Text style={S.sectionTitle}>Espaces agents</Text>
        <View style={S.grid}>
          {ROLE_TILES.map((tile) => (
            <Pressable
              key={tile.role}
              style={[S.tile, { borderLeftColor: tile.color, borderLeftWidth: 4 }]}
              onPress={() => router.push(tile.path as never)}
            >
              <Text style={S.tileIcon}>{tile.icon}</Text>
              <Text style={[S.tileLabel, { color: tile.color }]}>{tile.label}</Text>
              <Text style={S.tileDesc}>{tile.desc}</Text>
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

  busCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderLeftWidth: 4, borderLeftColor: GREEN,
  },
  busCardLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  busIconBox:  { width: 42, height: 42, borderRadius: 12, backgroundColor: GREEN_LIGHT, alignItems: "center", justifyContent: "center" },
  busCardLabel:{ fontSize: 11, fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  busCardName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  busCardMeta: { fontSize: 12, color: "#64748B", marginTop: 1 },
  busCardNone: { fontSize: 13, color: "#CBD5E1", fontStyle: "italic", marginTop: 2 },
  busAssignedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: GREEN_LIGHT, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  busAssignedText: { fontSize: 11, fontWeight: "600", color: GREEN },

  sectionTitle:{ fontSize: 16, fontWeight: "700", color: GREEN, marginBottom: 12 },
  grid:        { gap: 12 },
  tile:        { backgroundColor: "white", borderRadius: 14, padding: 18,
                 elevation: 2, shadowColor: "#000", shadowOpacity: 0.06,
                 shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  tileIcon:    { fontSize: 32, marginBottom: 8 },
  tileLabel:   { fontSize: 17, fontWeight: "700" },
  tileDesc:    { fontSize: 13, color: "#6b7280", marginTop: 4 },
});
