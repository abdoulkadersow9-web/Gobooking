import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { apiFetch } from "@/utils/api";

interface Parcel {
  id: string;
  trackingRef: string;
  senderName: string;
  receiverName: string;
  fromCity: string;
  toCity: string;
  parcelType: string;
  weight: number;
  deliveryType: string;
  amount: number;
  status: string;
  createdAt: string;
}

const STATUS_STEPS = [
  { id: "en_attente",         label: "Enregistré",        desc: "Votre colis a bien été enregistré",              icon: "check-circle"  },
  { id: "confirme",           label: "Confirmé",          desc: "La compagnie a confirmé votre colis",             icon: "clipboard"     },
  { id: "en_cours_ramassage", label: "Ramassage",         desc: "L'agent vient récupérer votre colis",             icon: "map-pin"       },
  { id: "arrive_gare_depart", label: "Gare de départ",    desc: "Colis arrivé en gare de départ",                  icon: "home"          },
  { id: "pris_en_charge",     label: "Pris en charge",    desc: "L'agent a pris en charge votre colis",            icon: "package"       },
  { id: "en_transit",         label: "En transit",        desc: "Votre colis est en cours de transport",           icon: "truck"         },
  { id: "arrive_destination", label: "Arrivé",            desc: "Votre colis est arrivé à destination",            icon: "flag"          },
  { id: "en_livraison",       label: "En livraison",      desc: "Le livreur est en route avec votre colis",        icon: "navigation"    },
  { id: "livre",              label: "Livré",             desc: "Votre colis a été livré avec succès ! 🎉",        icon: "gift"          },
];

/* Map each status to its step index for progress calculation */
const STATUS_INDEX: Record<string, number> = Object.fromEntries(
  STATUS_STEPS.map((s, i) => [s.id, i])
);

const DELIVERY_LABELS: Record<string, string> = {
  depot_agence: "Dépôt en agence",
  livraison_domicile: "Livraison à domicile",
  retrait_agence: "Retrait en agence",
};

const TYPE_LABELS: Record<string, string> = {
  documents: "Documents", vetements: "Vêtements", electronique: "Électronique",
  alimentaire: "Alimentaire", cosmetique: "Cosmétique", autre: "Autre",
};

export default function ParcelTrackingScreen() {
  const insets = useSafeAreaInsets();
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(true);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    apiFetch<Parcel>(`/parcels/${parcelId}`)
      .then(setParcel)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [parcelId]);

  if (loading) return (
    <View style={[styles.center, { paddingTop: topPad }]}>
      <ActivityIndicator size="large" color={Colors.light.primary} />
    </View>
  );

  if (!parcel) return (
    <View style={[styles.center, { paddingTop: topPad }]}>
      <Feather name="alert-circle" size={48} color="#CBD5E1" />
      <Text style={styles.errorText}>Colis introuvable</Text>
    </View>
  );

  const currentStep = STATUS_STEPS.findIndex((s) => s.id === parcel.status);
  const isCancelled = parcel.status === "annule";

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient colors={[Colors.light.primary, Colors.light.primaryDark]} style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Suivi du colis</Text>
          <Text style={styles.headerSub}>{parcel.trackingRef}</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={async () => {
          setLoading(true);
          apiFetch<Parcel>(`/parcels/${parcelId}`).then(setParcel).catch(() => null).finally(() => setLoading(false));
        }}>
          <Feather name="refresh-cw" size={16} color="white" />
        </Pressable>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 32, padding: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Route card */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeCity}>
              <Text style={styles.routeCityName}>{parcel.fromCity}</Text>
              <Text style={styles.routeLabel}>Départ</Text>
            </View>
            <View style={styles.routeMid}>
              <View style={styles.routeDotGreen} />
              <View style={styles.routeLine} />
              <Feather name="package" size={16} color={Colors.light.primary} />
              <View style={styles.routeLine} />
              <View style={styles.routeDotRed} />
            </View>
            <View style={[styles.routeCity, { alignItems: "flex-end" }]}>
              <Text style={styles.routeCityName}>{parcel.toCity}</Text>
              <Text style={[styles.routeLabel, { textAlign: "right" }]}>Destination</Text>
            </View>
          </View>
          <View style={styles.routeMeta}>
            <View style={styles.metaItem}>
              <Feather name="box" size={13} color={Colors.light.textSecondary} />
              <Text style={styles.metaText}>{TYPE_LABELS[parcel.parcelType] || parcel.parcelType}</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="shopping-bag" size={13} color={Colors.light.textSecondary} />
              <Text style={styles.metaText}>{parcel.weight} kg</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="truck" size={13} color={Colors.light.textSecondary} />
              <Text style={styles.metaText}>{DELIVERY_LABELS[parcel.deliveryType] || parcel.deliveryType}</Text>
            </View>
          </View>
        </View>

        {/* Status badge */}
        <View style={[styles.statusBadge, isCancelled ? styles.statusCancelled : styles.statusActive]}>
          <Feather
            name={isCancelled ? "x-circle" : currentStep === STATUS_STEPS.length - 1 ? "check-circle" : "clock"}
            size={18}
            color={isCancelled ? "#EF4444" : currentStep === STATUS_STEPS.length - 1 ? "#059669" : Colors.light.primary}
          />
          <View>
            <Text style={[styles.statusBadgeLabel, isCancelled ? { color: "#EF4444" } : currentStep === STATUS_STEPS.length - 1 ? { color: "#059669" } : { color: Colors.light.primary }]}>
              {isCancelled ? "Annulé" : STATUS_STEPS[currentStep]?.label ?? "En cours"}
            </Text>
            <Text style={styles.statusBadgeSub}>
              Référence : {parcel.trackingRef}
            </Text>
          </View>
        </View>

        {/* Timeline */}
        {!isCancelled && (
          <View style={styles.timeline}>
            <Text style={styles.timelineTitle}>Suivi en temps réel</Text>
            {STATUS_STEPS.map((step, i) => {
              const done = i <= currentStep;
              const current = i === currentStep;
              return (
                <View key={step.id} style={styles.timelineStep}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineIcon, done ? styles.timelineIconDone : styles.timelineIconPending, current && styles.timelineIconCurrent]}>
                      <Feather name={step.icon as never} size={16} color={done ? "white" : "#CBD5E1"} />
                    </View>
                    {i < STATUS_STEPS.length - 1 && (
                      <View style={[styles.timelineLine, done && i < currentStep && styles.timelineLineDone]} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>{step.label}</Text>
                    <Text style={styles.timelineDesc}>{step.desc}</Text>
                    {current && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Statut actuel</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Parcel info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Informations du colis</Text>
          <View style={styles.infoRow}>
            <Feather name="user" size={14} color={Colors.light.textSecondary} />
            <Text style={styles.infoLabel}>Expéditeur :</Text>
            <Text style={styles.infoValue}>{parcel.senderName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="user-check" size={14} color={Colors.light.textSecondary} />
            <Text style={styles.infoLabel}>Destinataire :</Text>
            <Text style={styles.infoValue}>{parcel.receiverName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="dollar-sign" size={14} color={Colors.light.textSecondary} />
            <Text style={styles.infoLabel}>Montant :</Text>
            <Text style={styles.infoValue}>{parcel.amount.toLocaleString()} FCFA</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { fontSize: 16, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 1, letterSpacing: 1 },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },

  routeCard: { backgroundColor: "white", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  routeRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  routeCity: { flex: 1 },
  routeCityName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0F172A" },
  routeLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 2 },
  routeMid: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  routeDotGreen: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  routeDotRed: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },
  routeLine: { flex: 1, height: 1.5, backgroundColor: "#E2E8F0" },
  routeMeta: { flexDirection: "row", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.light.textSecondary },

  statusBadge: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14 },
  statusActive: { backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE" },
  statusCancelled: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  statusBadgeLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.light.primary },
  statusBadgeSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },

  timeline: { backgroundColor: "white", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  timelineTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 16 },
  timelineStep: { flexDirection: "row", gap: 14, minHeight: 60 },
  timelineLeft: { alignItems: "center", width: 36 },
  timelineIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  timelineIconDone: { backgroundColor: Colors.light.primary },
  timelineIconPending: { backgroundColor: "#F1F5F9", borderWidth: 1.5, borderColor: "#E2E8F0" },
  timelineIconCurrent: { backgroundColor: Colors.light.primary, shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#E2E8F0", marginVertical: 4 },
  timelineLineDone: { backgroundColor: Colors.light.primary },
  timelineContent: { flex: 1, paddingBottom: 16 },
  timelineLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#94A3B8" },
  timelineLabelDone: { color: "#0F172A" },
  timelineDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 2 },
  currentBadge: { marginTop: 6, backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  currentBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },

  infoCard: { backgroundColor: "white", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, gap: 10 },
  infoTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 4 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  infoValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
});
