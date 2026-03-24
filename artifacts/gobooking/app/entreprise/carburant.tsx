import { Feather } from "@expo/vector-icons";
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
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const PRIMARY = "#0B3C5D";
const FUEL_GREEN = "#16A34A";

interface FuelLog {
  id: string;
  busId: string;
  busName: string;
  plateNumber: string;
  busType: string;
  amount: string;
  cost: number;
  date: string;
  notes: string | null;
}

interface Bus {
  id: string;
  busName: string;
  plateNumber: string;
}

function formatDate(d: string) {
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
}

function formatFCFA(n: number) {
  return n.toLocaleString("fr-FR") + " FCFA";
}

export default function CarburantScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [totalLitres, setTotalLitres] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selBus, setSelBus] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showBusPicker, setShowBusPicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [fuelData, busData] = await Promise.all([
        apiFetch("/company/fuel-logs", { token: token! }),
        apiFetch("/company/buses", { token: token! }),
      ]);
      setLogs(Array.isArray(fuelData?.logs) ? fuelData.logs : []);
      setTotalLitres(fuelData?.totalLitres ?? 0);
      setTotalCost(fuelData?.totalCost ?? 0);
      setBuses(Array.isArray(busData) ? busData.map((b: any) => ({
        id: b.id, busName: b.busName ?? b.bus_name, plateNumber: b.plateNumber ?? b.plate_number,
      })) : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const openAdd = () => {
    setSelBus(buses[0]?.id ?? "");
    setAmount("");
    setCost("");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setShowModal(true);
  };

  const save = async () => {
    if (!selBus || !amount || !cost) {
      Alert.alert("Champs requis", "Veuillez sélectionner un bus, saisir les litres et le coût.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/company/fuel-logs", {
        method: "POST", token: token!,
        body: { busId: selBus, amount: parseFloat(amount), cost: parseInt(cost), date, notes: notes || null },
      });
      setShowModal(false);
      fetchData();
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer le plein.");
    } finally {
      setSaving(false);
    }
  };

  const deleteLog = (id: string) => {
    Alert.alert("Supprimer", "Confirmer la suppression de cette entrée ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/company/fuel-logs/${id}`, { method: "DELETE", token: token! });
            fetchData();
          } catch {
            Alert.alert("Erreur", "Impossible de supprimer cette entrée.");
          }
        },
      },
    ]);
  };

  const selectedBus = buses.find(b => b.id === selBus);

  return (
    <SafeAreaView style={S.root} edges={["bottom"]}>
      <LinearGradient colors={[PRIMARY, "#1E5F8A"]} style={[S.header, { paddingTop: insets.top + 12 }]}>
        <View style={S.headerRow}>
          <Pressable onPress={() => router.back()} style={S.iconBtn}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle}>Gestion du Carburant</Text>
            <Text style={S.headerSub}>{logs.length} enregistrement{logs.length !== 1 ? "s" : ""}</Text>
          </View>
          <Pressable onPress={openAdd} style={[S.iconBtn, { backgroundColor: FUEL_GREEN }]}>
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={S.kpiRow}>
          <View style={S.kpiCard}>
            <Feather name="droplet" size={18} color="#22C55E" />
            <Text style={S.kpiValue}>{parseFloat(String(totalLitres)).toFixed(0)} L</Text>
            <Text style={S.kpiLabel}>Total litres</Text>
          </View>
          <View style={S.kpiDivider} />
          <View style={S.kpiCard}>
            <Feather name="credit-card" size={18} color="#F59E0B" />
            <Text style={S.kpiValue}>{formatFCFA(totalCost)}</Text>
            <Text style={S.kpiLabel}>Total dépenses</Text>
          </View>
          {logs.length > 0 && (
            <>
              <View style={S.kpiDivider} />
              <View style={S.kpiCard}>
                <Feather name="trending-up" size={18} color="#A78BFA" />
                <Text style={S.kpiValue}>{(totalCost / parseFloat(String(totalLitres || 1))).toFixed(0)}</Text>
                <Text style={S.kpiLabel}>FCFA/litre</Text>
              </View>
            </>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={S.loadingText}>Chargement…</Text>
        </View>
      ) : logs.length === 0 ? (
        <View style={S.center}>
          <View style={S.emptyIcon}><Text style={{ fontSize: 38 }}>⛽</Text></View>
          <Text style={S.emptyTitle}>Aucun enregistrement</Text>
          <Text style={S.emptySub}>Appuyez sur + pour saisir un plein de carburant.</Text>
          <Pressable style={S.addEmptyBtn} onPress={openAdd}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={S.addEmptyText}>Ajouter un plein</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={S.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {logs.map(log => (
            <View key={log.id} style={S.card}>
              <View style={S.cardLeft}>
                <View style={S.fuelIcon}>
                  <Text style={{ fontSize: 20 }}>⛽</Text>
                </View>
                <View style={S.cardInfo}>
                  <Text style={S.cardBus}>{log.busName}</Text>
                  <Text style={S.cardPlate}>{log.plateNumber}</Text>
                  <Text style={S.cardDate}>{formatDate(log.date)}</Text>
                  {log.notes ? <Text style={S.cardNotes} numberOfLines={1}>{log.notes}</Text> : null}
                </View>
              </View>
              <View style={S.cardRight}>
                <View style={S.litresBadge}>
                  <Text style={S.litresVal}>{parseFloat(log.amount).toFixed(0)} L</Text>
                </View>
                <Text style={S.costVal}>{formatFCFA(log.cost)}</Text>
                <Pressable onPress={() => deleteLog(log.id)} style={S.delBtn}>
                  <Feather name="trash-2" size={14} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <Pressable style={S.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={S.sheet} onPress={e => e.stopPropagation()}>
            <View style={S.handle} />
            <Text style={S.sheetTitle}>Nouveau plein de carburant</Text>

            <Text style={S.label}>Véhicule</Text>
            <Pressable style={S.selector} onPress={() => setShowBusPicker(true)}>
              <Feather name="truck" size={15} color="#64748B" />
              <Text style={[S.selectorText, !selBus && { color: "#CBD5E1" }]}>
                {selectedBus ? `${selectedBus.busName} · ${selectedBus.plateNumber}` : "Sélectionner un bus"}
              </Text>
              <Feather name="chevron-down" size={15} color="#94A3B8" />
            </Pressable>

            <View style={S.row}>
              <View style={{ flex: 1 }}>
                <Text style={S.label}>Quantité (litres)</Text>
                <View style={S.inputWrap}>
                  <Feather name="droplet" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                  <TextInput
                    style={S.input}
                    placeholder="Ex: 50"
                    placeholderTextColor="#CBD5E1"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={S.label}>Coût (FCFA)</Text>
                <View style={S.inputWrap}>
                  <Feather name="credit-card" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
                  <TextInput
                    style={S.input}
                    placeholder="Ex: 45000"
                    placeholderTextColor="#CBD5E1"
                    value={cost}
                    onChangeText={setCost}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <Text style={S.label}>Date</Text>
            <View style={S.inputWrap}>
              <Feather name="calendar" size={14} color="#94A3B8" style={{ marginRight: 6 }} />
              <TextInput
                style={S.input}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor="#CBD5E1"
                value={date}
                onChangeText={setDate}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <Text style={S.label}>Notes (optionnel)</Text>
            <View style={S.inputWrap}>
              <TextInput
                style={S.input}
                placeholder="Ex: Station Total Cocody"
                placeholderTextColor="#CBD5E1"
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            {amount && cost ? (
              <View style={S.preview}>
                <Feather name="info" size={13} color="#3B82F6" />
                <Text style={S.previewText}>
                  {parseFloat(amount).toFixed(0)} L · {parseInt(cost).toLocaleString("fr-FR")} FCFA ={" "}
                  <Text style={{ fontWeight: "700" }}>
                    {(parseInt(cost) / parseFloat(amount || "1")).toFixed(0)} FCFA/L
                  </Text>
                </Text>
              </View>
            ) : null}

            <View style={S.sheetBtns}>
              <Pressable style={S.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={S.cancelText}>Annuler</Text>
              </Pressable>
              <Pressable style={[S.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Feather name="check" size={15} color="#fff" /><Text style={S.saveText}>Enregistrer</Text></>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showBusPicker} transparent animationType="slide" onRequestClose={() => setShowBusPicker(false)}>
        <Pressable style={S.overlay} onPress={() => setShowBusPicker(false)}>
          <Pressable style={[S.sheet, { paddingBottom: 24 }]} onPress={e => e.stopPropagation()}>
            <View style={S.handle} />
            <Text style={S.sheetTitle}>Choisir un véhicule</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {buses.map(b => (
                <Pressable
                  key={b.id}
                  style={[S.busOption, selBus === b.id && { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
                  onPress={() => { setSelBus(b.id); setShowBusPicker(false); }}
                >
                  <Text style={{ fontSize: 18 }}>🚌</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={S.busOptName}>{b.busName}</Text>
                    <Text style={S.busOptPlate}>{b.plateNumber}</Text>
                  </View>
                  {selBus === b.id && <Feather name="check" size={16} color="#3B82F6" />}
                </Pressable>
              ))}
            </ScrollView>
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

  kpiRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 14, padding: 14, gap: 0 },
  kpiCard: { flex: 1, alignItems: "center", gap: 4 },
  kpiDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.15)" },
  kpiValue: { fontSize: 17, fontWeight: "800", color: "#fff" },
  kpiLabel: { fontSize: 10, color: "rgba(255,255,255,0.75)", textAlign: "center" },

  list: { padding: 16, gap: 10 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#0B3C5D", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  fuelIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  cardBus: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  cardPlate: { fontSize: 12, color: "#64748B", marginTop: 1 },
  cardDate: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  cardNotes: { fontSize: 11, color: "#94A3B8", fontStyle: "italic", marginTop: 1 },
  cardRight: { alignItems: "flex-end", gap: 4 },
  litresBadge: { backgroundColor: "#F0FDF4", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  litresVal: { fontSize: 13, fontWeight: "700", color: FUEL_GREEN },
  costVal: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  delBtn: { padding: 4 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { fontSize: 14, color: "#94A3B8", marginTop: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  emptySub: { fontSize: 14, color: "#94A3B8", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  addEmptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 12 },
  addEmptyText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginBottom: 16 },

  label: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },

  selector: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 13 },
  selectorText: { flex: 1, fontSize: 14, color: "#0F172A" },

  row: { flexDirection: "row" },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 12 },
  input: { flex: 1, fontSize: 14, color: "#0F172A" },

  preview: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EFF6FF", borderRadius: 10, padding: 10, marginTop: 12 },
  previewText: { fontSize: 13, color: "#1E40AF" },

  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  cancelText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: FUEL_GREEN, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  saveText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  busOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  busOptName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  busOptPlate: { fontSize: 12, color: "#94A3B8", marginTop: 1 },
});
