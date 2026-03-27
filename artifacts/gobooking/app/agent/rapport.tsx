import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const ROSE = "#BE123C";
const ROSE_LT = "#FFF1F2";

const REPORT_TYPES: { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>["name"]; color: string }[] = [
  { key: "incident_voyage",     label: "Incident durant le voyage",    icon: "warning-outline",          color: "#DC2626" },
  { key: "probleme_colis",      label: "Problème avec un colis",       icon: "cube-outline",              color: "#EA580C" },
  { key: "probleme_passager",   label: "Problème avec un passager",    icon: "person-outline",            color: "#D97706" },
  { key: "probleme_vehicule",   label: "Problème véhicule / panne",    icon: "bus-outline",               color: "#7C3AED" },
  { key: "fraude",              label: "Suspicion de fraude",          icon: "shield-outline",            color: "#B91C1C" },
  { key: "retard",              label: "Retard important",             icon: "time-outline",              color: "#0369A1" },
  { key: "suggestion",          label: "Suggestion d'amélioration",    icon: "bulb-outline",              color: "#059669" },
  { key: "autre",               label: "Autre",                        icon: "document-text-outline",     color: "#475569" },
];

interface Report {
  id: string;
  reportType: string;
  description: string;
  statut: string;
  createdAt: string;
  relatedId?: string;
}

const STATUT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  soumis:    { label: "Soumis",    color: "#D97706", bg: "#FEF9C3" },
  lu:        { label: "Lu",        color: "#2563EB", bg: "#DBEAFE" },
  en_cours:  { label: "En cours",  color: "#7C3AED", bg: "#EDE9FE" },
  traite:    { label: "Traité ✓",  color: "#059669", bg: "#DCFCE7" },
  rejete:    { label: "Rejeté",    color: "#DC2626", bg: "#FEE2E2" },
};

export default function RapportScreen() {
  const { token, logoutIfActiveToken } = useAuth();
  const [tab, setTab] = useState<"creer" | "historique">("creer");

  const [reportType, setReportType] = useState("");
  const [description, setDescription] = useState("");
  const [relatedId, setRelatedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    if (!token) { setLoadingReports(false); return; }
    try {
      const data = await apiFetch<Report[]>("/agent/reports", { token });
      setReports(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e?.httpStatus === 401) {
        logoutIfActiveToken(token ?? ""); return;
      }
      setReports([]);
    } finally { setLoadingReports(false); setRefreshing(false); }
  }, [token, logoutIfActiveToken]);

  useEffect(() => {
    if (tab === "historique") { setLoadingReports(true); loadReports(); }
  }, [tab, loadReports]);

  const handleSubmit = async () => {
    if (!reportType) { setErrorMsg("Choisissez un type de rapport"); return; }
    if (!description.trim() || description.trim().length < 10) {
      setErrorMsg("La description doit faire au moins 10 caractères"); return;
    }
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await apiFetch("/agent/reports", {
        token: token ?? undefined,
        method: "POST",
        body: JSON.stringify({ reportType, description: description.trim(), relatedId: relatedId.trim() || undefined }),
      });
      setSuccessMsg("Rapport envoyé avec succès à la direction.");
      setReportType("");
      setDescription("");
      setRelatedId("");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Erreur réseau");
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={S.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#9F1239" />

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Rapports</Text>
          <Text style={S.headerSub}>Signaler un incident ou une suggestion</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={S.tabs}>
        <TouchableOpacity style={[S.tabBtn, tab === "creer" && S.tabBtnActive]} onPress={() => setTab("creer")}>
          <Ionicons name="add-circle-outline" size={14} color={tab === "creer" ? "#fff" : "rgba(255,255,255,0.6)"} />
          <Text style={[S.tabTxt, tab === "creer" && S.tabTxtActive]}>Nouveau</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tabBtn, tab === "historique" && S.tabBtnActive]} onPress={() => setTab("historique")}>
          <Ionicons name="time-outline" size={14} color={tab === "historique" ? "#fff" : "rgba(255,255,255,0.6)"} />
          <Text style={[S.tabTxt, tab === "historique" && S.tabTxtActive]}>Historique</Text>
        </TouchableOpacity>
      </View>

      {tab === "creer" ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {successMsg !== "" && (
            <View style={{ backgroundColor: "#DCFCE7", borderRadius: 12, padding: 14, flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Ionicons name="checkmark-circle" size={22} color="#15803D" />
              <Text style={{ color: "#14532D", fontWeight: "700", flex: 1 }}>{successMsg}</Text>
              <TouchableOpacity onPress={() => setSuccessMsg("")}><Ionicons name="close" size={18} color="#6B7280" /></TouchableOpacity>
            </View>
          )}
          {errorMsg !== "" && (
            <View style={{ backgroundColor: "#FEE2E2", borderRadius: 12, padding: 14, flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Ionicons name="alert-circle" size={22} color="#DC2626" />
              <Text style={{ color: "#7F1D1D", fontWeight: "700", flex: 1 }}>{errorMsg}</Text>
              <TouchableOpacity onPress={() => setErrorMsg("")}><Ionicons name="close" size={18} color="#6B7280" /></TouchableOpacity>
            </View>
          )}

          <View style={S.section}>
            <Text style={S.sectionTitle}>Type de rapport *</Text>
            <View style={{ gap: 8 }}>
              {REPORT_TYPES.map(rt => (
                <TouchableOpacity
                  key={rt.key}
                  style={[S.typeOption, reportType === rt.key && { borderColor: rt.color, borderWidth: 2, backgroundColor: rt.color + "12" }]}
                  onPress={() => setReportType(rt.key)}>
                  <Ionicons name={rt.icon} size={20} color={reportType === rt.key ? rt.color : "#9CA3AF"} />
                  <Text style={[S.typeLabel, { color: reportType === rt.key ? rt.color : "#374151" }]}>{rt.label}</Text>
                  {reportType === rt.key && <Ionicons name="checkmark-circle" size={20} color={rt.color} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={S.section}>
            <Text style={S.sectionTitle}>Description * (min. 10 car.)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Décrivez précisément l'incident, la situation ou la suggestion..."
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              style={S.textarea}
            />
            <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>{description.length} caractère(s)</Text>
          </View>

          <View style={S.section}>
            <Text style={S.sectionTitle}>Référence liée (optionnel)</Text>
            <TextInput
              value={relatedId}
              onChangeText={setRelatedId}
              placeholder="N° de billet, tracking colis, ID voyage..."
              style={S.input}
            />
          </View>

          <TouchableOpacity
            style={[S.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}>
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Feather name="send" size={18} color="#fff" />
                  <Text style={S.submitBtnText}>Envoyer le rapport</Text>
                </>
            }
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} />}>
          {loadingReports ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40 }}>
              <ActivityIndicator color={ROSE} size="large" />
            </View>
          ) : reports.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 50, gap: 12 }}>
              <Ionicons name="document-text-outline" size={52} color="#D1D5DB" />
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#374151" }}>Aucun rapport envoyé</Text>
              <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center" }}>Vos rapports apparaîtront ici une fois soumis</Text>
            </View>
          ) : reports.map(report => {
            const rt = REPORT_TYPES.find(r => r.key === report.reportType);
            const st = STATUT_STYLE[report.statut] ?? STATUT_STYLE.soumis;
            const date = new Date(report.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
            return (
              <View key={report.id} style={S.reportCard}>
                <View style={S.reportCardHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name={rt?.icon ?? "document-text-outline"} size={20} color={rt?.color ?? "#374151"} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: rt?.color ?? "#374151", flex: 1 }}>{rt?.label ?? report.reportType}</Text>
                  </View>
                  <View style={{ backgroundColor: st.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: st.color }}>{st.label}</Text>
                  </View>
                </View>
                <View style={S.reportCardBody}>
                  <Text style={{ fontSize: 13, color: "#374151", lineHeight: 20 }} numberOfLines={3}>{report.description}</Text>
                  {report.relatedId && (
                    <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Réf: {report.relatedId}</Text>
                  )}
                  <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>Soumis le {date}</Text>
                </View>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: "#F8FAFC" },

  header:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#9F1239", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub:   { color: "rgba(255,255,255,0.75)", fontSize: 12 },

  tabs:         { flexDirection: "row", backgroundColor: "#9F1239" },
  tabBtn:       { flex: 1, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  tabBtnActive: { borderBottomWidth: 3, borderColor: "#FECDD3" },
  tabTxt:       { fontSize: 14, color: "#FECDD3", fontWeight: "600" },
  tabTxtActive: { color: "#fff", fontWeight: "800" },

  section:       { backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  sectionTitle:  { fontSize: 14, fontWeight: "800", color: "#0F172A" },

  typeOption:  { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#FAFAFA" },
  typeLabel:   { flex: 1, fontSize: 14, fontWeight: "600" },

  textarea: { backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", padding: 12, fontSize: 14, minHeight: 120, lineHeight: 22 },
  input:    { backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", padding: 12, fontSize: 14 },

  submitBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: ROSE, borderRadius: 14, paddingVertical: 16, shadowColor: ROSE, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  reportCard:       { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" },
  reportCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottomWidth: 1, borderColor: "#F1F5F9", backgroundColor: "#FAFAFA" },
  reportCardBody:   { padding: 12 },
});
