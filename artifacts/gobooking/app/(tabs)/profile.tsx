import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
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
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, isAdmin } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleLogout = () => {
    Alert.alert(
      t.deconnexion,
      t.deconnexionConfirm,
      [
        { text: t.annuler, style: "cancel" },
        {
          text: t.deconnexion,
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            logout();
          },
        },
      ]
    );
  };

  const MenuItem = ({
    icon,
    label,
    onPress,
    danger,
  }: {
    icon: string;
    label: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Feather name={icon as never} size={18} color={danger ? Colors.light.error : Colors.light.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      {!danger && <Feather name="chevron-right" size={16} color={Colors.light.textMuted} />}
    </Pressable>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        {isAdmin && (
          <View style={styles.adminTag}>
            <Feather name="shield" size={12} color={Colors.light.primary} />
            <Text style={styles.adminTagText}>Administrator</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>$480</Text>
          <Text style={styles.statLabel}>Spent</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>Gold</Text>
          <Text style={styles.statLabel}>Member</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.monCompte}</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="user" label={t.modifier} onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuItem icon="lock" label={t.motDePasse} onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.mesReservations}</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="bookmark" label={t.mesReservations} onPress={() => router.push("/(tabs)/bookings")} />
        </View>
      </View>

      {/* Language Switch */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.parametres}</Text>
        <View style={styles.menuCard}>
          <View style={styles.langRow}>
            <View style={styles.langLeft}>
              <View style={styles.langIconWrap}>
                <Feather name="globe" size={18} color={Colors.light.primary} />
              </View>
              <Text style={styles.langLabel}>{t.langue}</Text>
            </View>
            <View style={styles.langToggle}>
              <TouchableOpacity
                style={[styles.langBtn, lang === "fr" && styles.langBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setLang("fr"); }}
              >
                <Text style={[styles.langBtnText, lang === "fr" && styles.langBtnTextActive]}>FR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, lang === "en" && styles.langBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setLang("en"); }}
              >
                <Text style={[styles.langBtnText, lang === "en" && styles.langBtnTextActive]}>EN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tableaux de bord</Text>
        <View style={styles.dashGrid}>
          <Pressable style={[styles.dashCard, { borderColor: "#C7D2FE" }]} onPress={() => router.push("/dashboard/company")}>
            <View style={[styles.dashIcon, { backgroundColor: "#EEF2FF" }]}>
              <Feather name="briefcase" size={20} color={Colors.light.primary} />
            </View>
            <Text style={styles.dashLabel}>Entreprise</Text>
            <Text style={styles.dashSub}>Gestion de flotte</Text>
          </Pressable>
          <Pressable style={[styles.dashCard, { borderColor: "#BBF7D0" }]} onPress={() => router.push("/dashboard/agent")}>
            <View style={[styles.dashIcon, { backgroundColor: "#ECFDF5" }]}>
              <Feather name="user" size={20} color="#059669" />
            </View>
            <Text style={styles.dashLabel}>Agent</Text>
            <Text style={styles.dashSub}>Embarquement & colis</Text>
          </Pressable>
          <Pressable style={[styles.dashCard, { borderColor: "#E9D5FF" }]} onPress={() => router.push("/dashboard/super-admin")}>
            <View style={[styles.dashIcon, { backgroundColor: "#F5F3FF" }]}>
              <Feather name="shield" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.dashLabel}>Super Admin</Text>
            <Text style={styles.dashSub}>Global & stats</Text>
          </Pressable>
        </View>
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.administration}</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="settings" label={t.adminDashboard} onPress={() => router.push("/admin")} />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.support}</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="help-circle" label={t.aide} onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuItem icon="info" label={t.apropos} onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.menuCard}>
          <MenuItem icon="log-out" label={t.deconnexion} onPress={handleLogout} danger />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  profileHeader: {
    alignItems: "center",
    padding: 24,
    paddingBottom: 20,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  userName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  adminTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  adminTagText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.light.card,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  menuItemPressed: {
    backgroundColor: Colors.light.background,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  menuIconDanger: {
    backgroundColor: "#FEF2F2",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  menuLabelDanger: {
    color: Colors.light.error,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginLeft: 64,
  },

  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    paddingLeft: 16,
  },
  langLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  langIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  langLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
  },
  langToggle: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    overflow: "hidden",
  },
  langBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: "transparent",
  },
  langBtnActive: {
    backgroundColor: Colors.light.primary,
  },
  langBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.light.textSecondary,
  },
  langBtnTextActive: {
    color: "white",
  },
  dashGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dashCard: {
    width: "30%",
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dashIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  dashLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  dashSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
  },
});
