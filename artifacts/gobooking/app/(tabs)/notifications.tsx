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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

interface Notification {
  id: string;
  type: "booking" | "parcel" | "promo" | "system";
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: string;
  color: string;
  bg: string;
}

const DEMO_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "booking",
    title: "Réservation confirmée",
    message: "Votre billet Abidjan → Bouaké du 16/03 est confirmé. Réf: #GBB5AKZ8DZ",
    time: "Il y a 2h",
    read: false,
    icon: "bookmark",
    color: Colors.light.primary,
    bg: "#EEF2FF",
  },
  {
    id: "2",
    type: "parcel",
    title: "Colis en transit",
    message: "Votre colis GBP-XKZD1 est en cours de transport vers Bouaké.",
    time: "Il y a 5h",
    read: false,
    icon: "package",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    id: "3",
    type: "promo",
    title: "Offre spéciale !",
    message: "10% de réduction sur tous les trajets Abidjan → Man ce week-end. Code : GOBCI10",
    time: "Hier",
    read: true,
    icon: "tag",
    color: "#D97706",
    bg: "#FFFBEB",
  },
  {
    id: "4",
    type: "parcel",
    title: "Colis livré !",
    message: "Votre colis a été livré avec succès à Yamoussoukro. Merci pour votre confiance.",
    time: "Hier",
    read: true,
    icon: "check-circle",
    color: "#059669",
    bg: "#ECFDF5",
  },
  {
    id: "5",
    type: "system",
    title: "Bienvenue sur GoBooking",
    message: "Réservez vos billets de bus et envoyez vos colis partout en Côte d'Ivoire facilement.",
    time: "Il y a 2 jours",
    read: true,
    icon: "bell",
    color: "#0891B2",
    bg: "#ECFEFF",
  },
  {
    id: "6",
    type: "booking",
    title: "Rappel de voyage",
    message: "Votre voyage Abidjan → San Pedro est demain à 08:00. Pensez à vous préparer !",
    time: "Il y a 3 jours",
    read: true,
    icon: "calendar",
    color: Colors.light.primary,
    bg: "#EEF2FF",
  },
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [notifications, setNotifications] = useState(DEMO_NOTIFICATIONS);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <LinearGradient colors={[Colors.light.primary, Colors.light.primaryDark]} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>
            {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est à jour"}
          </Text>
        </View>
        {unreadCount > 0 && (
          <Pressable style={styles.markAllBtn} onPress={markAllRead}>
            <Feather name="check" size={14} color="white" />
            <Text style={styles.markAllText}>Tout lire</Text>
          </Pressable>
        )}
      </LinearGradient>

      {!token ? (
        <View style={styles.center}>
          <Feather name="lock" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptyDesc}>Connectez-vous pour voir vos notifications</Text>
          <Pressable style={styles.loginBtn} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.loginBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {notifications.length === 0 ? (
            <View style={[styles.center, { paddingTop: 80 }]}>
              <View style={styles.emptyIcon}>
                <Feather name="bell-off" size={40} color={Colors.light.primary} />
              </View>
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptyDesc}>Vos alertes et mises à jour apparaîtront ici</Text>
            </View>
          ) : (
            notifications.map((notif) => (
              <Pressable
                key={notif.id}
                style={[styles.notifCard, !notif.read && styles.notifCardUnread]}
                onPress={() => markRead(notif.id)}
              >
                <View style={[styles.notifIcon, { backgroundColor: notif.bg }]}>
                  <Feather name={notif.icon as never} size={20} color={notif.color} />
                </View>
                <View style={styles.notifContent}>
                  <View style={styles.notifTop}>
                    <Text style={styles.notifTitle}>{notif.title}</Text>
                    {!notif.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>
                  <Text style={styles.notifTime}>{notif.time}</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", marginTop: 2 },
  markAllBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  markAllText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "white" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94A3B8", textAlign: "center" },
  loginBtn: { backgroundColor: Colors.light.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  loginBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "white" },

  notifCard: { flexDirection: "row", gap: 12, backgroundColor: "white", borderRadius: 16, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  notifCardUnread: { backgroundColor: "#FAFBFF", borderWidth: 1, borderColor: "#C7D2FE" },
  notifIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  notifContent: { flex: 1, gap: 4 },
  notifTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  notifTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A", flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.primary, flexShrink: 0 },
  notifMessage: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", lineHeight: 18 },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
});
