import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const PRIMARY = "#0B3C5D";
const AMBER   = "#D97706";
const GREEN   = "#166534";
const PURPLE  = "#7C3AED";

/* ─── Types ─────────────────────────────────────────────────── */
interface Agence {
  id: string;
  name: string;
  city: string;
  status: string;
}

interface AgentItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  agentCode: string;
  agentRole: string | null;
  agenceId: string | null;
  agenceName: string | null;
  agenceCity: string | null;
  status: string;
  createdAt: string;
}

/* ─── Rôles disponibles ─────────────────────────────────────── */
const AGENT_ROLES = [
  { value: "agent_embarquement", label: "Agent Embarquement", color: GREEN,  icon: "check-square" as const },
  { value: "agent_colis",        label: "Agent Colis",        color: PURPLE, icon: "package" as const },
  { value: "agent_guichet",      label: "Agent Guichet",      color: AMBER,  icon: "credit-card" as const },
];

function roleLabel(r: string | null) {
  if (!r) return "—";
  const found = AGENT_ROLES.find(x => x.value === r);
  if (found) return found.label;
  if (r === "agent_ticket" || r === "vente") return "Agent Guichet";
  if (r === "embarquement") return "Agent Embarquement";
  if (r === "reception_colis") return "Agent Colis";
  return r;
}

function roleColors(r: string | null): { bg: string; text: string } {
  if (!r) return { bg: "#F1F5F9", text: "#64748B" };
  if (r === "agent_embarquement" || r === "embarquement") return { bg: "#DCFCE7", text: GREEN };
  if (r === "agent_colis" || r === "reception_colis") return { bg: "#EDE9FE", text: PURPLE };
  if (r === "agent_guichet" || r === "agent_ticket" || r === "vente") return { bg: "#FEF3C7", text: AMBER };
  return { bg: "#F1F5F9", text: "#64748B" };
}

/* ─── Composant principal ───────────────────────────────────── */
export default function AgentsPage() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [agents, setAgents]   = useState<AgentItem[]>([]);
  const [agences, setAgences] = useState<Agence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Formulaire */
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "",
    agentRole: "", agenceId: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  /* ─── Chargement données ─────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      const [agentsRes, agencesRes] = await Promise.all([
        apiFetch<AgentItem[]>("/company/agents", { token: token ?? undefined }),
        apiFetch<Agence[]>("/company/agences", { token: token ?? undefined }),
      ]);
      setAgents(agentsRes ?? []);
      setAgences((agencesRes ?? []).filter(a => a.status === "active"));
    } catch {
      Alert.alert("Erreur", "Impossible de charger les agents");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  /* ─── Validation formulaire ──────────────────────────────── */
  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim())     errs.name     = "Nom requis";
    if (!form.email.trim())    errs.email    = "Email requis";
    if (!form.password.trim()) errs.password = "Mot de passe requis";
    if (form.password.length > 0 && form.password.length < 6) errs.password = "Minimum 6 caractères";
    if (!form.agentRole)       errs.agentRole = "Rôle requis";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  /* ─── Créer agent ────────────────────────────────────────── */
  async function handleCreate() {
    if (!validate()) return;
    setSaving(true);
    try {
      await apiFetch("/company/agents", {
        method: "POST",
        token: token ?? undefined,
        body: {
          name:      form.name.trim(),
          email:     form.email.trim().toLowerCase(),
          password:  form.password,
          phone:     form.phone.trim(),
          agentRole: form.agentRole,
          agenceId:  form.agenceId || undefined,
        },
      });
      setShowModal(false);
      setForm({ name: "", email: "", password: "", phone: "", agentRole: "", agenceId: "" });
      setFormErrors({});
      load();
    } catch (err: any) {
      Alert.alert("Erreur", err?.message ?? "Impossible de créer l'agent");
    } finally {
      setSaving(false);
    }
  }

  /* ─── Désactiver agent ───────────────────────────────────── */
  function confirmDeactivate(agent: AgentItem) {
    Alert.alert(
      "Désactiver l'agent",
      `Voulez-vous désactiver ${agent.name} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désactiver",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/company/agents/${agent.id}`, {
                method: "PUT",
                token: token ?? undefined,
                body: { status: "inactive" },
              });
              load();
            } catch {
              Alert.alert("Erreur", "Impossible de désactiver l'agent");
            }
          },
        },
      ]
    );
  }

  /* ─── Stats rapides ──────────────────────────────────────── */
  const stats = {
    total:        agents.length,
    embarquement: agents.filter(a => a.agentRole === "agent_embarquement" || a.agentRole === "embarquement").length,
    colis:        agents.filter(a => a.agentRole === "agent_colis" || a.agentRole === "reception_colis").length,
    guichet:      agents.filter(a => a.agentRole === "agent_guichet" || a.agentRole === "agent_ticket" || a.agentRole === "vente").length,
    actifs:       agents.filter(a => a.status === "active").length,
  };

  /* ─── Render ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <SafeAreaView style={S.root} edges={["top"]}>
      {/* Header */}
      <LinearGradient colors={[PRIMARY, "#1A5C8A"]} style={S.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/entreprise/dashboard")} style={S.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={S.headerText}>
          <Text style={S.headerTitle}>Gestion des Agents</Text>
          <Text style={S.headerSub}>{stats.actifs} actif{stats.actifs > 1 ? "s" : ""} · {stats.total} total</Text>
        </View>
        <Pressable onPress={() => setShowModal(true)} style={S.addBtn}>
          <Feather name="user-plus" size={18} color="#fff" />
        </Pressable>
      </LinearGradient>

      {/* Stats */}
      <View style={S.statsRow}>
        <StatCard label="Total" value={stats.total} color={PRIMARY} icon="users" />
        <StatCard label="Embarquement" value={stats.embarquement} color={GREEN} icon="check-square" />
        <StatCard label="Colis" value={stats.colis} color={PURPLE} icon="package" />
        <StatCard label="Guichet" value={stats.guichet} color={AMBER} icon="credit-card" />
      </View>

      {/* Liste */}
      <ScrollView
        style={S.list}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        {agents.length === 0 ? (
          <View style={S.empty}>
            <Feather name="users" size={48} color="#CBD5E1" />
            <Text style={S.emptyTitle}>Aucun agent</Text>
            <Text style={S.emptySub}>Appuyez sur + pour créer votre premier agent</Text>
            <Pressable onPress={() => setShowModal(true)} style={S.emptyBtn}>
              <Feather name="user-plus" size={16} color="#fff" />
              <Text style={S.emptyBtnText}>Créer un agent</Text>
            </Pressable>
          </View>
        ) : (
          agents.map(agent => <AgentCard key={agent.id} agent={agent} onDeactivate={confirmDeactivate} />)
        )}
      </ScrollView>

      {/* Modal création */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={S.modalOverlay}>
          <View style={S.modalSheet}>
            <View style={S.modalHandle} />
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>Nouvel Agent</Text>
              <Pressable onPress={() => { setShowModal(false); setFormErrors({}); }} hitSlop={8}>
                <Feather name="x" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Nom */}
              <FieldLabel label="Nom complet" required />
              <TextInput
                style={[S.input, formErrors.name && S.inputError]}
                placeholder="Ex: Kouassi Jean"
                value={form.name}
                onChangeText={v => setForm(f => ({ ...f, name: v }))}
                autoCapitalize="words"
              />
              {formErrors.name && <Text style={S.errorText}>{formErrors.name}</Text>}

              {/* Email */}
              <FieldLabel label="Email" required />
              <TextInput
                style={[S.input, formErrors.email && S.inputError]}
                placeholder="agent@email.com"
                value={form.email}
                onChangeText={v => setForm(f => ({ ...f, email: v }))}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {formErrors.email && <Text style={S.errorText}>{formErrors.email}</Text>}

              {/* Téléphone */}
              <FieldLabel label="Téléphone (optionnel)" />
              <TextInput
                style={S.input}
                placeholder="+225 07 00 00 00 00"
                value={form.phone}
                onChangeText={v => setForm(f => ({ ...f, phone: v }))}
                keyboardType="phone-pad"
              />

              {/* Mot de passe */}
              <FieldLabel label="Mot de passe" required />
              <TextInput
                style={[S.input, formErrors.password && S.inputError]}
                placeholder="Minimum 6 caractères"
                value={form.password}
                onChangeText={v => setForm(f => ({ ...f, password: v }))}
                secureTextEntry
              />
              {formErrors.password && <Text style={S.errorText}>{formErrors.password}</Text>}

              {/* Rôle */}
              <FieldLabel label="Rôle" required />
              {formErrors.agentRole && <Text style={S.errorText}>{formErrors.agentRole}</Text>}
              <View style={S.roleGrid}>
                {AGENT_ROLES.map(r => (
                  <Pressable
                    key={r.value}
                    style={[S.roleCard, form.agentRole === r.value && { borderColor: r.color, backgroundColor: r.color + "18" }]}
                    onPress={() => setForm(f => ({ ...f, agentRole: r.value }))}
                  >
                    <Feather name={r.icon} size={20} color={form.agentRole === r.value ? r.color : "#94A3B8"} />
                    <Text style={[S.roleCardText, form.agentRole === r.value && { color: r.color }]}>{r.label}</Text>
                    {form.agentRole === r.value && (
                      <View style={[S.roleCheck, { backgroundColor: r.color }]}>
                        <Feather name="check" size={10} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>

              {/* Agence */}
              <FieldLabel label="Agence (optionnel)" />
              <View style={S.agenceList}>
                <Pressable
                  style={[S.agenceChip, !form.agenceId && S.agenceChipActive]}
                  onPress={() => setForm(f => ({ ...f, agenceId: "" }))}
                >
                  <Text style={[S.agenceChipText, !form.agenceId && S.agenceChipTextActive]}>Aucune</Text>
                </Pressable>
                {agences.map(a => (
                  <Pressable
                    key={a.id}
                    style={[S.agenceChip, form.agenceId === a.id && S.agenceChipActive]}
                    onPress={() => setForm(f => ({ ...f, agenceId: a.id }))}
                  >
                    <Feather name="map-pin" size={12} color={form.agenceId === a.id ? "#fff" : "#64748B"} />
                    <Text style={[S.agenceChipText, form.agenceId === a.id && S.agenceChipTextActive]}>
                      {a.name} · {a.city}
                    </Text>
                  </Pressable>
                ))}
                {agences.length === 0 && (
                  <Text style={S.noAgenceText}>Aucune agence configurée. Créez d'abord une agence.</Text>
                )}
              </View>

              <Pressable
                style={[S.createBtn, saving && S.createBtnDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Feather name="user-plus" size={16} color="#fff" />
                      <Text style={S.createBtnText}>Créer l'agent</Text>
                    </>
                }
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── Carte agent ────────────────────────────────────────────── */
function AgentCard({ agent, onDeactivate }: { agent: AgentItem; onDeactivate: (a: AgentItem) => void }) {
  const colors = roleColors(agent.agentRole);
  const label  = roleLabel(agent.agentRole);
  const isActive = agent.status === "active";

  return (
    <View style={[S.card, !isActive && S.cardInactive]}>
      <View style={S.cardLeft}>
        <View style={[S.avatar, { backgroundColor: colors.bg }]}>
          <Text style={[S.avatarText, { color: colors.text }]}>
            {(agent.name ?? "?").charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={S.cardBody}>
        <View style={S.cardRow}>
          <Text style={S.cardName} numberOfLines={1}>{agent.name}</Text>
          <View style={[S.badge, { backgroundColor: isActive ? "#DCFCE7" : "#FEE2E2" }]}>
            <Text style={[S.badgeText, { color: isActive ? GREEN : "#DC2626" }]}>
              {isActive ? "Actif" : "Inactif"}
            </Text>
          </View>
        </View>

        <Text style={S.cardEmail} numberOfLines={1}>{agent.email}</Text>

        <View style={S.cardRow}>
          <View style={[S.rolePill, { backgroundColor: colors.bg }]}>
            <Text style={[S.rolePillText, { color: colors.text }]}>{label}</Text>
          </View>
          {agent.agenceName ? (
            <View style={S.agencePill}>
              <Feather name="map-pin" size={10} color="#64748B" />
              <Text style={S.agencePillText} numberOfLines={1}>{agent.agenceName}</Text>
            </View>
          ) : null}
        </View>

        <Text style={S.cardCode}>{agent.agentCode}</Text>
      </View>

      {isActive && (
        <Pressable onPress={() => onDeactivate(agent)} style={S.cardAction} hitSlop={8}>
          <Feather name="more-vertical" size={18} color="#94A3B8" />
        </Pressable>
      )}
    </View>
  );
}

/* ─── Sous-composants ────────────────────────────────────────── */
function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <View style={[S.statCard, { borderTopColor: color }]}>
      <Feather name={icon} size={16} color={color} />
      <Text style={[S.statValue, { color }]}>{value}</Text>
      <Text style={S.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={S.fieldLabel}>
      {label}{required && <Text style={{ color: "#EF4444" }}> *</Text>}
    </Text>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const S = StyleSheet.create({
  root:  { flex: 1, backgroundColor: "#F8FAFC" },
  center:{ flex: 1, justifyContent: "center", alignItems: "center" },

  header:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn:   { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerText:{ flex: 1 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  headerSub:   { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 1 },
  addBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },

  statsRow: { flexDirection: "row", padding: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 10, alignItems: "center", borderTopWidth: 3, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 2, gap: 4 },
  statValue:{ fontSize: 20, fontWeight: "800" },
  statLabel:{ fontSize: 9, color: "#64748B", textAlign: "center" },

  list: { flex: 1, paddingHorizontal: 12 },

  card:        { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", gap: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardInactive:{ opacity: 0.55 },
  cardLeft:    { justifyContent: "flex-start" },
  cardBody:    { flex: 1, gap: 4 },
  cardRow:     { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardAction:  { justifyContent: "center", paddingLeft: 4 },

  avatar:     { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 18, fontWeight: "800" },

  cardName:  { fontSize: 15, fontWeight: "700", color: "#0F172A", flex: 1 },
  cardEmail: { fontSize: 12, color: "#64748B" },
  cardCode:  { fontSize: 11, color: "#94A3B8", marginTop: 2 },

  badge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "600" },

  rolePill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  rolePillText:{ fontSize: 11, fontWeight: "700" },

  agencePill:     { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F1F5F9", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  agencePillText: { fontSize: 11, color: "#64748B" },

  empty:       { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle:  { fontSize: 18, fontWeight: "700", color: "#475569" },
  emptySub:    { fontSize: 14, color: "#94A3B8", textAlign: "center" },
  emptyBtn:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText:{ color: "#fff", fontSize: 14, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:   { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%", paddingBottom: 40 },
  modalHandle:  { width: 40, height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: "800", color: "#0F172A" },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  input:      { backgroundColor: "#F8FAFC", borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: "#0F172A" },
  inputError: { borderColor: "#EF4444" },
  errorText:  { fontSize: 11, color: "#EF4444", marginTop: 3 },

  roleGrid:     { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  roleCard:     { flex: 1, minWidth: "30%", borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, alignItems: "center", gap: 6, position: "relative" },
  roleCardText: { fontSize: 11, fontWeight: "600", color: "#64748B", textAlign: "center" },
  roleCheck:    { position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: 8, justifyContent: "center", alignItems: "center" },

  agenceList:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  agenceChip:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "#E2E8F0" },
  agenceChipActive:  { backgroundColor: PRIMARY, borderColor: PRIMARY },
  agenceChipText:    { fontSize: 12, color: "#64748B", fontWeight: "600" },
  agenceChipTextActive: { color: "#fff" },
  noAgenceText:      { fontSize: 12, color: "#94A3B8", fontStyle: "italic" },

  createBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 15, marginTop: 24 },
  createBtnDisabled:{ opacity: 0.6 },
  createBtnText:    { color: "#fff", fontSize: 16, fontWeight: "800" },
});
