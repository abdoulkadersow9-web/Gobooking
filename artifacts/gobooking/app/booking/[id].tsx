import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";
import { downloadReceipt, type ReceiptData } from "@/utils/invoicePdf";

interface Booking {
  id: string;
  bookingRef: string;
  trip: {
    from: string;
    to: string;
    departureTime: string;
    arrivalTime: string;
    date: string;
    busName: string;
    busType: string;
    duration: string;
  };
  seatNumbers: string[];
  passengers: { name: string; age: number; gender: string; seatNumber: string }[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: "confirmed" | "cancelled" | "completed";
  contactEmail: string;
  contactPhone: string;
  bagages?: { id: string; type: string; poids: number; imageUrl?: string; prix: number }[];
  bagageStatus?: string | null;
  bagagePrice?: number;
  bagageNote?: string | null;
  qrCode?: string | null;
  createdAt: string;
  agentPhone?: string | null;
  agentName?: string | null;
}

const STATUS_CONFIG = {
  confirmed: { color: Colors.light.primary, bg: Colors.light.primaryLight, label: "Confirmé" },
  cancelled: { color: Colors.light.error, bg: "#FEF2F2", label: "Annulé" },
  completed: { color: Colors.light.success, bg: "#ECFDF5", label: "Terminé" },
};

const METHOD_ICONS: Record<string, { label: string; color: string }> = {
  orange: { label: "Orange Money", color: "#FF6B00" },
  mtn:    { label: "MTN MoMo",    color: "#FFCB00" },
  wave:   { label: "Wave",        color: "#1BA5E0" },
  card:   { label: "Carte bancaire", color: "#1A56DB" },
};

export default function BookingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        const data = await apiFetch<Booking>(`/bookings/${id}`, { token });
        setBooking(data);
      } catch {
        setBooking(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, token]);

  const handleCancel = () => {
    Alert.alert(
      "Annuler la réservation",
      "Êtes-vous sûr de vouloir annuler cette réservation ? Cette action est irréversible.",
      [
        { text: "Conserver", style: "cancel" },
        {
          text: "Annuler la réservation",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              const data = await apiFetch<Booking>(`/bookings/${id}/cancel`, {
                method: "POST",
                token: token!,
              });
              setBooking(data);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Impossible d'annuler la réservation";
              Alert.alert("Erreur", msg);
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleDownloadPdf = async () => {
    if (!booking) return;
    setGeneratingPdf(true);
    const baseAmount = booking.totalAmount - (booking.bagagePrice || 0);
    const receiptData: ReceiptData = {
      bookingRef: booking.bookingRef,
      transactionId: booking.id,
      clientName: user?.name ?? "Client",
      clientEmail: booking.contactEmail,
      clientPhone: booking.contactPhone,
      trip: booking.trip,
      passengers: booking.passengers,
      seatNumbers: booking.seatNumbers,
      baseAmount,
      bagageAmount: booking.bagagePrice || 0,
      totalAmount: booking.totalAmount,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      status: booking.status,
      createdAt: booking.createdAt,
    };
    await downloadReceipt(receiptData);
    setGeneratingPdf(false);
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <Text style={styles.errorText}>Réservation introuvable</Text>
      </View>
    );
  }

  const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.confirmed;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/bookings")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Détail de la réservation</Text>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Bannière statut paiement ── */}
        {booking.paymentStatus !== "paid" ? (
          <View style={styles.payWarningBanner}>
            <Feather name="alert-circle" size={18} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={styles.payWarningTitle}>Paiement requis</Text>
              <Text style={styles.payWarningText}>Votre réservation sera annulée si le paiement n'est pas effectué.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.payOkBanner}>
            <Feather name="check-circle" size={18} color="#065F46" />
            <Text style={styles.payOkText}>Paiement confirmé</Text>
          </View>
        )}

        <View style={styles.refCard}>
          <Text style={styles.refLabel}>Référence de réservation</Text>
          <Text style={styles.refValue}>#{booking.bookingRef}</Text>
          <Text style={styles.refDate}>Réservé le {new Date(booking.createdAt).toLocaleDateString("fr-FR")}</Text>
        </View>

        {/* ── QR Code billet ── */}
        {booking.paymentStatus === "paid" && booking.status !== "cancelled" && (
          <View style={styles.qrCard}>
            <View style={styles.qrHeader}>
              <Feather name="smartphone" size={16} color={Colors.light.primary} />
              <Text style={styles.qrTitle}>Billet électronique</Text>
              {((booking.status as string) === "boarded" || (booking.status as string) === "validated") && (
                <View style={styles.qrUsedBadge}>
                  <Text style={styles.qrUsedText}>Utilisé</Text>
                </View>
              )}
            </View>
            <Text style={styles.qrSub}>Présentez ce QR à l'agent lors de l'embarquement</Text>
            <View style={styles.qrBox}>
              <QRCode
                value={booking.qrCode || booking.bookingRef}
                size={180}
                color="#0B3C5D"
                backgroundColor="white"
              />
            </View>
            <View style={styles.qrFooter}>
              <Feather name="shield" size={12} color="#10b981" />
              <Text style={styles.qrFooterText}>Billet signé et sécurisé • GoBooking CI</Text>
            </View>
          </View>
        )}

        <View style={styles.tripCard}>
          <Text style={styles.busName}>{booking.trip.busName}</Text>
          <View style={styles.busTypeBadge}>
            <Text style={styles.busTypeText}>{booking.trip.busType}</Text>
          </View>

          <View style={styles.routeRow}>
            <View style={styles.cityBlock}>
              <Text style={styles.bigTime}>{booking.trip.departureTime}</Text>
              <Text style={styles.cityName}>{booking.trip.from}</Text>
            </View>
            <View style={styles.midBlock}>
              <Text style={styles.duration}>{booking.trip.duration}</Text>
              <Feather name="arrow-right" size={16} color={Colors.light.textMuted} />
            </View>
            <View style={[styles.cityBlock, { alignItems: "flex-end" }]}>
              <Text style={styles.bigTime}>{booking.trip.arrivalTime}</Text>
              <Text style={styles.cityName}>{booking.trip.to}</Text>
            </View>
          </View>

          <View style={styles.dateRow}>
            <Feather name="calendar" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.dateText}>{booking.trip.date}</Text>
          </View>

          <View style={styles.seatsRow}>
            <Feather name="map-pin" size={13} color={Colors.light.textSecondary} />
            <Text style={styles.seatsText}>Sièges : {booking.seatNumbers.join(", ")}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Passagers</Text>
          {booking.passengers.map((p, i) => (
            <View key={i} style={styles.paxCard}>
              <View style={styles.paxLeft}>
                <View style={styles.paxAvatar}>
                  <Text style={styles.paxAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.paxName}>{p.name}</Text>
                  <Text style={styles.paxDetails}>{p.age} ans · {p.gender}</Text>
                </View>
              </View>
              <View style={styles.seatChip}>
                <Text style={styles.seatChipText}>Siège {p.seatNumber}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Bagages ── */}
        {!!booking.bagages?.length && (
          <View style={styles.section}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>Bagages</Text>
              {booking.bagageStatus && (
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
                  backgroundColor:
                    booking.bagageStatus === "accepté" ? "#D1FAE5" :
                    booking.bagageStatus === "refusé"  ? "#FEE2E2" : "#FEF3C7",
                }}>
                  <Feather
                    name={booking.bagageStatus === "accepté" ? "check-circle" : booking.bagageStatus === "refusé" ? "x-circle" : "clock"}
                    size={12}
                    color={booking.bagageStatus === "accepté" ? "#059669" : booking.bagageStatus === "refusé" ? "#DC2626" : "#D97706"}
                  />
                  <Text style={{
                    fontSize: 12, fontFamily: "Inter_600SemiBold",
                    color: booking.bagageStatus === "accepté" ? "#059669" : booking.bagageStatus === "refusé" ? "#DC2626" : "#D97706",
                  }}>
                    {booking.bagageStatus === "accepté" ? "Acceptés" : booking.bagageStatus === "refusé" ? "Refusés" : "En attente"}
                  </Text>
                </View>
              )}
            </View>

            {booking.bagageStatus === "refusé" && (
              <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: "row", gap: 8 }}>
                <Feather name="alert-triangle" size={16} color="#DC2626" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#DC2626" }}>Bagages refusés</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#7F1D1D", marginTop: 2 }}>
                    {booking.bagageNote || "Vos bagages ont été refusés par la compagnie. Veuillez les modifier avant l'embarquement."}
                  </Text>
                </View>
              </View>
            )}

            {booking.bagages.map((b, i) => (
              <View key={b.id || i} style={{
                backgroundColor: "#FAFAFF", borderRadius: 12, padding: 12, marginBottom: 8,
                borderWidth: 1, borderColor: "#EDE9FE", flexDirection: "row", gap: 10, alignItems: "center",
              }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center" }}>
                  <Feather
                    name={b.type === "valise" ? "briefcase" : b.type === "sac" ? "shopping-bag" : b.type === "colis" ? "package" : "box"}
                    size={18} color="#7C3AED"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E1B4B", textTransform: "capitalize" }}>{b.type}</Text>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" }}>{b.poids} kg · {b.prix.toLocaleString()} FCFA</Text>
                </View>
                {b.imageUrl && (
                  <View style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden" }}>
                    <Image source={{ uri: b.imageUrl }} style={{ width: 44, height: 44 }} contentFit="cover" />
                  </View>
                )}
              </View>
            ))}

            {(booking.bagagePrice ?? 0) > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#EDE9FE", borderRadius: 10, padding: 10, marginTop: 4 }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#4C1D95" }}>Total bagages</Text>
                <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: "#7C3AED" }}>+{(booking.bagagePrice ?? 0).toLocaleString()} FCFA</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paiement</Text>
          <View style={styles.payCard}>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Méthode</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[styles.methodDot, { backgroundColor: METHOD_ICONS[booking.paymentMethod]?.color || "#6B7280" }]} />
                <Text style={styles.payValue}>
                  {METHOD_ICONS[booking.paymentMethod]?.label || booking.paymentMethod.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.payRow}>
              <Text style={styles.payLabel}>Statut</Text>
              <View style={[
                styles.payStatusBadge,
                { backgroundColor: booking.paymentStatus === "paid" ? "#ECFDF5" : "#FFFBEB" }
              ]}>
                <Feather
                  name={booking.paymentStatus === "paid" ? "check-circle" : "alert-circle"}
                  size={12}
                  color={booking.paymentStatus === "paid" ? "#059669" : "#D97706"}
                />
                <Text style={[
                  styles.payStatusText,
                  { color: booking.paymentStatus === "paid" ? "#059669" : "#D97706" }
                ]}>
                  {booking.paymentStatus === "paid" ? "Paiement confirmé" : "Paiement requis"}
                </Text>
              </View>
            </View>
            <View style={[styles.payRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.payTotalLabel}>Montant total</Text>
              <Text style={styles.payTotalValue}>{booking.totalAmount.toLocaleString()} FCFA</Text>
            </View>
          </View>
        </View>

        {/* ── Bouton Payer ── */}
        {booking.paymentStatus !== "paid" && booking.status !== "cancelled" && (booking.status as string) !== "boarded" && (
          <Pressable
            style={({ pressed }) => [styles.payNowBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: "/payment/cinetpay",
                params: {
                  bookingId:  booking.id,
                  amount:     String(booking.totalAmount),
                  bookingRef: booking.bookingRef,
                },
              });
            }}
          >
            <Feather name="credit-card" size={16} color="white" />
            <Text style={styles.payNowBtnText}>Payer {booking.totalAmount.toLocaleString()} FCFA</Text>
          </Pressable>
        )}

        {/* Télécharger la facture — disponible si payé */}
        {booking.paymentStatus === "paid" && (
          <Pressable
            style={({ pressed }) => [styles.downloadInvoiceBtn, pressed && { opacity: 0.8 }, generatingPdf && { opacity: 0.7 }]}
            onPress={handleDownloadPdf}
            disabled={generatingPdf}
          >
            {generatingPdf ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="download" size={16} color="#fff" />
                <Text style={styles.downloadInvoiceBtnText}>Télécharger la facture</Text>
              </>
            )}
          </Pressable>
        )}

        {/* ── Contacter l'agent ── */}
        {booking.agentPhone ? (
          <View style={styles.agentContactCard}>
            <View style={styles.agentContactLeft}>
              <View style={styles.agentContactIcon}>
                <Feather name="phone" size={18} color="#0B3C5D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.agentContactLabel}>Agent de voyage</Text>
                <Text style={styles.agentContactName}>{booking.agentName ?? "Votre agent"}</Text>
                <Text style={styles.agentContactPhone}>{booking.agentPhone}</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.callAgentBtn, pressed && { opacity: 0.8 }]}
              onPress={() => Linking.openURL(`tel:${booking.agentPhone!.replace(/\s/g, "")}`)}
            >
              <Feather name="phone-call" size={15} color="#fff" />
              <Text style={styles.callAgentBtnText}>Appeler</Text>
            </Pressable>
          </View>
        ) : null}

        {booking.status === "confirmed" && booking.paymentStatus === "paid" && (
          <Pressable
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && { opacity: 0.8 },
              cancelling && { opacity: 0.7 },
            ]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color={Colors.light.error} />
            ) : (
              <>
                <Feather name="x-circle" size={16} color={Colors.light.error} />
                <Text style={styles.cancelBtnText}>Annuler la réservation</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: Colors.light.textSecondary, fontFamily: "Inter_400Regular" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  refCard: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  refLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  refValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "white",
    marginTop: 4,
  },
  refDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },

  /* ── QR Code card ── */
  qrCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  qrHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    alignSelf: "stretch",
  },
  qrTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    flex: 1,
  },
  qrUsedBadge: {
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  qrUsedText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#DC2626",
  },
  qrSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
    textAlign: "center",
    marginBottom: 18,
  },
  qrBox: {
    padding: 16,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  qrFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  qrFooterText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#10b981",
  },

  tripCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  busName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 4,
  },
  busTypeBadge: {
    backgroundColor: Colors.light.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  busTypeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  cityBlock: { flex: 1 },
  bigTime: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  cityName: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  midBlock: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  duration: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  dateText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  seatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  seatsText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 10,
  },
  paxCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  paxLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  paxAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  paxAvatarText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  paxName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  paxDetails: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  seatChip: {
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  seatChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
  payCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  payLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  payValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
  },
  payStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  payStatusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  methodDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  payWarningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  payWarningTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#92400E",
    marginBottom: 2,
  },
  payWarningText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#92400E",
  },
  payOkBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  payOkText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#065F46",
  },
  payTotalLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  payTotalValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  downloadInvoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0B3C5D",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  downloadInvoiceBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.error,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.error,
  },
  payNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#059669",
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 10,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payNowBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  agentContactCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  agentContactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  agentContactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  agentContactLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  agentContactName: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#0B3C5D",
  },
  agentContactPhone: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#3B82F6",
    marginTop: 1,
  },
  callAgentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0B3C5D",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  callAgentBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});
