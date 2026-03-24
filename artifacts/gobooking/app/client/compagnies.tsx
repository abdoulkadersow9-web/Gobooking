import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/utils/api";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Company {
  id: string;
  name: string;
  city: string | null;
  phone: string;
  address: string | null;
  licenseNumber: string | null;
  upcomingTrips: number;
  initials: string;
}

/* ─── Palette couleurs par compagnie (déterministe sur la 1ère lettre) ── */
const PALETTES: [string, string][] = [
  ["#1A56DB", "#0F3BA0"],
  ["#059669", "#047857"],
  ["#D97706", "#B45309"],
  ["#7C3AED", "#6D28D9"],
  ["#DC2626", "#B91C1C"],
  ["#0891B2", "#0E7490"],
  ["#16A34A", "#15803D"],
  ["#EA580C", "#C2410C"],
];

function getPalette(name: string): [string, string] {
  const idx = name.charCodeAt(0) % PALETTES.length;
  return PALETTES[idx] ?? PALETTES[0];
}

/* ─── Company Card ───────────────────────────────────────────────────── */
function CompanyCard({
  item, onPress, onSearch,
}: {
  item: Company;
  onPress: (c: Company) => void;
  onSearch: (c: Company) => void;
}) {
  const [from, to] = getPalette(item.name);

  return (
    <Pressable
      style={styles.card}
      onPress={() => onPress(item)}
    >
      <View style={styles.cardLeft}>
        <LinearGradient colors={[from, to]} style={styles.avatar}>
          <Text style={styles.avatarText}>{item.initials}</Text>
        </LinearGradient>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.cardMeta}>
            <Feather name="map-pin" size={11} color="#94A3B8" />
            <Text style={styles.cardMetaText}>{item.city ?? "Côte d'Ivoire"}</Text>
          </View>
          <View style={styles.tripsBadge}>
            <Feather name="navigation" size={11} color={from} />
            <Text style={[styles.tripsBadgeText, { color: from }]}>
              {item.upcomingTrips} trajet{item.upcomingTrips > 1 ? "s" : ""} à venir
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        style={[styles.searchBtn, { backgroundColor: from }]}
        onPress={() => onSearch(item)}
      >
        <Feather name="search" size={14} color="#fff" />
        <Text style={styles.searchBtnText}>Trajets</Text>
      </Pressable>
    </Pressable>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
export default function CompagniesScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();

  const [companies,   setCompanies]   = useState<Company[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [query,       setQuery]       = useState("");

  const fetchCompanies = useCallback(async () => {
    try {
      const data = await apiFetch<Company[]>("/companies");
      setCompanies(data ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.city ?? "").toLowerCase().includes(query.toLowerCase())
  );

  /* Navigate to search with pre-selected company */
  const handleSearch = (company: Company) => {
    const today = new Date().toISOString().slice(0, 10);
    router.push({
      pathname: "/search-results",
      params: {
        from:       params.from ?? "",
        to:         params.to ?? "",
        date:       params.date ?? today,
        passengers: "1",
        companyId:  company.id,
        companyName: company.name,
      },
    });
  };

  const handlePress = (company: Company) => handleSearch(company);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <LinearGradient
        colors={["#0B3C5D", "#164E71"]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Compagnies</Text>
          <Text style={styles.headerSub}>{companies.length} compagnie{companies.length > 1 ? "s" : ""} disponible{companies.length > 1 ? "s" : ""}</Text>
        </View>
        <Feather name="briefcase" size={22} color="rgba(255,255,255,0.4)" style={{ marginLeft: "auto" }} />
      </LinearGradient>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher une compagnie ou ville…"
          placeholderTextColor="#9CA3AF"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <Feather name="x" size={16} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0B3C5D" />
          <Text style={styles.loadingText}>Chargement des compagnies…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Feather name="briefcase" size={44} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Aucune compagnie</Text>
          <Text style={styles.emptySub}>{query ? `Aucun résultat pour "${query}"` : "Aucune compagnie active"}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CompanyCard
              item={item}
              onPress={handlePress}
              onSearch={handleSearch}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchCompanies(); }}
              tintColor="#0B3C5D"
            />
          }
        />
      )}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#F1F5F9" },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },

  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  backBtn:      { padding: 4 },
  headerTitle:  { color: "#fff", fontSize: 20, fontWeight: "800" },
  headerSub:    { color: "rgba(255,255,255,0.5)", fontSize: 12 },

  searchBar:    { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", margin: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  searchInput:  { flex: 1, fontSize: 14, color: "#1E293B" },

  list:         { padding: 12 },
  loadingText:  { color: "#94A3B8", fontSize: 14 },
  emptyTitle:   { fontSize: 16, fontWeight: "600", color: "#94A3B8" },
  emptySub:     { fontSize: 13, color: "#CBD5E1", textAlign: "center" },

  card:         { backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardLeft:     { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },

  avatar:       { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText:   { color: "#fff", fontSize: 18, fontWeight: "800" },

  cardInfo:     { flex: 1, gap: 3 },
  cardName:     { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  cardMeta:     { flexDirection: "row", alignItems: "center", gap: 4 },
  cardMetaText: { fontSize: 12, color: "#94A3B8" },

  tripsBadge:   { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  tripsBadgeText: { fontSize: 12, fontWeight: "600" },

  searchBtn:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  searchBtnText:{ color: "#fff", fontSize: 12, fontWeight: "600" },
});
