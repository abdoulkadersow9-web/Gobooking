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

const AGENT_MENUS = [
  { id: "embarquement",    label: "Embarquement",    icon: "🚌", path: "/agent/embarquement",   desc: "Scanner les billets voyageurs" },
  { id: "vente",           label: "Vente de billets", icon: "🎫", path: "/agent/vente",          desc: "Vendre un billet au guichet" },
  { id: "reception_colis", label: "Réception colis",  icon: "📦", path: "/agent/reception-colis",desc: "Réceptionner un colis arrivé" },
  { id: "validation",      label: "Validation",       icon: "✅", path: "/agent/validation",     desc: "Valider les documents" },
  { id: "route",           label: "Suivi trajet",     icon: "🗺️", path: "/agent/route",          desc: "Suivre le trajet en cours" },
  { id: "scan",            label: "Scanner QR",       icon: "📷", path: "/agent/scan",           desc: "Scanner un code QR" },
  { id: "gains",           label: "Mes gains",        icon: "💰", path: "/agent/gains",          desc: "Commissions et validations" },
  { id: "securite",        label: "Sécurité / SOS",  icon: "🚨", path: "/agent/securite",       desc: "Alertes urgence, panne, SOS", urgent: true },
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

  const filteredMenus = AGENT_MENUS.filter((m) => {
    if (!user?.agentRole) return true;
    if (m.id === "scan" || m.id === "gains" || m.id === "securite") return true;
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
        {/* ── Mon Bus Card ── */}
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

        <Text style={S.sectionTitle}>Mes actions</Text>
        <View style={S.grid}>
          {filteredMenus.map((item) => (
            <Pressable
              key={item.id}
              style={[S.tile, (item as any).urgent && S.tileUrgent]}
              onPress={() => router.push(item.path as never)}
            >
              <Text style={S.tileIcon}>{item.icon}</Text>
              <Text style={[S.tileLabel, (item as any).urgent && { color: "#DC2626" }]}>{item.label}</Text>
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

  busCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 16,
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
  grid:        { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile:        { width: "47%", backgroundColor: "white", borderRadius: 14, padding: 16,
                 elevation: 2, shadowColor: "#000", shadowOpacity: 0.06,
                 shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  tileUrgent:  { backgroundColor: "#FFF1F2", borderWidth: 1.5, borderColor: "#FECDD3" },
  tileIcon:    { fontSize: 28, marginBottom: 8 },
  tileLabel:   { fontSize: 15, fontWeight: "700", color: GREEN },
  tileDesc:    { fontSize: 12, color: "#6b7280", marginTop: 4 },
});
