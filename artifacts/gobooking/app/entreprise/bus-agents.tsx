import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const PRIMARY = "#0B3C5D";
const AMBER = "#D97706";

interface AgentInfo {
  agentId: string;
  agentCode: string;
  agentRole: string | null;
  name: string;
  email: string;
}

interface BusWithAgents {
  id: string;
  busName: string;
  plateNumber: string;
  busType: string;
  agents: AgentInfo[];
}

interface FreeAgent {
  agentId: string;
  agentCode: string;
  agentRole: string | null;
  name: string;
  email: string;
}

const ROLE_LABELS: Record<string, string> = {
  embarquement: "Embarquement",
  vente: "Vente",
  reception_colis: "Réception colis",
  validation: "Validation",
  route: "Suivi trajet",
  chargé_bus: "Chargé bus",
};

export default function BusAgentsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [buses, setBuses] = useState<BusWithAgents[]>([]);
  const [freeAgents, setFreeAgents] = useState<FreeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetBus, setTargetBus] = useState<BusWithAgents | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const data = await apiFetch<{ buses: any[]; freeAgents: any[] }>("/company/buses/agents", { token: token! });
      setBuses(Array.isArray(data?.buses) ? data.buses : []);
      setFreeAgents(Array.isArray(data?.freeAgents) ? data.freeAgents : []);
    } catch {
      setBuses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const openAssign = (bus: BusWithAgents) => {
    setTargetBus(bus);
    setSelectedAgent(freeAgents[0]?.agentId ?? "");
    setShowAssignModal(true);
  };

  const assign = async () => {
    if (!targetBus || !selectedAgent) return;
    setAssigning(true);
    try {
      await apiFetch(`/company/buses/${targetBus.id}/agents/${selectedAgent}`, {
        method: "POST", token: token!,
      });
      setShowAssignModal(false);
      fetchData();
    } catch {
      Alert.alert("Erreur", "Impossible d'affecter cet agent.");
    } finally {
      setAssigning(false);
    }
  };

  const unassign = (busId: string, agentId: string, agentName: string) => {
    Alert.alert("Retirer l'agent", `Retirer ${agentName} de ce bus ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer", style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/company/buses/${busId}/agents/${agentId}`, { method: "DELETE", token: token! });
            fetchData();
          } catch {
            Alert.alert("Erreur", "Impossible de retirer cet agent.");
          }
        },
      },
    ]);
  };

  const totalAssigned = buses.reduce((s, b) => s + b.agents.length, 0);

  return (
    <SafeAreaView style={S.root} edges={["bottom"]}>
      <LinearGradient colors={[PRIMARY, "#1E5F8A"]} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <View style={S.headerRow}>
          <Pressable onPress={() => router.back()} style={S.iconBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle}>Affectation des Agents</Text>
            <Text style={S.headerSub}>{totalAssigned} agent{totalAssigned !== 1 ? "s" : ""} affecté{totalAssigned !== 1 ? "s" : ""} · {freeAgents.length} libre{freeAgents.length !== 1 ? "s" : ""}</Text>
          </View>
        </View>

        <View style={S.kpiRow}>
          <View style={S.kpiCard}>
            <Text style={S.kpiValue}>{buses.length}</Text>
            <Text style={S.kpiLabel}>Bus</Text>
          </View>
          <View style={S.kpiDivider} />
          <View style={S.kpiCard}>
            <Text style={S.kpiValue}>{totalAssigned}</Text>
            <Text style={S.kpiLabel}>Affectés</Text>
          </View>
          <View style={S.kpiDivider} />
          <View style={S.kpiCard}>
            <Text style={[S.kpiValue, { color: freeAgents.length > 0 ? "#FCD34D" : "#A7F3D0" }]}>{freeAgents.length}</Text>
            <Text style={S.kpiLabel}>Libres</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {buses.map(bus => (
            <View key={bus.id} style={S.busCard}>
              <View style={S.busHeader}>
                <View style={S.busIcon}>
                  <Ionicons name="bus" size={22} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.busName}>{bus.busName}</Text>
                  <Text style={S.busPlate}>{bus.plateNumber} · {bus.busType}</Text>
                </View>
                <View style={S.agentCountBadge}>
                  <Feather name="users" size={12} color={bus.agents.length > 0 ? "#16A34A" : "#94A3B8"} />
                  <Text style={[S.agentCount, { color: bus.agents.length > 0 ? "#16A34A" : "#94A3B8" }]}>
                    {bus.agents.length}
                  </Text>
                </View>
              </View>

              {bus.agents.length > 0 ? (
                <View style={S.agentsList}>
                  {bus.agents.map(agent => (
                    <View key={agent.agentId} style={S.agentRow}>
                      <View style={S.agentAvatar}>
                        <Text style={S.agentAvatarText}>{agent.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.agentName}>{agent.name}</Text>
                        <Text style={S.agentMeta}>
                          {agent.agentCode}
                          {agent.agentRole ? ` · ${ROLE_LABELS[agent.agentRole] ?? agent.agentRole}` : ""}
                        </Text>
                      </View>
                      <Pressable
                        style={S.removeBtn}
                        onPress={() => unassign(bus.id, agent.agentId, agent.name)}
                      >
                        <Feather name="user-minus" size={14} color="#EF4444" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={S.noAgentText}>Aucun agent affecté à ce bus</Text>
              )}

              {freeAgents.length > 0 && (
                <Pressable style={S.assignBtn} onPress={() => openAssign(bus)}>
                  <Feather name="user-plus" size={14} color={AMBER} />
                  <Text style={S.assignBtnText}>Affecter un agent</Text>
                </Pressable>
              )}
            </View>
          ))}

          {freeAgents.length > 0 && (
            <View style={S.freeSection}>
              <Text style={S.freeSectionTitle}>Agents sans bus ({freeAgents.length})</Text>
              {freeAgents.map(a => (
                <View key={a.agentId} style={S.freeAgentRow}>
                  <View style={[S.agentAvatar, { backgroundColor: "#FEF3C7" }]}>
                    <Text style={[S.agentAvatarText, { color: AMBER }]}>{a.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.agentName}>{a.name}</Text>
                    <Text style={S.agentMeta}>
                      {a.agentCode}{a.agentRole ? ` · ${ROLE_LABELS[a.agentRole] ?? a.agentRole}` : ""}
                    </Text>
                  </View>
                  <View style={S.freeBadge}>
                    <Text style={S.freeBadgeText}>Libre</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={showAssignModal} transparent animationType="slide" onRequestClose={() => setShowAssignModal(false)}>
        <Pressable style={S.overlay} onPress={() => setShowAssignModal(false)}>
          <Pressable style={S.sheet} onPress={e => e.stopPropagation()}>
            <View style={S.handle} />
            <Text style={S.sheetTitle}>Affecter un agent</Text>
            {targetBus && (
              <View style={S.sheetBusInfo}>
                <Ionicons name="bus" size={16} color={PRIMARY} />
                <Text style={S.sheetBusName}>{targetBus.busName} — {targetBus.plateNumber}</Text>
              </View>
            )}

            <Text style={S.label}>Choisir un agent libre</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {freeAgents.map(a => (
                <Pressable
                  key={a.agentId}
                  style={[S.agentOption, selectedAgent === a.agentId && S.agentOptionSelected]}
                  onPress={() => setSelectedAgent(a.agentId)}
                >
                  <View style={[S.agentAvatar, selectedAgent === a.agentId && { backgroundColor: "#DBEAFE" }]}>
                    <Text style={[S.agentAvatarText, selectedAgent === a.agentId && { color: "#2563EB" }]}>
                      {a.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.agentName}>{a.name}</Text>
                    <Text style={S.agentMeta}>
                      {a.agentCode}{a.agentRole ? ` · ${ROLE_LABELS[a.agentRole] ?? a.agentRole}` : ""}
                    </Text>
                  </View>
                  {selectedAgent === a.agentId && <Feather name="check-circle" size={18} color="#2563EB" />}
                </Pressable>
              ))}
            </ScrollView>

            <View style={S.sheetBtns}>
              <Pressable style={S.cancelBtn} onPress={() => setShowAssignModal(false)}>
                <Text style={S.cancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={[S.saveBtn, assigning && { opacity: 0.6 }]} onPress={assign} disabled={assigning}>
                {assigning
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Feather name="user-check" size={15} color="#fff" /><Text style={S.saveText}>Affecter</Text></>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 },

  kpiRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 14, padding: 14 },
  kpiCard: { flex: 1, alignItems: "center", gap: 3 },
  kpiDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.15)" },
  kpiValue: { fontSize: 20, fontWeight: "800", color: "#fff" },
  kpiLabel: { fontSize: 10, color: "rgba(255,255,255,0.75)" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12 },

  busCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  busHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  busIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  busName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  busPlate: { fontSize: 12, color: "#64748B", marginTop: 1 },
  agentCountBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F8FAFC", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  agentCount: { fontSize: 13, fontWeight: "700" },

  agentsList: { gap: 8, marginBottom: 10 },
  agentRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F0FDF4", borderRadius: 12, padding: 10 },
  agentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center" },
  agentAvatarText: { fontSize: 14, fontWeight: "700", color: "#16A34A" },
  agentName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  agentMeta: { fontSize: 11, color: "#64748B", marginTop: 1 },
  removeBtn: { padding: 6 },

  noAgentText: { fontSize: 13, color: "#CBD5E1", fontStyle: "italic", textAlign: "center", paddingVertical: 6, marginBottom: 8 },

  assignBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#FCD34D", borderStyle: "dashed" },
  assignBtnText: { fontSize: 13, fontWeight: "600", color: AMBER },

  freeSection: { backgroundColor: "#fff", borderRadius: 16, padding: 14, shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3, gap: 10 },
  freeSectionTitle: { fontSize: 14, fontWeight: "700", color: "#64748B", marginBottom: 4 },
  freeAgentRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  freeBadge: { backgroundColor: "#FEF3C7", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  freeBadgeText: { fontSize: 11, fontWeight: "600", color: AMBER },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 10 },
  sheetBusInfo: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginBottom: 12 },
  sheetBusName: { fontSize: 14, fontWeight: "600", color: PRIMARY },

  label: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  agentOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  agentOptionSelected: { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" },

  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: PRIMARY, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  saveText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
