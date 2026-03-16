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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, isAdmin } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          logout();
        },
      },
    ]);
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
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="user" label="Edit Profile" onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuItem icon="phone" label="Contact: {user?.phone || 'Not set'}" onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuItem icon="lock" label="Change Password" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bookings</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="bookmark" label="My Bookings" onPress={() => router.push("/(tabs)/bookings")} />
        </View>
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Administration</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="settings" label="Admin Dashboard" onPress={() => router.push("/admin")} />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="help-circle" label="Help & FAQ" onPress={() => {}} />
          <View style={styles.menuDivider} />
          <MenuItem icon="info" label="About GoBooking" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.menuCard}>
          <MenuItem icon="log-out" label="Sign Out" onPress={handleLogout} danger />
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
});
