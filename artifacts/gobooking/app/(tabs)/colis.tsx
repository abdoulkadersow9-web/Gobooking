import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

interface Parcel {
  id: string;
  trackingRef: string;
  fromCity: string;
  toCity: string;
  senderName: string;
  receiverName: string;
  parcelType: string;
  weight: number;
  deliveryType: string;
  amount: number;
  status: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  en_attente: { label: "En attente", color: "#D97706", bg: "#FFFBEB", icon: "clock" },
  pris_en_charge: { label: "Pris en charge", color: Colors.light.primary, bg: "#EEF2FF", icon: "package" },
  en_transit: { label: "En transit", color: "#7C3AED", bg: "#F5F3FF", icon: "truck" },
  en_livraison: { label: "En livraison", color: "#0891B2", bg: "#ECFEFF", icon: "map-pin" },
  livre: { label: "Livré", color: "#059669", bg: "#ECFDF5", icon: "check-circle" },
  annule: { label: "Annulé", color: "#EF4444", bg: "#FEF2F2", icon: "x-circle" },
};

const TYPE_LABELS: Record<string, string> = {
  documents: "Documents", vetements: "Vêtements", electronique: "Électronique",
  alimentaire: "Alimentaire", cosmetique: "Cosmétique", autre: "Autre",
};

const DELIVERY_LABELS: Record<string, string> = {
  depot_agence: "Dépôt agence",
  livraison_domicile: "Livraison domicile",
  retrait_agence: "Retrait agence",
};

export default function ColisScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const data = await apiFetch<Parcel[]>("/parcels", { token });
      setParcels(data);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const renderParcel = ({ item }: { item: Parcel }) => {
    const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.en_attente;
    return (
      <Pressable
        style={({ pressed }) => [styles.parcelCard, pressed && { opacity: 0.9 }]}
        onPress={() => router.push({ pathname: "/parcel/tracking/[parcelId]", params: { parcelId: item.id } })}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <View style={styles.parcelIconBox}>
              <Feather name="package" size={18} color={Colors.light.primary} />
            </View>
            <View>
              <Text style={styles.routeText}>{item.fromCity} → {item.toCity}</Text>
              <Text style={styles.refText}>{item.trackingRef}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
            <Feather name={st.icon as never} size={11} color={st.color} />
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        <View style={styles.cardMid}>
          <View style={styles.infoItem}>
            <Feather name="user" size={12} color={Colors.light.textSecondary} />
            <Text style={styles.infoText}>{item.senderName} → {item.receiverName}</Text>
          </View>
          <View style={styles.infoItem}>
            <Feather name="box" size={12} color={Colors.light.textSecondary} />
            <Text style={styles.infoText}>{TYPE_LABELS[item.parcelType] || item.parcelType} · {item.weight} kg</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.deliveryText}>
            <Feather name="truck" size={11} color={Colors.light.textSecondary} />{" "}
            {DELIVERY_LABELS[item.deliveryType] || item.deliveryType}
          </Text>
          <Text style={styles.amountText}>{item.amount.toLocaleString()} FCFA</Text>
        </View>

        <View style={styles.trackRow}>
          <Feather name="map-pin" size={12} color={Colors.light.primary} />
          <Text style={styles.trackText}>Suivre le colis</Text>
          <Feather name="chevron-right" size={12} color={Colors.light.primary} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient colors={[Colors.light.primary, Colors.light.primaryDark]} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mes colis</Text>
          <Text style={styles.headerSub}>Suivi de vos expéditions</Text>
        </View>
        <Pressable
          style={styles.sendBtn}
          onPress={() => router.push("/parcel/send")}
        >
          <Feather name="plus" size={16} color="white" />
          <Text style={styles.sendBtnText}>Envoyer</Text>
        </Pressable>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : !token ? (
        <View style={styles.center}>
          <Feather name="lock" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptyDesc}>Connectez-vous pour voir vos colis</Text>
          <Pressable style={styles.loginBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      ) : parcels.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Feather name="package" size={40} color={Colors.light.primary} />
          </View>
          <Text style={styles.emptyTitle}>Aucun colis</Text>
          <Text style={styles.emptyDesc}>Vos envois de colis apparaîtront ici</Text>
          <Pressable
            style={styles.ctaBtn}
            onPress={() => router.push("/parcel/send")}
          >
            <Feather name="plus" size={16} color="white" />
            <Text style={styles.ctaBtnText}>Envoyer un colis</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={parcels}
          keyExtractor={(item) => item.id}
          renderItem={renderParcel}
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  sendBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  sendBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "white" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center" },
  loginBtn: { backgroundColor: Colors.light.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  loginBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },
  ctaBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.light.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13, marginTop: 8, shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ctaBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },

  parcelCard: { backgroundColor: "white", borderRadius: 18, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  parcelIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  routeText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" },
  refText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748B", marginTop: 1, letterSpacing: 0.5 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  cardMid: { gap: 4 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  deliveryText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  amountText: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.light.primary },
  trackRow: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  trackText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.light.primary },
});
