/**
 * OfflineBanner — affiche le statut de connexion et de synchronisation
 */
import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import type { NetworkStatus } from "@/utils/offline";

interface Props {
  status: NetworkStatus;
  accentColor?: string;
}

export default function OfflineBanner({ status, accentColor = "#D97706" }: Props) {
  const { isOnline, pendingCount, syncNow, isSyncing } = status;

  /* Nothing to show if online and no pending items */
  if (isOnline && pendingCount === 0) return null;

  /* Online but has pending items (syncing or pending) */
  if (isOnline && pendingCount > 0) {
    return (
      <View style={[styles.banner, { backgroundColor: "#065F46" }]}>
        <View style={styles.row}>
          {isSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="upload-cloud" size={14} color="#6EE7B7" />
          )}
          <Text style={styles.text}>
            {isSyncing
              ? "Synchronisation en cours…"
              : `${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente de sync`}
          </Text>
          {!isSyncing && (
            <TouchableOpacity style={styles.syncBtn} onPress={syncNow} activeOpacity={0.8}>
              <Feather name="refresh-cw" size={12} color="#fff" />
              <Text style={styles.syncBtnText}>Sync</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  /* Offline */
  return (
    <View style={[styles.banner, { backgroundColor: accentColor }]}>
      <View style={styles.row}>
        <Feather name="wifi-off" size={14} color="#fff" />
        <Text style={styles.text}>
          Mode hors ligne actif
          {pendingCount > 0 ? ` · ${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  syncBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
