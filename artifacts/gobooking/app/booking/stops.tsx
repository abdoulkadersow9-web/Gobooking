import React, { useState, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  ScrollView, Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { apiFetch } from "@/utils/api";
import { useBooking } from "@/context/BookingContext";

const BLUE    = "#0369A1";
const B_LIGHT = "#EFF6FF";
const GREEN   = "#059669";
const G_LIGHT = "#ECFDF5";

interface Stop {
  id: string;
  routeId: string;
  name: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  order: number;
}

export default function StopsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets     = useSafeAreaInsets();
  const { booking, setBooking } = useBooking();

  const [stops,    setStops]    = useState<Stop[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [fromStop, setFromStop] = useState<Stop | null>(null);
  const [toStop,   setToStop]   = useState<Stop | null>(null);
  const [phase,    setPhase]    = useState<"from" | "to">("from");

  useEffect(() => {
    if (!tripId) { setLoading(false); return; }
    apiFetch<Stop[]>(`/trips/${tripId}/stops`)
      .then(data => { setStops(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tripId]);

  function selectStop(stop: Stop) {
    if (phase === "from") {
      setFromStop(stop);
      setPhase("to");
    } else {
      if (fromStop && stop.order <= fromStop.order) {
        Alert.alert("Arrêt invalide", "L'arrêt d'arrivée doit être après l'arrêt de départ.");
        return;
      }
      setToStop(stop);
    }
  }

  function confirm() {
    if (!fromStop || !toStop) {
      Alert.alert("Sélection incomplète", "Choisissez un arrêt de départ et d'arrivée.");
      return;
    }
    setBooking(prev => ({
      ...prev,
      fromStopId:   fromStop.id,
      fromStopName: fromStop.name,
      toStopId:     toStop.id,
      toStopName:   toStop.name,
    }));
    router.back();
  }

  function reset() {
    setFromStop(null);
    setToStop(null);
    setPhase("from");
  }

  /* no stops → no route assigned */
  if (!loading && stops.length === 0) {
    return (
      <View style={ss.root}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: BLUE }}>
          <View style={ss.header}>
            <Pressable onPress={() => router.back()} style={ss.backBtn}>
              <Feather name="arrow-left" size={22} color="#fff" />
            </Pressable>
            <Text style={ss.headerTitle}>Choisir ses arrêts</Text>
          </View>
        </SafeAreaView>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Feather name="map-pin" size={48} color="#D1D5DB" />
          <Text style={{ color: "#6B7280", fontSize: 16, textAlign: "center", paddingHorizontal: 32 }}>
            Ce trajet n'a pas d'arrêts intermédiaires configurés.
          </Text>
          <Pressable style={ss.confirmBtn} onPress={() => router.back()}>
            <Text style={ss.confirmTxt}>Retour</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={ss.root}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: BLUE }}>
        <View style={ss.header}>
          <Pressable onPress={() => router.back()} style={ss.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={ss.headerTitle}>Choisir ses arrêts</Text>
        </View>
      </SafeAreaView>

      {/* selector strip */}
      <View style={ss.strip}>
        <Pressable
          style={[ss.stripTab, phase === "from" && ss.stripTabActive]}
          onPress={() => setPhase("from")}
        >
          <Feather name="log-in" size={14} color={phase === "from" ? BLUE : "#9CA3AF"} />
          <Text style={[ss.stripTxt, phase === "from" && { color: BLUE }]}>
            {fromStop ? fromStop.name : "Départ"}
          </Text>
        </Pressable>
        <Feather name="arrow-right" size={16} color="#9CA3AF" />
        <Pressable
          style={[ss.stripTab, phase === "to" && ss.stripTabActive]}
          onPress={() => fromStop && setPhase("to")}
        >
          <Feather name="log-out" size={14} color={phase === "to" ? GREEN : "#9CA3AF"} />
          <Text style={[ss.stripTxt, phase === "to" && { color: GREEN }]}>
            {toStop ? toStop.name : "Arrivée"}
          </Text>
        </Pressable>
        {(fromStop || toStop) && (
          <Pressable onPress={reset} style={ss.resetBtn}>
            <Feather name="x" size={14} color="#EF4444" />
          </Pressable>
        )}
      </View>

      <Text style={ss.hint}>
        {phase === "from" ? "Sélectionnez votre arrêt de départ" : "Sélectionnez votre arrêt d'arrivée"}
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color={BLUE} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}>
          {stops.map((stop, idx) => {
            const isFrom    = fromStop?.id === stop.id;
            const isTo      = toStop?.id === stop.id;
            const inRange   = fromStop && toStop
              ? stop.order > fromStop.order && stop.order < toStop.order
              : false;
            const disabled  = phase === "to" && fromStop ? stop.order <= fromStop.order : false;

            return (
              <Pressable
                key={stop.id}
                style={[
                  ss.stopRow,
                  isFrom && ss.stopFrom,
                  isTo   && ss.stopTo,
                  disabled && { opacity: 0.35 },
                ]}
                onPress={() => !disabled && selectStop(stop)}
                disabled={disabled}
              >
                {/* line */}
                <View style={ss.lineCol}>
                  <View style={[
                    ss.dot,
                    isFrom ? ss.dotFrom : isTo ? ss.dotTo : inRange ? ss.dotRange : ss.dotNeutral,
                  ]}>
                    {isFrom ? <Feather name="log-in" size={12} color="#fff" />
                    : isTo   ? <Feather name="log-out" size={12} color="#fff" />
                    : <Text style={ss.dotNum}>{idx + 1}</Text>}
                  </View>
                  {idx < stops.length - 1 && (
                    <View style={[ss.connector, inRange && { backgroundColor: "#93C5FD" }]} />
                  )}
                </View>

                {/* info */}
                <View style={{ flex: 1 }}>
                  <Text style={[ss.stopName, (isFrom || isTo) && { fontWeight: "800" }]}>
                    {stop.name}
                  </Text>
                  <Text style={ss.stopCity}>{stop.city}</Text>
                  {(stop.latitude && stop.longitude) ? (
                    <Text style={ss.gps}>
                      <Feather name="navigation" size={10} color={BLUE} /> {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                    </Text>
                  ) : null}
                </View>

                {isFrom && <View style={ss.badge}><Text style={ss.badgeTxt}>Départ</Text></View>}
                {isTo   && <View style={[ss.badge, { backgroundColor: G_LIGHT }]}><Text style={[ss.badgeTxt, { color: GREEN }]}>Arrivée</Text></View>}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* confirm bar */}
      {fromStop && toStop && (
        <View style={[ss.bar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={ss.barLabel}>Trajet sélectionné</Text>
            <Text style={ss.barRoute}>{fromStop.name} → {toStop.name}</Text>
          </View>
          <Pressable style={ss.confirmBtn} onPress={confirm}>
            <Text style={ss.confirmTxt}>Confirmer</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  root:          { flex: 1, backgroundColor: "#F9FAFB" },
  header:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4, backgroundColor: BLUE },
  backBtn:       { padding: 6, marginRight: 8 },
  headerTitle:   { fontSize: 18, fontWeight: "700", color: "#fff" },
  strip:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#F3F4F6" },
  stripTab:      { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, padding: 10, backgroundColor: "#F9FAFB" },
  stripTabActive:{ backgroundColor: B_LIGHT },
  stripTxt:      { fontSize: 13, fontWeight: "600", color: "#9CA3AF", flex: 1 },
  resetBtn:      { padding: 8 },
  hint:          { paddingHorizontal: 16, paddingVertical: 8, fontSize: 13, color: "#6B7280" },
  stopRow:       { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff", borderRadius: 12, marginBottom: 8, padding: 14, elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  stopFrom:      { borderWidth: 2, borderColor: BLUE },
  stopTo:        { borderWidth: 2, borderColor: GREEN },
  lineCol:       { width: 32, alignItems: "center" },
  dot:           { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  dotFrom:       { backgroundColor: BLUE },
  dotTo:         { backgroundColor: GREEN },
  dotRange:      { backgroundColor: "#93C5FD" },
  dotNeutral:    { backgroundColor: "#E5E7EB" },
  dotNum:        { fontSize: 11, fontWeight: "700", color: "#6B7280" },
  connector:     { width: 2, height: 24, backgroundColor: "#E5E7EB", marginVertical: 2 },
  stopName:      { fontSize: 14, fontWeight: "600", color: "#111827" },
  stopCity:      { fontSize: 12, color: "#6B7280" },
  gps:           { fontSize: 11, color: BLUE, marginTop: 2 },
  badge:         { backgroundColor: B_LIGHT, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  badgeTxt:      { fontSize: 11, fontWeight: "700", color: BLUE },
  bar:           { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1, borderColor: "#E5E7EB", gap: 12 },
  barLabel:      { fontSize: 11, color: "#6B7280" },
  barRoute:      { fontSize: 14, fontWeight: "700", color: "#111827" },
  confirmBtn:    { backgroundColor: BLUE, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  confirmTxt:    { color: "#fff", fontWeight: "700", fontSize: 14 },
});
