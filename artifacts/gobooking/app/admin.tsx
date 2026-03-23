import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { apiFetch } from "@/utils/api";

interface AdminStats {
  totalBookings: number;
  totalRevenue: number;
  totalUsers: number;
  totalTrips: number;
  activeTrips: number;
  todayBookings: number;
  todayRevenue: number;
  recentBookings: {
    id: string;
    bookingRef: string;
    trip: { from: string; to: string; date: string };
    totalAmount: number;
    status: string;
    createdAt: string;
  }[];
}

type TabType = "overview" | "bookings" | "trips" | "users";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { token, isAdmin } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!isAdmin) {
      if (router.canGoBack()) router.back();
      else router.replace("/(auth)/login");
      return;
    }
    const load = async () => {
      if (!token) return;
      try {
        const data = await apiFetch<AdminStats>("/admin/stats", { token });
        setStats(data);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, isAdmin]);

  const topPadValue = topPad;

  const StatCard = ({
    icon,
    label,
    value,
    sub,
    color,
  }: {
    icon: string;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as never} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );

  const TABS: { id: TabType; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "bar-chart-2" },
    { id: "bookings", label: "Bookings", icon: "bookmark" },
    { id: "trips", label: "Trips", icon: "navigation" },
    { id: "users", label: "Users", icon: "users" },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadValue }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.light.text} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSub}>Manage your platform</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Feather
              name={tab.icon as never}
              size={14}
              color={activeTab === tab.id ? Colors.light.primary : Colors.light.textMuted}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "overview" && stats && (
            <>
              <Text style={styles.sectionTitle}>Today</Text>
              <View style={styles.statsRow}>
                <StatCard
                  icon="shopping-bag"
                  label="Bookings"
                  value={stats.todayBookings}
                  color={Colors.light.primary}
                />
                <StatCard
                  icon="dollar-sign"
                  label="Revenue"
                  value={`$${stats.todayRevenue}`}
                  color={Colors.light.success}
                />
              </View>

              <Text style={styles.sectionTitle}>All Time</Text>
              <View style={styles.statsRow}>
                <StatCard
                  icon="bookmark"
                  label="Total Bookings"
                  value={stats.totalBookings}
                  color={Colors.light.primary}
                />
                <StatCard
                  icon="trending-up"
                  label="Total Revenue"
                  value={`$${stats.totalRevenue}`}
                  color={Colors.light.success}
                />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  icon="users"
                  label="Total Users"
                  value={stats.totalUsers}
                  color={Colors.light.warning}
                />
                <StatCard
                  icon="navigation"
                  label="Active Trips"
                  value={stats.activeTrips}
                  sub={`of ${stats.totalTrips} total`}
                  color={Colors.light.error}
                />
              </View>

              <Text style={styles.sectionTitle}>Recent Bookings</Text>
              {stats.recentBookings.map((b) => (
                <Pressable
                  key={b.id}
                  style={({ pressed }) => [styles.recentCard, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push({ pathname: "/booking/[id]", params: { id: b.id } })}
                >
                  <View>
                    <Text style={styles.recentRef}>#{b.bookingRef}</Text>
                    <Text style={styles.recentRoute}>{b.trip.from} → {b.trip.to}</Text>
                    <Text style={styles.recentDate}>{b.trip.date}</Text>
                  </View>
                  <View style={styles.recentRight}>
                    <Text style={styles.recentAmount}>${b.totalAmount}</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: b.status === "confirmed" ? Colors.light.primaryLight : b.status === "cancelled" ? "#FEF2F2" : "#ECFDF5" }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: b.status === "confirmed" ? Colors.light.primary : b.status === "cancelled" ? Colors.light.error : Colors.light.success }
                      ]}>
                        {b.status}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {activeTab === "bookings" && (
            <AdminBookingsList token={token!} />
          )}

          {activeTab === "trips" && (
            <AdminTripsList token={token!} />
          )}

          {activeTab === "users" && (
            <AdminUsersList token={token!} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function AdminBookingsList({ token }: { token: string }) {
  const [data, setData] = useState<{ id: string; bookingRef: string; trip: { from: string; to: string; date: string }; totalAmount: number; status: string; passengers: unknown[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<typeof data>("/admin/bookings", { token })
      .then(setData)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <ActivityIndicator color={Colors.light.primary} style={{ marginTop: 20 }} />;

  return (
    <>
      <Text style={styles.sectionTitle}>All Bookings ({data.length})</Text>
      {data.map((b) => (
        <Pressable
          key={b.id}
          style={({ pressed }) => [styles.recentCard, pressed && { opacity: 0.8 }]}
          onPress={() => router.push({ pathname: "/booking/[id]", params: { id: b.id } })}
        >
          <View>
            <Text style={styles.recentRef}>#{b.bookingRef}</Text>
            <Text style={styles.recentRoute}>{b.trip.from} → {b.trip.to}</Text>
            <Text style={styles.recentDate}>{b.trip.date} · {b.passengers.length} pax</Text>
          </View>
          <View style={styles.recentRight}>
            <Text style={styles.recentAmount}>${b.totalAmount}</Text>
            <View style={[styles.statusBadge, { backgroundColor: b.status === "confirmed" ? Colors.light.primaryLight : "#FEF2F2" }]}>
              <Text style={[styles.statusText, { color: b.status === "confirmed" ? Colors.light.primary : Colors.light.error }]}>
                {b.status}
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </>
  );
}

function AdminTripsList({ token }: { token: string }) {
  const [data, setData] = useState<{ id: string; from: string; to: string; date: string; departureTime: string; price: number; availableSeats: number; totalSeats: number; busName: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<typeof data>("/admin/trips", { token })
      .then(setData)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <ActivityIndicator color={Colors.light.primary} style={{ marginTop: 20 }} />;

  return (
    <>
      <Text style={styles.sectionTitle}>All Trips ({data.length})</Text>
      {data.map((t) => (
        <View key={t.id} style={styles.recentCard}>
          <View>
            <Text style={styles.recentRef}>{t.busName}</Text>
            <Text style={styles.recentRoute}>{t.from} → {t.to}</Text>
            <Text style={styles.recentDate}>{t.date} · {t.departureTime}</Text>
          </View>
          <View style={styles.recentRight}>
            <Text style={styles.recentAmount}>${t.price}</Text>
            <Text style={[styles.recentDate, { textAlign: "right" }]}>
              {t.availableSeats}/{t.totalSeats} seats
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

function AdminUsersList({ token }: { token: string }) {
  const [data, setData] = useState<{ id: string; name: string; email: string; phone: string; role: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<typeof data>("/admin/users", { token })
      .then(setData)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <ActivityIndicator color={Colors.light.primary} style={{ marginTop: 20 }} />;

  return (
    <>
      <Text style={styles.sectionTitle}>All Users ({data.length})</Text>
      {data.map((u) => (
        <View key={u.id} style={styles.recentCard}>
          <View style={styles.userLeft}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.recentRef}>{u.name}</Text>
              <Text style={styles.recentDate}>{u.email}</Text>
              <Text style={styles.recentDate}>{u.phone}</Text>
            </View>
          </View>
          <View style={[
            styles.roleBadge,
            { backgroundColor: u.role === "admin" ? Colors.light.primaryLight : Colors.light.background }
          ]}>
            <Text style={[styles.roleText, { color: u.role === "admin" ? Colors.light.primary : Colors.light.textSecondary }]}>
              {u.role}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.background,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.light.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: Colors.light.primary,
  },
  tabText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textMuted,
  },
  tabTextActive: {
    color: Colors.light.primary,
    fontFamily: "Inter_600SemiBold",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 10,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 4,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  statSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
  },
  recentCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  recentRef: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  recentRoute: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.text,
    marginTop: 2,
  },
  recentDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  recentRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  recentAmount: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  userLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  roleText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
