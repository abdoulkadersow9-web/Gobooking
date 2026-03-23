/**
 * OfflineBanner — statut de connexion, actions en attente, lien historique
 */
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NetworkStatus } from "@/utils/offline";

interface Props {
  status: NetworkStatus;
  accentColor?: string;
}

export default function OfflineBanner({ status, accentColor = "#D97706" }: Props) {
  const { isOnline, pendingCount, syncNow, isSyncing, lastSyncResult } = status;

  if (isOnline && pendingCount === 0 && !lastSyncResult) return null;

  /* Just finished syncing — brief success flash (shown when pendingCount just became 0 after sync) */
  if (isOnline && pendingCount === 0 && lastSyncResult && lastSyncResult.synced > 0) {
    return (
      <View style={[styles.banner, { backgroundColor: "#065F46" }]}>
        <View style={styles.row}>
          <Feather name="check-circle" size={14} color="#6EE7B7" />
          <Text style={styles.text}>
            {lastSyncResult.synced} action{lastSyncResult.synced > 1 ? "s" : ""} synchronisée{lastSyncResult.synced > 1 ? "s" : ""} ✓
          </Text>
          <TouchableOpacity onPress={() => router.push("/offline/history")} style={styles.histBtn}>
            <Feather name="clock" size={11} color="#fff" />
            <Text style={styles.histBtnText}>Historique</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* Online with pending items */
  if (isOnline && pendingCount > 0) {
    return (
      <View style={[styles.banner, { backgroundColor: "#065F46" }]}>
        <View style={styles.row}>
          {isSyncing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="upload-cloud" size={14} color="#6EE7B7" />
          }
          <Text style={styles.text}>
            {isSyncing
              ? "Synchronisation en cours…"
              : `${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente de sync`}
          </Text>
          {!isSyncing && (
            <>
              <TouchableOpacity style={styles.syncBtn} onPress={syncNow} activeOpacity={0.8}>
                <Feather name="refresh-cw" size={12} color="#fff" />
                <Text style={styles.syncBtnText}>Sync</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/offline/history")} style={styles.histBtn}>
                <Feather name="clock" size={11} color="#fff" />
                <Text style={styles.histBtnText}>Historique</Text>
              </TouchableOpacity>
            </>
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
        {pendingCount > 0 && (
          <TouchableOpacity onPress={() => router.push("/offline/history")} style={styles.histBtn}>
            <Feather name="clock" size={11} color="#fff" />
            <Text style={styles.histBtnText}>Voir</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 9,
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
  histBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  histBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});
