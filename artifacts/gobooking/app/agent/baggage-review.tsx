import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Modal,
  Dimensions, RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const G = "#166534";
const G_LIGHT = "#DCFCE7";
const G_DARK = "#14532D";
const SCREEN_W = Dimensions.get("window").width;

interface PendingBaggage {
  id: string;
  bookingRef: string;
  baggageCount: number;
  baggagePhotos: string[];
  baggageStatus: string;
  passenger: string;
  fromCity: string;
  toCity: string;
  departureDate: string | null;
  seatNumbers: string[];
}

export default function AgentBaggageReviewScreen() {
  const { token } = useAuth();

  const [pendingList, setPendingList] = useState<PendingBaggage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedBooking, setSelectedBooking] = useState<PendingBaggage | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [refusalNote, setRefusalNote] = useState("");
  const [showRefusalInput, setShowRefusalInput] = useState(false);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await apiFetch<PendingBaggage[]>("/bookings/pending-baggage", { token });
      setPendingList(data ?? []);
    } catch {
      if (!silent) Alert.alert("Erreur", "Impossible de charger les bagages en attente.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async (decision: "accepté" | "refusé") => {
    if (!selectedBooking || !token) return;
    if (decision === "refusé" && !showRefusalInput) {
      setShowRefusalInput(true);
      return;
    }
    if (decision === "refusé" && !refusalNote.trim()) {
      Alert.alert("Note obligatoire", "Veuillez saisir un motif de refus.");
      return;
    }
    setProcessing(true);
    try {
      await apiFetch(`/bookings/${selectedBooking.id}/baggage-review`, {
        token,
        method: "POST",
        body: JSON.stringify({ decision, note: refusalNote || undefined }),
      });
      Alert.alert(
        decision === "accepté" ? "Bagages acceptés ✓" : "Bagages refusés",
        decision === "accepté"
          ? "Les bagages ont été validés avec succès."
          : "Le passager sera informé du refus.",
      );
      setSelectedBooking(null);
      setShowRefusalInput(false);
      setRefusalNote("");
      load(true);
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer la décision.");
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={G} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Feather name="package" size={18} color={G} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Validation bagages</Text>
            <Text style={styles.headerSub}>
              {pendingList.length} en attente
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => load(true)}>
          <Feather name="refresh-cw" size={16} color={G} />
        </TouchableOpacity>
      </View>

      {pendingList.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="check-circle" size={40} color={G} />
          </View>
          <Text style={styles.emptyTitle}>Aucun bagage en attente</Text>
          <Text style={styles.emptySub}>Tous les bagages ont été traités.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={G} />}
        >
          {pendingList.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => { setSelectedBooking(item); setShowRefusalInput(false); setRefusalNote(""); }}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={styles.refBadge}>
                  <Text style={styles.refText}>{item.bookingRef}</Text>
                </View>
                <View style={styles.baggagePill}>
                  <Feather name="briefcase" size={11} color="#92400E" />
                  <Text style={styles.baggagePillText}>{item.baggageCount} bagage{item.baggageCount > 1 ? "s" : ""}</Text>
                </View>
              </View>

              <Text style={styles.passengerName}>{item.passenger}</Text>
              <Text style={styles.routeText}>{item.fromCity} → {item.toCity}</Text>
              <Text style={styles.dateText}>{formatDate(item.departureDate)}</Text>

              {item.baggagePhotos.length > 0 && (
                <View style={styles.thumbRow}>
                  {item.baggagePhotos.slice(0, 4).map((uri, idx) => (
                    <Image key={idx} source={{ uri }} style={styles.thumb} contentFit="cover" />
                  ))}
                  {item.baggagePhotos.length > 4 && (
                    <View style={[styles.thumb, styles.moreThumb]}>
                      <Text style={styles.moreText}>+{item.baggagePhotos.length - 4}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.quickBtn, styles.quickBtnAccept]}
                  onPress={async () => {
                    setSelectedBooking(item);
                    setShowRefusalInput(false);
                    setRefusalNote("");
                    await handleDecision("accepté");
                  }}
                >
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={styles.quickBtnText}>Accepter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickBtn, styles.quickBtnView]}
                  onPress={() => { setSelectedBooking(item); setShowRefusalInput(false); setRefusalNote(""); }}
                >
                  <Feather name="eye" size={14} color={G} />
                  <Text style={[styles.quickBtnText, { color: G }]}>Voir</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedBooking} animationType="slide" onRequestClose={() => setSelectedBooking(null)}>
        {selectedBooking && (
          <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
            <StatusBar barStyle="dark-content" />

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedBooking(null)} style={styles.backBtn}>
                <Feather name="x" size={20} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Vérification bagages</Text>
              <View style={styles.baggagePill}>
                <Feather name="briefcase" size={11} color="#92400E" />
                <Text style={styles.baggagePillText}>{selectedBooking.baggageCount} bagage{selectedBooking.baggageCount > 1 ? "s" : ""}</Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              {/* Booking Info */}
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Réservation</Text>
                <Text style={styles.infoValue}>{selectedBooking.bookingRef}</Text>
                <Text style={styles.infoLabel}>Passager</Text>
                <Text style={styles.infoValue}>{selectedBooking.passenger}</Text>
                <Text style={styles.infoLabel}>Trajet</Text>
                <Text style={styles.infoValue}>{selectedBooking.fromCity} → {selectedBooking.toCity}</Text>
                <Text style={styles.infoLabel}>Date de départ</Text>
                <Text style={styles.infoValue}>{formatDate(selectedBooking.departureDate)}</Text>
                {selectedBooking.seatNumbers?.length > 0 && (
                  <>
                    <Text style={styles.infoLabel}>Sièges</Text>
                    <Text style={styles.infoValue}>{selectedBooking.seatNumbers.join(", ")}</Text>
                  </>
                )}
              </View>

              {/* Photos */}
              <Text style={styles.sectionTitle}>Photos des bagages ({selectedBooking.baggagePhotos.length})</Text>
              {selectedBooking.baggagePhotos.length === 0 ? (
                <View style={styles.noPhotosCard}>
                  <Feather name="camera-off" size={24} color="#9CA3AF" />
                  <Text style={styles.noPhotosText}>Aucune photo fournie</Text>
                </View>
              ) : (
                <View style={styles.photosGrid}>
                  {selectedBooking.baggagePhotos.map((uri, idx) => (
                    <TouchableOpacity key={idx} onPress={() => setZoomPhoto(uri)} style={styles.photoCell}>
                      <Image source={{ uri }} style={styles.photoFull} contentFit="cover" />
                      <View style={styles.photoNum}>
                        <Text style={styles.photoNumText}>{idx + 1}</Text>
                      </View>
                      <View style={styles.zoomIcon}>
                        <Feather name="maximize-2" size={10} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Instructions */}
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionsTitle}>Instructions de vérification</Text>
                <Text style={styles.instructionItem}>• Vérifiez que le nombre de bagages correspond ({selectedBooking.baggageCount} bagage{selectedBooking.baggageCount > 1 ? "s" : ""})</Text>
                <Text style={styles.instructionItem}>• Confirmez que les photos montrent bien les bagages réels</Text>
                <Text style={styles.instructionItem}>• Refusez si les photos sont floues ou ne montrent pas les bagages</Text>
                <Text style={styles.instructionItem}>• En cas de doute, demandez au passager de montrer ses bagages physiquement</Text>
              </View>

              {/* Refusal Note Input */}
              {showRefusalInput && (
                <View style={styles.refusalInputCard}>
                  <Text style={styles.refusalLabel}>Motif du refus (obligatoire)</Text>
                  <TextInput
                    style={styles.refusalInput}
                    value={refusalNote}
                    onChangeText={setRefusalNote}
                    placeholder="Ex: Photos floues, nombre de bagages incorrect…"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              {showRefusalInput ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.cancelRefusalBtn]}
                    onPress={() => { setShowRefusalInput(false); setRefusalNote(""); }}
                  >
                    <Text style={styles.cancelRefusalText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.refuseBtn, processing && styles.disabledBtn]}
                    onPress={() => handleDecision("refusé")}
                    disabled={processing}
                  >
                    {processing ? <ActivityIndicator size="small" color="#fff" /> : (
                      <>
                        <Feather name="x-circle" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>Confirmer le refus</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.refuseBtn, processing && styles.disabledBtn]}
                    onPress={() => handleDecision("refusé")}
                    disabled={processing}
                  >
                    <Feather name="x-circle" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Refuser</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn, processing && styles.disabledBtn]}
                    onPress={() => handleDecision("accepté")}
                    disabled={processing}
                  >
                    {processing ? <ActivityIndicator size="small" color="#fff" /> : (
                      <>
                        <Feather name="check-circle" size={16} color="#fff" />
                        <Text style={styles.actionBtnText}>Valider les bagages</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* Full-screen photo zoom */}
      <Modal visible={!!zoomPhoto} transparent animationType="fade" onRequestClose={() => setZoomPhoto(null)}>
        <View style={styles.zoomOverlay}>
          <TouchableOpacity style={styles.zoomClose} onPress={() => setZoomPhoto(null)}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          {zoomPhoto && (
            <Image source={{ uri: zoomPhoto }} style={styles.zoomedImage} contentFit="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: G_LIGHT, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  headerSub: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: G_LIGHT, justifyContent: "center", alignItems: "center",
  },

  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: G_LIGHT,
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 6 },
  emptySub: { fontSize: 14, color: "#6B7280", textAlign: "center" },

  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: "#E5E7EB", padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  refBadge: {
    backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  refText: { fontSize: 11, fontWeight: "700", color: "#1D4ED8" },
  baggagePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFFBEB", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  baggagePillText: { fontSize: 11, fontWeight: "600", color: "#92400E" },

  passengerName: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 2 },
  routeText: { fontSize: 12, color: "#6B7280", marginBottom: 1 },
  dateText: { fontSize: 12, color: "#9CA3AF", marginBottom: 8 },

  thumbRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  thumb: { width: 52, height: 52, borderRadius: 8, overflow: "hidden", backgroundColor: "#F3F4F6" },
  moreThumb: { justifyContent: "center", alignItems: "center", backgroundColor: "#E5E7EB" },
  moreText: { fontSize: 12, fontWeight: "700", color: "#6B7280" },

  cardActions: { flexDirection: "row", gap: 8 },
  quickBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, borderRadius: 8, paddingVertical: 9,
  },
  quickBtnAccept: { backgroundColor: G },
  quickBtnView: { backgroundColor: G_LIGHT, borderWidth: 1, borderColor: "#BBF7D0" },
  quickBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  modalHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#111827" },

  modalContent: { padding: 16, gap: 14 },

  infoCard: {
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#E5E7EB", padding: 14,
  },
  infoLabel: { fontSize: 11, fontWeight: "500", color: "#9CA3AF", textTransform: "uppercase", marginTop: 6 },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#111827", marginTop: 1 },

  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 },

  noPhotosCard: {
    backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB",
    alignItems: "center", justifyContent: "center", padding: 24, gap: 8,
  },
  noPhotosText: { fontSize: 14, color: "#9CA3AF" },

  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoCell: {
    width: (SCREEN_W - 32 - 8 * 2) / 3, aspectRatio: 1,
    borderRadius: 10, overflow: "hidden", position: "relative",
    backgroundColor: "#F3F4F6",
  },
  photoFull: { width: "100%", height: "100%" },
  photoNum: {
    position: "absolute", top: 6, left: 6,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  photoNumText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  zoomIcon: {
    position: "absolute", bottom: 6, right: 6,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 4, padding: 3,
  },

  instructionsCard: {
    backgroundColor: "#FFFBEB", borderRadius: 12, borderWidth: 1, borderColor: "#FDE68A", padding: 14, gap: 5,
  },
  instructionsTitle: { fontSize: 13, fontWeight: "700", color: "#92400E", marginBottom: 4 },
  instructionItem: { fontSize: 12, color: "#78350F", lineHeight: 18 },

  refusalInputCard: {
    backgroundColor: "#FEF2F2", borderRadius: 12, borderWidth: 1, borderColor: "#FECACA", padding: 14,
  },
  refusalLabel: { fontSize: 12, fontWeight: "600", color: "#991B1B", marginBottom: 8 },
  refusalInput: {
    backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#FECACA",
    padding: 10, minHeight: 72, fontSize: 14, color: "#111827",
  },

  modalActions: {
    flexDirection: "row", gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: "#E5E7EB", backgroundColor: "#fff",
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13, borderRadius: 12,
  },
  acceptBtn: { backgroundColor: G },
  refuseBtn: { backgroundColor: "#DC2626" },
  cancelRefusalBtn: { backgroundColor: "#F3F4F6", flex: 0, paddingHorizontal: 16 },
  cancelRefusalText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  actionBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  disabledBtn: { opacity: 0.6 },

  zoomOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center", alignItems: "center",
  },
  zoomClose: {
    position: "absolute", top: 50, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center",
    zIndex: 10,
  },
  zoomedImage: { width: SCREEN_W, height: SCREEN_W * 1.2 },
});
