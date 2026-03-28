import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  Pressable, TextInput, Modal, Alert, RefreshControl, FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { apiFetch } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";

/* ─── Types ─────────────────────────────────────────────────────── */
interface AgentItem {
  id: string; name: string | null; email: string | null; phone: string | null;
  agentCode: string; agentRole: string | null; status: string;
}
interface Agence {
  id: string; name: string; city: string; address: string | null;
  phone: string | null; status: string; agentCount: number;
  agents: AgentItem[];
}

/* ─── Role labels ────────────────────────────────────────────────── */
const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  agent_ticket:       { label: "Billetterie",   color: "#7C3AED", bg: "#EDE9FE" },
  agent_embarquement: { label: "Embarquement",  color: "#D97706", bg: "#FEF3C7" },
  agent_colis:        { label: "Colis",         color: "#0369A1", bg: "#E0F2FE" },
  agent_reception:    { label: "Réception",     color: "#059669", bg: "#D1FAE5" },
  agent_route:        { label: "Route",         color: "#DC2626", bg: "#FEE2E2" },
  embarquement:       { label: "Embarquement",  color: "#D97706", bg: "#FEF3C7" },
  reception_colis:    { label: "Récep. Colis",  color: "#0369A1", bg: "#E0F2FE" },
  vente:              { label: "Vente",         color: "#7C3AED", bg: "#EDE9FE" },
  validation:         { label: "Validation",    color: "#059669", bg: "#D1FAE5" },
  route:              { label: "Route",         color: "#DC2626", bg: "#FEE2E2" },
};

const ROLES = [
  { value: "agent_ticket",       label: "Agent Billetterie" },
  { value: "agent_embarquement", label: "Agent Embarquement" },
  { value: "agent_colis",        label: "Agent Colis" },
  { value: "agent_reception",    label: "Agent Réception" },
  { value: "agent_route",        label: "Agent Route" },
];

const AMBER    = "#D97706";
const AMBER_DK = "#92400E";
const AMBER_LT = "#FEF3C7";
const SLATE    = "#0F172A";
const SLATE2   = "#1E293B";
const MUTED    = "#94A3B8";
const BG       = "#F8FAFC";
const WHITE    = "#FFFFFF";

/* ─── Helpers ────────────────────────────────────────────────────── */
function getRoleStyle(role: string | null) {
  return ROLE_LABELS[role ?? ""] ?? { label: role ?? "—", color: "#64748B", bg: "#F1F5F9" };
}

/* ─── Main ───────────────────────────────────────────────────────── */
export default function AgencesScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [agences, setAgences]           = useState<Agence[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [cityFilter, setCityFilter]     = useState<string>("all");
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [showCreateModal, setShowCreate] = useState(false);
  const [showAgentModal, setShowAgent]  = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<Agence[]>("/company/agences", { token: token ?? undefined });
      setAgences(data);
    } catch {
      Alert.alert("Erreur", "Impossible de charger les agences");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const cities = ["all", ...Array.from(new Set(agences.map(a => a.city)))].sort();
  const filtered = cityFilter === "all" ? agences : agences.filter(a => a.city === cityFilter);
  const activeCount = agences.filter(a => a.status === "active").length;
  const totalAgents = agences.reduce((s, a) => s + a.agentCount, 0);

  if (loading) {
    return (
      <View style={[s.flex, { paddingTop: insets.top }]}>
        <LinearGradient colors={[AMBER, AMBER_DK]} style={s.header}>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={s.backBtn}>
            <Feather name="arrow-left" size={22} color={WHITE} />
          </Pressable>
          <Text style={s.headerTitle}>Agences</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
        <View style={s.centered}><ActivityIndicator size="large" color={AMBER} /></View>
      </View>
    );
  }

  return (
    <View style={[s.flex, { backgroundColor: BG }]}>
      {/* Header */}
      <LinearGradient colors={[AMBER, AMBER_DK]} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={WHITE} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.headerTitle}>Agences & Équipes</Text>
          <Text style={s.headerSub}>{activeCount} agence{activeCount !== 1 ? "s" : ""} • {totalAgents} agent{totalAgents !== 1 ? "s" : ""}</Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} style={s.addBtn}>
          <Feather name="plus" size={20} color={WHITE} />
        </Pressable>
      </LinearGradient>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={AMBER} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
      >
        {/* KPI summary */}
        <View style={s.kpiRow}>
          <KpiChip icon="home" label="Agences" value={activeCount} color={AMBER} />
          <KpiChip icon="users" label="Agents" value={totalAgents} color="#7C3AED" />
          <KpiChip icon="map-pin" label="Villes" value={cities.length - 1} color="#0369A1" />
        </View>

        {/* City filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
          {cities.map(c => (
            <Pressable
              key={c}
              onPress={() => setCityFilter(c)}
              style={[s.filterChip, cityFilter === c && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, cityFilter === c && s.filterChipTextActive]}>
                {c === "all" ? "Toutes les villes" : c}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Agences list */}
        {filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <Feather name="home" size={40} color={MUTED} />
            <Text style={s.emptyText}>Aucune agence{cityFilter !== "all" ? ` à ${cityFilter}` : ""}</Text>
            <Pressable onPress={() => setShowCreate(true)} style={s.emptyBtn}>
              <Text style={s.emptyBtnText}>+ Créer une agence</Text>
            </Pressable>
          </View>
        ) : (
          filtered.map(agence => (
            <AgenceCard
              key={agence.id}
              agence={agence}
              expanded={expanded === agence.id}
              onToggle={() => setExpanded(expanded === agence.id ? null : agence.id)}
              onAddAgent={() => setShowAgent(agence.id)}
              onRefresh={() => load(true)}
            />
          ))
        )}
      </ScrollView>

      {/* Create agence modal */}
      {showCreateModal && (
        <CreateAgenceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(true); }}
        />
      )}

      {/* Create agent modal */}
      {showAgentModal && (
        <CreateAgentModal
          agenceId={showAgentModal}
          agences={agences}
          onClose={() => setShowAgent(null)}
          onCreated={() => { setShowAgent(null); load(true); }}
        />
      )}
    </View>
  );
}

/* ─── AgenceCard ─────────────────────────────────────────────────── */
function AgenceCard({
  agence, expanded, onToggle, onAddAgent, onRefresh,
}: {
  agence: Agence;
  expanded: boolean;
  onToggle: () => void;
  onAddAgent: () => void;
  onRefresh: () => void;
}) {
  return (
    <View style={s.card}>
      <Pressable onPress={onToggle} style={s.cardHeader}>
        <View style={s.agenceIcon}>
          <Feather name="home" size={18} color={AMBER} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.agenceName}>{agence.name}</Text>
          <View style={s.agenceMeta}>
            <Feather name="map-pin" size={11} color={MUTED} />
            <Text style={s.agenceMetaText}>{agence.city}</Text>
            {agence.phone && (
              <>
                <Text style={s.agenceMetaDot}>·</Text>
                <Feather name="phone" size={11} color={MUTED} />
                <Text style={s.agenceMetaText}>{agence.phone}</Text>
              </>
            )}
          </View>
        </View>
        <View style={s.agenceBadge}>
          <Text style={s.agenceBadgeText}>{agence.agentCount} agent{agence.agentCount !== 1 ? "s" : ""}</Text>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={MUTED} style={{ marginLeft: 8 }} />
      </Pressable>

      {expanded && (
        <View style={s.agentsSection}>
          {agence.address && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 }}>
              <Feather name="map-pin" size={12} color="#64748B" />
              <Text style={s.agenceAddress}>{agence.address}</Text>
            </View>
          )}

          {/* Agents list */}
          {agence.agents.length === 0 ? (
            <Text style={s.noAgentsText}>Aucun agent dans cette agence</Text>
          ) : (
            agence.agents.map(agent => {
              const rs = getRoleStyle(agent.agentRole);
              return (
                <View key={agent.id} style={s.agentRow}>
                  <View style={s.agentAvatar}>
                    <Text style={s.agentAvatarText}>{(agent.name ?? "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.agentName}>{agent.name ?? "—"}</Text>
                    <Text style={s.agentPhone}>{agent.phone ?? agent.email ?? "—"}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={[s.roleBadge, { backgroundColor: rs.bg }]}>
                      <Text style={[s.roleBadgeText, { color: rs.color }]}>{rs.label}</Text>
                    </View>
                    <Text style={s.agentCode}>{agent.agentCode}</Text>
                  </View>
                </View>
              );
            })
          )}

          <Pressable onPress={onAddAgent} style={s.addAgentBtn}>
            <Feather name="user-plus" size={14} color={AMBER} />
            <Text style={s.addAgentText}>Ajouter un agent</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* ─── KpiChip ────────────────────────────────────────────────────── */
function KpiChip({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <View style={[s.kpiChip, { borderColor: color + "20" }]}>
      <View style={[s.kpiIcon, { backgroundColor: color + "15" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

/* ─── CreateAgenceModal ──────────────────────────────────────────── */
function CreateAgenceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { token } = useAuth();
  const [name, setName]       = useState("");
  const [city, setCity]       = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !city.trim()) {
      Alert.alert("Erreur", "Nom et ville sont requis");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/company/agences", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({ name: name.trim(), city: city.trim(), address: address.trim() || undefined, phone: phone.trim() || undefined }),
      });
      onCreated();
    } catch (err: any) {
      Alert.alert("Erreur", err?.message || "Création impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modal}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Nouvelle Agence</Text>
          <Pressable onPress={onClose}><Feather name="x" size={22} color={SLATE} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.modalBody}>
          <Field label="Nom de l'agence *" value={name} onChange={setName} placeholder="Agence Plateau" />
          <Field label="Ville *" value={city} onChange={setCity} placeholder="Abidjan, Bouaké…" />
          <Field label="Adresse" value={address} onChange={setAddress} placeholder="Rue 12, Quartier Commerciale" />
          <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="+225 07 00 00 00 00" keyboardType="phone-pad" />
          <Pressable onPress={submit} disabled={loading} style={[s.submitBtn, loading && { opacity: 0.6 }]}>
            {loading ? <ActivityIndicator color={WHITE} /> : <Text style={s.submitText}>Créer l'agence</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─── CreateAgentModal ───────────────────────────────────────────── */
function CreateAgentModal({
  agenceId, agences, onClose, onCreated,
}: {
  agenceId: string;
  agences: Agence[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { token } = useAuth();
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [password, setPwd]    = useState("");
  const [role, setRole]       = useState("agent_ticket");
  const [loading, setLoading] = useState(false);

  const agence = agences.find(a => a.id === agenceId);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Erreur", "Nom, email et mot de passe sont requis");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/company/agents", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password: password.trim(),
          agentRole: role,
          agenceId,
        }),
      });
      onCreated();
    } catch (err: any) {
      Alert.alert("Erreur", err?.message || "Création impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modal}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Ajouter un Agent</Text>
          <Pressable onPress={onClose}><Feather name="x" size={22} color={SLATE} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.modalBody}>
          {agence && (
            <View style={s.agencePill}>
              <Feather name="home" size={13} color={AMBER} />
              <Text style={s.agencePillText}>{agence.name} — {agence.city}</Text>
            </View>
          )}
          <Field label="Nom complet *" value={name} onChange={setName} placeholder="Kouassi Yao" />
          <Field label="Email *" value={email} onChange={setEmail} placeholder="agent@compagnie.ci" keyboardType="email-address" />
          <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="+225 07 00 00 00 00" keyboardType="phone-pad" />
          <Field label="Mot de passe *" value={password} onChange={setPwd} placeholder="Min. 6 caractères" secureTextEntry />

          {/* Role picker */}
          <Text style={s.fieldLabel}>Rôle *</Text>
          <View style={s.roleGrid}>
            {ROLES.map(r => {
              const rs = getRoleStyle(r.value);
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setRole(r.value)}
                  style={[s.roleChip, role === r.value && { backgroundColor: rs.bg, borderColor: rs.color }]}
                >
                  <View style={[s.roleDot, { backgroundColor: role === r.value ? rs.color : "#CBD5E1" }]} />
                  <Text style={[s.roleChipText, role === r.value && { color: rs.color, fontWeight: "700" }]}>
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={submit} disabled={loading} style={[s.submitBtn, loading && { opacity: 0.6 }]}>
            {loading ? <ActivityIndicator color={WHITE} /> : <Text style={s.submitText}>Créer l'agent</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ─── Field helper ───────────────────────────────────────────────── */
function Field({
  label, value, onChange, placeholder, keyboardType, secureTextEntry,
}: {
  label: string; value: string; onChange: (t: string) => void;
  placeholder?: string; keyboardType?: any; secureTextEntry?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        style={s.input}
        placeholderTextColor={MUTED}
      />
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  flex:           { flex: 1, backgroundColor: BG },
  centered:       { flex: 1, justifyContent: "center", alignItems: "center" },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  backBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  addBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.25)", justifyContent: "center", alignItems: "center" },
  headerTitle:    { fontSize: 18, fontWeight: "700", color: WHITE },
  headerSub:      { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },

  kpiRow:         { flexDirection: "row", gap: 8, marginBottom: 14 },
  kpiChip:        { flex: 1, backgroundColor: WHITE, borderRadius: 14, padding: 12, alignItems: "center", borderWidth: 1, gap: 4, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  kpiIcon:        { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  kpiValue:       { fontSize: 20, fontWeight: "800", color: SLATE },
  kpiLabel:       { fontSize: 11, color: MUTED, fontWeight: "500" },

  filterRow:      { marginBottom: 14 },
  filterChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: WHITE, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 8 },
  filterChipActive: { backgroundColor: AMBER, borderColor: AMBER },
  filterChipText: { fontSize: 13, fontWeight: "600", color: SLATE2 },
  filterChipTextActive: { color: WHITE },

  emptyBox:       { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText:      { fontSize: 15, color: MUTED, fontWeight: "500" },
  emptyBtn:       { backgroundColor: AMBER, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText:   { color: WHITE, fontWeight: "700", fontSize: 14 },

  card:           { backgroundColor: WHITE, borderRadius: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, overflow: "hidden" },
  cardHeader:     { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  agenceIcon:     { width: 42, height: 42, borderRadius: 12, backgroundColor: AMBER_LT, justifyContent: "center", alignItems: "center" },
  agenceName:     { fontSize: 15, fontWeight: "700", color: SLATE },
  agenceMeta:     { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  agenceMetaText: { fontSize: 12, color: MUTED },
  agenceMetaDot:  { fontSize: 12, color: MUTED },
  agenceBadge:    { backgroundColor: AMBER_LT, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  agenceBadgeText:{ fontSize: 12, fontWeight: "700", color: AMBER_DK },
  agenceAddress:  { fontSize: 12, color: MUTED, marginBottom: 10, marginHorizontal: 16 },

  agentsSection:  { borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingVertical: 12 },
  noAgentsText:   { textAlign: "center", color: MUTED, fontSize: 13, paddingVertical: 16 },
  agentRow:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  agentAvatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EDE9FE", justifyContent: "center", alignItems: "center" },
  agentAvatarText:{ fontSize: 14, fontWeight: "700", color: "#7C3AED" },
  agentName:      { fontSize: 14, fontWeight: "600", color: SLATE },
  agentPhone:     { fontSize: 12, color: MUTED },
  agentCode:      { fontSize: 10, color: MUTED, marginTop: 2 },
  roleBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleBadgeText:  { fontSize: 11, fontWeight: "700" },
  addAgentBtn:    { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 16, marginTop: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: AMBER, borderStyle: "dashed", justifyContent: "center" },
  addAgentText:   { fontSize: 13, fontWeight: "700", color: AMBER },

  modal:          { flex: 1, backgroundColor: WHITE },
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalTitle:     { fontSize: 18, fontWeight: "700", color: SLATE },
  modalBody:      { padding: 20, paddingBottom: 60 },

  agencePill:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: AMBER_LT, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 20 },
  agencePillText: { fontSize: 13, fontWeight: "600", color: AMBER_DK },

  fieldLabel:     { fontSize: 13, fontWeight: "600", color: SLATE2, marginBottom: 6 },
  input:          { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: SLATE },

  roleGrid:       { gap: 8, marginBottom: 20 },
  roleChip:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#E2E8F0" },
  roleDot:        { width: 10, height: 10, borderRadius: 5 },
  roleChipText:   { fontSize: 14, fontWeight: "500", color: SLATE2 },

  submitBtn:      { backgroundColor: AMBER, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
  submitText:     { color: WHITE, fontWeight: "700", fontSize: 16 },
});
