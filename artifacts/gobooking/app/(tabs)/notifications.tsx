import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useLanguage } from "@/context/LanguageContext";

type NotifType = "parcel" | "trip" | "promo" | "system";

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  date: Date;
  read: boolean;
  icon: string;
  color: string;
  bg: string;
  route?: () => void;
}

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD === 1) return "Hier";
  return `Il y a ${diffD} jours`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const now = Date.now();

const DEMO_NOTIFICATIONS: Omit<Notification, "route">[] = [
  {
    id: "1",
    type: "parcel",
    title: "Colis en transit",
    message: "Votre colis GBX-A4F2-KM91 est en cours de transport vers Bouaké. Livraison prévue demain.",
    date: new Date(now - 2 * 3600000),
    read: false,
    icon: "truck",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    id: "2",
    type: "trip",
    title: "Bus en route – Départ imminent",
    message: "Votre bus Abidjan → Bouaké part dans 30 minutes. Présentez-vous en gare dès maintenant.",
    date: new Date(now - 5 * 3600000),
    read: false,
    icon: "navigation",
    color: Colors.light.primary,
    bg: "#EEF2FF",
  },
  {
    id: "3",
    type: "parcel",
    title: "Colis livré ✓",
    message: "Votre colis GBX-B9C3-PL44 a été remis à Bamba Salif à Abidjan. Merci de votre confiance !",
    date: new Date(now - 18 * 3600000),
    read: false,
    icon: "check-circle",
    color: "#059669",
    bg: "#ECFDF5",
  },
  {
    id: "4",
    type: "trip",
    title: "Arrivée confirmée",
    message: "Le bus San Pédro → Abidjan est arrivé à destination. Bon séjour !",
    date: new Date(now - 1.5 * 86400000),
    read: true,
    icon: "map-pin",
    color: "#0891B2",
    bg: "#ECFEFF",
  },
  {
    id: "5",
    type: "parcel",
    title: "Colis reçu en agence",
    message: "Votre colis GBX-D5F8-MN33 Abidjan → Korhogo a été réceptionné dans notre agence. Expédition prévue ce soir.",
    date: new Date(now - 2 * 86400000),
    read: true,
    icon: "home",
    color: "#1D4ED8",
    bg: "#EFF6FF",
  },
  {
    id: "6",
    type: "trip",
    title: "Rappel de voyage",
    message: "Votre voyage Abidjan → San Pedro est prévu demain à 08h00. Bon voyage !",
    date: new Date(now - 3 * 86400000),
    read: true,
    icon: "calendar",
    color: Colors.light.primary,
    bg: "#EEF2FF",
  },
  {
    id: "7",
    type: "parcel",
    title: "Colis enregistré",
    message: "Votre envoi GBX-E2A1-ZP77 Man → Abidjan a été enregistré avec succès. Numéro de suivi copié.",
    date: new Date(now - 4 * 86400000),
    read: true,
    icon: "package",
    color: "#D97706",
    bg: "#FFFBEB",
  },
  {
    id: "8",
    type: "promo",
    title: "Offre spéciale ce week-end",
    message: "10% de réduction sur tous les trajets Abidjan → Man. Code : GOBCI10. Valable jusqu'au dimanche.",
    date: new Date(now - 5 * 86400000),
    read: true,
    icon: "tag",
    color: "#D97706",
    bg: "#FFFBEB",
  },
];

const ROUTE_FOR: Record<string, () => void> = {
  "1": () => router.push({ pathname: "/(tabs)/suivi", params: { ref: "GBX-A4F2-KM91" } }),
  "2": () => router.push("/(tabs)/bookings"),
  "3": () => router.push({ pathname: "/(tabs)/suivi", params: { ref: "GBX-B9C3-PL44" } }),
  "4": () => router.push("/(tabs)/bookings"),
  "5": () => router.push({ pathname: "/(tabs)/suivi", params: { ref: "GBX-D5F8-MN33" } }),
  "6": () => router.push("/(tabs)/bookings"),
  "7": () => router.push({ pathname: "/(tabs)/suivi", params: { ref: "GBX-E2A1-ZP77" } }),
};

const TYPE_LABEL: Record<NotifType, { label: string; color: string }> = {
  parcel: { label: "Colis", color: "#7C3AED" },
  trip:   { label: "Trajet", color: Colors.light.primary },
  promo:  { label: "Promo", color: "#D97706" },
  system: { label: "Système", color: "#0891B2" },
};

const FILTERS = ["Tous", "Colis", "Trajet", "Promo"] as const;
type Filter = typeof FILTERS[number];

const FILTER_TYPES: Record<Filter, NotifType | null> = {
  Tous:   null,
  Colis:  "parcel",
  Trajet: "trip",
  Promo:  "promo",
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [notifications, setNotifications] = useState<Omit<Notification, "route">[]>(DEMO_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<Filter>("Tous");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const handlePress = (notif: Omit<Notification, "route">) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    const navigate = ROUTE_FOR[notif.id];
    if (navigate) navigate();
  };

  const displayed = notifications.filter((n) => {
    const typeFilter = FILTER_TYPES[activeFilter];
    return typeFilter === null || n.type === typeFilter;
  });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>
            {unreadCount > 0
              ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
              : "Tout est à jour"}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
            <Feather name="check-circle" size={14} color="white" />
            <Text style={styles.markAllText}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Filter chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map((f) => {
            const active = activeFilter === f;
            const count = f === "Tous"
              ? notifications.length
              : notifications.filter((n) => n.type === FILTER_TYPES[f]).length;
            return (
              <Pressable
                key={f}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {displayed.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="bell-off" size={36} color={Colors.light.primary} />
            </View>
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptyDesc}>Vos alertes apparaîtront ici</Text>
          </View>
        ) : (
          displayed.map((notif, index) => {
            const isFirst = index === 0 || formatDate(displayed[index - 1].date) !== formatDate(notif.date);
            const hasRoute = Boolean(ROUTE_FOR[notif.id]);
            return (
              <View key={notif.id}>
                {isFirst && (
                  <Text style={styles.dateSep}>{formatDate(notif.date)}</Text>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.card,
                    !notif.read && styles.cardUnread,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => handlePress(notif)}
                >
                  {/* Left strip for unread */}
                  {!notif.read && <View style={styles.unreadStrip} />}

                  <View style={[styles.iconWrap, { backgroundColor: notif.bg }]}>
                    <Feather name={notif.icon as never} size={20} color={notif.color} />
                  </View>

                  <View style={styles.content}>
                    <View style={styles.cardTop}>
                      {/* Type pill */}
                      <View style={[styles.typePill, { backgroundColor: TYPE_LABEL[notif.type].bg ?? notif.bg }]}>
                        <Text style={[styles.typePillText, { color: notif.color }]}>
                          {TYPE_LABEL[notif.type].label}
                        </Text>
                      </View>
                      <Text style={styles.timeText}>{timeAgo(notif.date)}</Text>
                    </View>

                    <View style={styles.titleRow}>
                      <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]} numberOfLines={1}>
                        {notif.title}
                      </Text>
                      {!notif.read && <View style={styles.dot} />}
                    </View>

                    <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>

                    {hasRoute && (
                      <View style={styles.actionRow}>
                        <Text style={styles.actionText}>
                          {notif.type === "parcel" ? "Voir le suivi" : "Voir le trajet"}
                        </Text>
                        <Feather name="arrow-right" size={12} color={Colors.light.primary} />
                      </View>
                    )}
                  </View>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  headerLeft: { gap: 2 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.78)" },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  markAllText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },

  filterBar: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterScroll: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  chipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  chipTextActive: { color: "white" },
  chipBadge: {
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: "center",
  },
  chipBadgeActive: { backgroundColor: "rgba(255,255,255,0.28)" },
  chipBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#64748B" },
  chipBadgeTextActive: { color: "white" },

  list: { padding: 14, gap: 10 },

  dateSep: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },

  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  cardUnread: {
    backgroundColor: "#FAFBFF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },

  unreadStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.light.primary,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  content: { flex: 1, gap: 4 },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typePillText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  timeText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  notifTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#334155",
  },
  notifTitleUnread: {
    color: "#0F172A",
    fontFamily: "Inter_700Bold",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
    flexShrink: 0,
  },

  notifMessage: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    lineHeight: 18,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  actionText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8" },
});
