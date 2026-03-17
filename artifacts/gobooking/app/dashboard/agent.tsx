import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

const PRIMARY = Colors.light.primary;
const GREEN   = "#059669";
const GREEN_D  = "#047857";

/* ─── Types ─────────────────────────────────────────────── */
interface Passenger  { name: string; age: number; gender: string; seatNumber: string }
interface BoardingEntry { id: string; bookingRef: string; passengers: Passenger[]; seatNumbers: string[]; status: string; totalAmount: number }
interface ParcelEntry   { id: string; trackingRef: string; fromCity: string; toCity: string; senderName: string; receiverName: string; receiverPhone: string; weight: number; status: string; amount: number }
interface SeatItem      { id: string; number: string; row: number; column: number; status: string }
interface ScanResult {
  id: string; bookingRef: string; status: string;
  passengers: Passenger[]; seatNumbers: string[];
  totalAmount: number; paymentMethod: string;
  trip: { from: string; to: string; date: string; departureTime: string; busName: string } | null;
}

/* ─── Demo data ─────────────────────────────────────────── */
const DEMO_BUS   = { busName: "Express Abidjan 01", plateNumber: "0258 AB 01", busType: "Premium", capacity: 44 };
const DEMO_TRIP  = { id: "t-demo", from: "Abidjan", to: "Bouaké", date: "17/03/2026", departureTime: "08h00", totalSeats: 44, bookedSeats: 31 };

function genDemoSeats(capacity: number, booked: number): SeatItem[] {
  const seats: SeatItem[] = [];
  const letters = ["A", "B", "C", "D"];
  const rows = Math.ceil(capacity / 4);
  let idx = 0;
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < 4; c++) {
      idx++;
      if (idx > capacity) break;
      seats.push({ id: `s-${letters[c]}${r}`, number: `${letters[c]}${r}`, row: r, column: c, status: idx <= booked ? "booked" : "available" });
    }
  }
  return seats;
}

const DEMO_BOARDING: BoardingEntry[] = [
  { id: "bk1", bookingRef: "GBB5AKZ8DZ", passengers: [{ name: "Kouassi Ama",        age: 34, gender: "F", seatNumber: "A3" }], seatNumbers: ["A3"], status: "confirmed", totalAmount: 3500 },
  { id: "bk2", bookingRef: "GBB9MNX2PL", passengers: [{ name: "Traoré Youssouf",    age: 28, gender: "M", seatNumber: "B1" }, { name: "Traoré Fatoumata", age: 25, gender: "F", seatNumber: "B2" }], seatNumbers: ["B1","B2"], status: "confirmed", totalAmount: 7000 },
  { id: "bk3", bookingRef: "GBBA1C3RQ7", passengers: [{ name: "Bamba Koffi",        age: 45, gender: "M", seatNumber: "C4" }], seatNumbers: ["C4"], status: "boarded",   totalAmount: 3500 },
  { id: "bk4", bookingRef: "GBB7FPV6NM", passengers: [{ name: "Diallo Mariam",      age: 22, gender: "F", seatNumber: "D2" }], seatNumbers: ["D2"], status: "confirmed", totalAmount: 3500 },
  { id: "bk5", bookingRef: "GBBC5XK0TZ", passengers: [{ name: "Coulibaly Seydou",   age: 38, gender: "M", seatNumber: "E1" }], seatNumbers: ["E1"], status: "boarded",   totalAmount: 3500 },
  { id: "bk6", bookingRef: "GBB3RKZ9QW", passengers: [{ name: "Assiéta Koné",       age: 29, gender: "F", seatNumber: "F3" }], seatNumbers: ["F3"], status: "confirmed", totalAmount: 3500 },
];

const DEMO_PARCELS: ParcelEntry[] = [
  { id: "p1", trackingRef: "GBX-A4F2-KM91", fromCity: "Abidjan", toCity: "Bouaké",       senderName: "Assiéta Koné",  receiverName: "Diabaté Oumar",  receiverPhone: "0707 11 22 33", weight: 4.5, status: "en_attente",     amount: 4700 },
  { id: "p2", trackingRef: "GBX-C1E7-QR22", fromCity: "Abidjan", toCity: "Yamoussoukro", senderName: "Bamba Sali",    receiverName: "Traoré Adama",   receiverPhone: "0505 44 55 66", weight: 2.1, status: "pris_en_charge", amount: 3500 },
  { id: "p3", trackingRef: "GBX-D5F8-MN33", fromCity: "Abidjan", toCity: "Korhogo",      senderName: "Koffi Ama",     receiverName: "Coulibaly Jean", receiverPhone: "0101 77 88 99", weight: 8.0, status: "en_transit",     amount: 8100 },
  { id: "p4", trackingRef: "GBX-E2G9-XY77", fromCity: "Bouaké",  toCity: "Abidjan",      senderName: "Traoré Mamadou",receiverName: "Coulibaly Sali", receiverPhone: "0101 33 44 55", weight: 3.0, status: "en_livraison",  amount: 5200 },
];

const PARCEL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:     { label: "En attente",     color: "#B45309", bg: "#FFFBEB" },
  pris_en_charge: { label: "Pris en charge", color: "#1D4ED8", bg: "#EFF6FF" },
  en_transit:     { label: "En transit",     color: "#6D28D9", bg: "#F5F3FF" },
  en_livraison:   { label: "En livraison",   color: "#0E7490", bg: "#ECFEFF" },
  livre:          { label: "Livré",          color: "#065F46", bg: "#ECFDF5" },
};

type Tab = "mission" | "sieges" | "embarquement" | "colis" | "scanner";

/* ─── Scan Result Card ───────────────────────────────────── */
function ScanResultCard({
  result, onValidate, validating, onClear,
}: {
  result: ScanResult;
  onValidate: () => void;
  validating: boolean;
  onClear: () => void;
}) {
  const isBoarded   = result.status === "boarded";
  const isCancelled = result.status === "cancelled";
  const canBoard    = !isBoarded && !isCancelled;

  const STATUS_CFG = {
    confirmed: { label: "Ticket valide",  bg: "#ECFDF5", color: "#065F46", icon: "check-circle" as const },
    boarded:   { label: "Déjà utilisé",   bg: "#FFFBEB", color: "#B45309", icon: "repeat"       as const },
    cancelled: { label: "Ticket invalide",bg: "#FEF2F2", color: "#DC2626", icon: "x-circle"     as const },
    pending:   { label: "En attente",     bg: "#FFFBEB", color: "#B45309", icon: "clock"        as const },
  };
  const st = STATUS_CFG[result.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;

  return (
    <View style={SC.resultCard}>
      {/* header */}
      <View style={SC.resultHeader}>
        <View style={[SC.statusPill, { backgroundColor: st.bg }]}>
          <Feather name={st.icon} size={14} color={st.color} />
          <Text style={[SC.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
        <TouchableOpacity onPress={onClear} style={SC.clearBtn}>
          <Feather name="x" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* ref + amount */}
      <Text style={SC.refText}>#{result.bookingRef}</Text>
      {result.trip && (
        <View style={SC.tripPill}>
          <Feather name="navigation" size={11} color={GREEN} />
          <Text style={SC.tripPillText}>{result.trip.from} → {result.trip.to}</Text>
          <Text style={SC.tripPillDate}>{result.trip.date} · {result.trip.departureTime}</Text>
        </View>
      )}

      {/* passengers */}
      <Text style={SC.paxTitle}>Passagers ({result.passengers.length})</Text>
      {result.passengers.map((p, i) => (
        <View key={i} style={SC.paxRow}>
          <View style={SC.seatTag}><Text style={SC.seatTagText}>{p.seatNumber}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={SC.paxName}>{p.name}</Text>
            <Text style={SC.paxMeta}>{p.age} ans · {p.gender === "M" ? "Homme" : "Femme"}</Text>
          </View>
        </View>
      ))}

      <View style={SC.amountRow}>
        <Text style={SC.amountLabel}>Montant payé</Text>
        <Text style={SC.amountVal}>{result.totalAmount.toLocaleString()} FCFA</Text>
      </View>

      {canBoard && (
        <TouchableOpacity
          style={[SC.validateBtn, validating && { opacity: 0.7 }]}
          onPress={onValidate}
          disabled={validating}
          activeOpacity={0.85}
        >
          {validating
            ? <ActivityIndicator size="small" color="white" />
            : <Feather name="check-circle" size={18} color="white" />
          }
          <Text style={SC.validateText}>{validating ? "Validation…" : "Valider le ticket"}</Text>
        </TouchableOpacity>
      )}

      {isBoarded && (
        <View style={[SC.boardedBanner, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
          <Feather name="alert-circle" size={16} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text style={[SC.boardedBannerText, { color: "#B45309" }]}>Déjà utilisé</Text>
            <Text style={{ fontSize: 11, color: "#D97706", fontFamily: "Inter_400Regular", marginTop: 1 }}>Ce ticket a déjà été scanné. Vérifiez l'identité.</Text>
          </View>
        </View>
      )}
      {isCancelled && (
        <View style={[SC.boardedBanner, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
          <Feather name="x-circle" size={16} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={[SC.boardedBannerText, { color: "#DC2626" }]}>Ticket invalide</Text>
            <Text style={{ fontSize: 11, color: "#EF4444", fontFamily: "Inter_400Regular", marginTop: 1 }}>Accès refusé — billet annulé ou inconnu.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* ─── Scanner Tab ───────────────────────────────────────── */
function ScannerTab({
  boarding, setBoarding, token,
}: {
  boarding: BoardingEntry[];
  setBoarding: React.Dispatch<React.SetStateAction<BoardingEntry[]>>;
  token: string | null;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning,   setScanning]   = useState(false);
  const [manualRef,  setManualRef]  = useState("");
  const [loading,    setLoading]    = useState(false);
  const [validating, setValidating] = useState(false);
  const [result,     setResult]     = useState<ScanResult | null>(null);
  const [error,      setError]      = useState("");
  const lastScanned  = useRef("");
  const scanCooldown = useRef(false);

  const lookup = useCallback(async (ref: string) => {
    const clean = ref.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await apiFetch<ScanResult>(`/agent/scan/${encodeURIComponent(clean)}`, { token: token ?? undefined });
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Référence introuvable");
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, [token]);

  const handleBarcode = useCallback(({ data }: { data: string }) => {
    if (scanCooldown.current || data === lastScanned.current) return;
    lastScanned.current   = data;
    scanCooldown.current  = true;
    setTimeout(() => { scanCooldown.current = false; }, 3000);
    lookup(data);
  }, [lookup]);

  const handleValidate = async () => {
    if (!result) return;
    setValidating(true);
    try {
      await apiFetch(`/agent/boarding/${result.id}/validate`, { token: token ?? undefined, method: "POST" });
      setResult(r => r ? { ...r, status: "boarded" } : r);
      setBoarding(prev => prev.map(b => b.id === result.id ? { ...b, status: "boarded" } : b));
    } catch {
      setError("Impossible de valider. Réessayez.");
    } finally {
      setValidating(false);
    }
  };

  const reset = () => { setResult(null); setError(""); setManualRef(""); lastScanned.current = ""; };

  /* ── Web fallback: manual entry ── */
  if (Platform.OS === "web") {
    return (
      <View style={{ gap: 14 }}>
        <View style={SC.webBanner}>
          <Feather name="info" size={14} color={PRIMARY} />
          <Text style={SC.webBannerText}>Sur mobile, le scanner utilise l'appareil photo. Entrez la référence manuellement ci-dessous.</Text>
        </View>

        {!result ? (
          <>
            <View style={SC.manualCard}>
              <Text style={SC.manualLabel}>Référence du billet</Text>
              <View style={SC.manualInputRow}>
                <TextInput
                  style={SC.manualInput}
                  placeholder="Ex: GBB5AKZ8DZ"
                  value={manualRef}
                  onChangeText={v => setManualRef(v.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity
                  style={[SC.lookupBtn, (!manualRef.trim() || loading) && { opacity: 0.6 }]}
                  onPress={() => lookup(manualRef)}
                  disabled={!manualRef.trim() || loading}
                  activeOpacity={0.8}
                >
                  {loading ? <ActivityIndicator size="small" color="white" /> : <Feather name="search" size={18} color="white" />}
                </TouchableOpacity>
              </View>
            </View>

            <Text style={SC.demoHint}>Références de démo :</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DEMO_BOARDING.slice(0, 5).map(b => (
                <Pressable key={b.id} onPress={() => { setManualRef(b.bookingRef); lookup(b.bookingRef); }} style={SC.demoChip}>
                  <Text style={SC.demoChipText}>{b.bookingRef}</Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <View style={SC.errorBanner}>
                <Feather name="alert-circle" size={14} color="#DC2626" />
                <Text style={SC.errorText}>{error}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <ScanResultCard result={result} onValidate={handleValidate} validating={validating} onClear={reset} />
        )}
      </View>
    );
  }

  /* ── Native: camera scanner ── */
  if (!permission) {
    return <View style={SC.permCenter}><ActivityIndicator color={GREEN} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={SC.permCenter}>
        <View style={SC.permCard}>
          <Feather name="camera-off" size={40} color="#CBD5E1" />
          <Text style={SC.permTitle}>Accès caméra requis</Text>
          <Text style={SC.permSub}>Pour scanner les QR codes des billets GoBooking</Text>
          <TouchableOpacity style={SC.permBtn} onPress={requestPermission} activeOpacity={0.85}>
            <Feather name="camera" size={16} color="white" />
            <Text style={SC.permBtnText}>Autoriser la caméra</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {!result && !scanning && (
        <TouchableOpacity style={SC.scanOpenBtn} onPress={() => { setScanning(true); setError(""); }} activeOpacity={0.85}>
          <Feather name="maximize" size={22} color="white" />
          <Text style={SC.scanOpenText}>Scanner un billet QR</Text>
        </TouchableOpacity>
      )}

      {scanning && !result && (
        <View style={SC.cameraWrap}>
          <CameraView
            style={SC.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39"] }}
            onBarcodeScanned={handleBarcode}
          />
          <View style={SC.cameraOverlay} pointerEvents="none">
            <View style={SC.scanFrame} />
            <Text style={SC.scanHint}>Pointez vers le QR code du billet</Text>
          </View>
          {loading && (
            <View style={SC.cameraLoading}>
              <ActivityIndicator size="large" color="white" />
              <Text style={SC.cameraLoadingText}>Vérification…</Text>
            </View>
          )}
          <TouchableOpacity style={SC.cancelScanBtn} onPress={() => setScanning(false)}>
            <Feather name="x" size={18} color="white" />
            <Text style={SC.cancelScanText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual input on native too */}
      {!result && !scanning && (
        <>
          <View style={SC.dividerRow}>
            <View style={SC.divider} /><Text style={SC.dividerText}>ou entrer manuellement</Text><View style={SC.divider} />
          </View>
          <View style={SC.manualInputRow}>
            <TextInput
              style={SC.manualInput}
              placeholder="Référence billet (GBB…)"
              value={manualRef}
              onChangeText={v => setManualRef(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity
              style={[SC.lookupBtn, (!manualRef.trim() || loading) && { opacity: 0.6 }]}
              onPress={() => lookup(manualRef)}
              disabled={!manualRef.trim() || loading}
            >
              {loading ? <ActivityIndicator size="small" color="white" /> : <Feather name="search" size={18} color="white" />}
            </TouchableOpacity>
          </View>
        </>
      )}

      {error && !result && (
        <View style={SC.errorBanner}>
          <Feather name="alert-circle" size={14} color="#DC2626" />
          <Text style={SC.errorText}>{error}</Text>
          <TouchableOpacity onPress={reset}><Text style={{ color: PRIMARY, fontSize: 12 }}>Réessayer</Text></TouchableOpacity>
        </View>
      )}

      {result && (
        <ScanResultCard result={result} onValidate={handleValidate} validating={validating} onClear={reset} />
      )}
    </View>
  );
}

type TripStatus = "scheduled" | "en_route" | "arrived";

/* ─── Confirm Modal ─────────────────────────────────────── */
function ConfirmModal({
  visible, title, subtitle, icon, iconBg, iconColor,
  confirmLabel, confirmColor, onConfirm, onCancel, loading,
}: {
  visible: boolean; title: string; subtitle: string;
  icon: string; iconBg: string; iconColor: string;
  confirmLabel: string; confirmColor: string;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={CM.overlay} onPress={onCancel}>
        <Pressable style={CM.sheet} onPress={e => e.stopPropagation()}>
          <View style={[CM.iconWrap, { backgroundColor: iconBg }]}>
            <Feather name={icon as never} size={28} color={iconColor} />
          </View>
          <Text style={CM.title}>{title}</Text>
          <Text style={CM.subtitle}>{subtitle}</Text>
          <View style={CM.btnRow}>
            <TouchableOpacity style={CM.cancelBtn} onPress={onCancel} disabled={loading} activeOpacity={0.8}>
              <Text style={CM.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[CM.confirmBtn, { backgroundColor: confirmColor }, loading && { opacity: 0.7 }]}
              onPress={onConfirm} disabled={loading} activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={CM.confirmText}>{confirmLabel}</Text>
              }
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function fmtElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,"0")}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2,"0")}s`;
  return `${s}s`;
}

/* ─── Main Component ─────────────────────────────────────── */
export default function AgentDashboard() {
  const insets    = useSafeAreaInsets();
  const { token } = useAuth();
  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [activeTab, setActiveTab] = useState<Tab>("mission");
  const [boarding,       setBoarding]       = useState<BoardingEntry[]>(DEMO_BOARDING);
  const [parcels,        setParcels]        = useState<ParcelEntry[]>(DEMO_PARCELS);
  const [seats,          setSeats]          = useState<SeatItem[]>(genDemoSeats(DEMO_BUS.capacity, DEMO_TRIP.bookedSeats));
  const [paxValidated,   setPaxValidated]   = useState<Set<string>>(
    () => new Set(DEMO_BOARDING.filter(b => b.status === "boarded").flatMap(b => b.passengers.map(p => `${b.id}-${p.seatNumber}`)))
  );
  const [passengerSearch, setPassengerSearch] = useState("");

  /* ── Trip status ── */
  const [tripStatus,       setTripStatus]       = useState<TripStatus>("scheduled");
  const [tripStartedAt,    setTripStartedAt]    = useState<Date | null>(null);
  const [elapsed,          setElapsed]          = useState(0);
  const [startConfirm,     setStartConfirm]     = useState(false);
  const [arriveConfirm,    setArriveConfirm]    = useState(false);
  const [tripStarting,     setTripStarting]     = useState(false);
  const [tripArriving,     setTripArriving]     = useState(false);
  const [tripError,        setTripError]        = useState("");
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* GPS tracking state */
  const [gpsStatus,   setGpsStatus]   = useState<"idle"|"active"|"error"|"denied">("idle");
  const [gpsCoords,   setGpsCoords]   = useState<{ lat: number; lon: number; speed: number | null } | null>(null);

  /* elapsed timer */
  useEffect(() => {
    if (tripStatus === "en_route" && tripStartedAt) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - tripStartedAt.getTime()) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [tripStatus, tripStartedAt]);

  /* GPS position broadcast — runs every 10s while en_route */
  useEffect(() => {
    if (tripStatus !== "en_route") {
      if (gpsIntervalRef.current) { clearInterval(gpsIntervalRef.current); gpsIntervalRef.current = null; }
      if (tripStatus === "arrived") setGpsStatus("idle");
      return;
    }

    let cancelled = false;

    const sendPosition = async () => {
      if (cancelled) return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setGpsStatus("denied"); return; }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        const { latitude: lat, longitude: lon, speed } = pos.coords;
        const kmh = speed != null && speed >= 0 ? Math.round(speed * 3.6) : null;
        setGpsCoords({ lat, lon, speed: kmh });
        setGpsStatus("active");

        if (token) {
          try {
            await apiFetch(`/agent/trip/${DEMO_TRIP.id}/location`, {
              token,
              method: "POST",
              body: JSON.stringify({ lat, lon, speed: kmh ?? undefined, accuracy: pos.coords.accuracy ?? undefined }),
            });
          } catch { /* non-blocking */ }
        }
      } catch {
        if (!cancelled) setGpsStatus("error");
      }
    };

    sendPosition();
    gpsIntervalRef.current = setInterval(sendPosition, 10_000);
    return () => {
      cancelled = true;
      if (gpsIntervalRef.current) { clearInterval(gpsIntervalRef.current); gpsIntervalRef.current = null; }
    };
  }, [tripStatus, token]);

  useEffect(() => {
    if (!token) return;
    Promise.allSettled([
      apiFetch<BoardingEntry[]>("/agent/boarding", { token }),
      apiFetch<ParcelEntry[]>("/agent/parcels", { token }),
      apiFetch<SeatItem[]>(`/agent/seats/${DEMO_TRIP.id}`, { token }),
    ]).then(([b, p, s]) => {
      if (b.status === "fulfilled" && b.value.length > 0) setBoarding(b.value);
      if (p.status === "fulfilled" && p.value.length > 0) setParcels(p.value);
      if (s.status === "fulfilled" && s.value.length > 0) setSeats(s.value);
    });
  }, [token]);

  const validateBoarding = async (bookingId: string) => {
    setBoarding(prev => prev.map(b => b.id === bookingId ? { ...b, status: "boarded" } : b));
    if (token) { try { await apiFetch(`/agent/boarding/${bookingId}/validate`, { token, method: "POST" }); } catch {} }
  };

  const validatePax = (paxKey: string, bookingId: string) => {
    const next = new Set([...paxValidated, paxKey]);
    setPaxValidated(next);
    const entry = boarding.find(b => b.id === bookingId);
    if (entry) {
      const allKeys = entry.passengers.map(p => `${entry.id}-${p.seatNumber}`);
      if (allKeys.every(k => next.has(k))) {
        setBoarding(prev => prev.map(b => b.id === bookingId ? { ...b, status: "boarded" } : b));
        if (token) { try { apiFetch(`/agent/boarding/${bookingId}/validate`, { token, method: "POST" }); } catch {} }
      }
    }
  };

  const flatPassengers = useMemo(() => {
    const q = passengerSearch.trim().toLowerCase();
    const all = boarding.flatMap(b =>
      b.passengers.map(p => ({
        key:        `${b.id}-${p.seatNumber}`,
        bookingId:  b.id,
        bookingRef: b.bookingRef,
        name:       p.name,
        seat:       p.seatNumber,
        age:        p.age,
        gender:     p.gender,
        validated:  paxValidated.has(`${b.id}-${p.seatNumber}`),
      }))
    );
    if (!q) return all;
    return all.filter(p =>
      p.name.toLowerCase().includes(q) || p.seat.toLowerCase().includes(q)
    );
  }, [boarding, paxValidated, passengerSearch]);

  const updateParcel = async (parcelId: string, newStatus: string, action: "pickup" | "transit" | "deliver") => {
    setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, status: newStatus } : p));
    if (token) { try { await apiFetch(`/agent/parcels/${parcelId}/${action}`, { token, method: "POST" }); } catch {} }
  };

  const handleStartTrip = async () => {
    setTripStarting(true);
    setTripError("");
    try {
      await apiFetch(`/agent/trip/${DEMO_TRIP.id}/start`, { token: token ?? undefined, method: "POST" });
      const now = new Date();
      setTripStatus("en_route");
      setTripStartedAt(now);
      setElapsed(0);
    } catch (e: any) {
      if (e?.code !== "ALREADY_STARTED") {
        setTripError(e?.message ?? "Impossible de démarrer le trajet");
        setTripStarting(false);
        setStartConfirm(false);
        return;
      }
      const now = new Date();
      setTripStatus("en_route");
      setTripStartedAt(now);
    }
    setTripStarting(false);
    setStartConfirm(false);
  };

  const handleArriveTrip = async () => {
    setTripArriving(true);
    setTripError("");
    try {
      await apiFetch(`/agent/trip/${DEMO_TRIP.id}/arrive`, { token: token ?? undefined, method: "POST" });
      setTripStatus("arrived");
      setTripStartedAt(null);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (e: any) {
      setTripError(e?.message ?? "Impossible de confirmer l'arrivée");
    }
    setTripArriving(false);
    setArriveConfirm(false);
  };

  const boarded    = boarding.filter(b => b.status === "boarded").length;
  const waiting    = boarding.filter(b => b.status === "confirmed").length;
  const seatBooked = seats.filter(s => s.status === "booked").length;
  const seatAvail  = seats.filter(s => s.status === "available").length;

  /* bus card colours per trip status */
  const busCardColors: [string, string] = tripStatus === "en_route"
    ? ["#D97706", "#B45309"]
    : tripStatus === "arrived"
    ? ["#059669", "#047857"]
    : [PRIMARY, "#0F3BA0"];

  const busStatusLabel = tripStatus === "en_route" ? "En route 🚌"
    : tripStatus === "arrived" ? "Arrivé ✓"
    : "En service";

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "mission",       label: "Mission",     icon: "navigation"  },
    { id: "scanner",       label: "Scanner",     icon: "maximize"    },
    { id: "embarquement",  label: "Embarquement",icon: "users"       },
    { id: "sieges",        label: "Sièges",      icon: "grid"        },
    { id: "colis",         label: "Colis",       icon: "package"     },
  ];

  return (
    <View style={[S.container, { paddingTop: topPad }]}>

      {/* ── Trip confirmation modals ── */}
      <ConfirmModal
        visible={startConfirm}
        title="Démarrer le trajet ?"
        subtitle={`${DEMO_TRIP.from} → ${DEMO_TRIP.to}\n${boarded} passagers embarqués · Départ ${DEMO_TRIP.departureTime}`}
        icon="play-circle"
        iconBg="#FFF7ED"
        iconColor="#D97706"
        confirmLabel="Démarrer"
        confirmColor="#D97706"
        onConfirm={handleStartTrip}
        onCancel={() => setStartConfirm(false)}
        loading={tripStarting}
      />
      <ConfirmModal
        visible={arriveConfirm}
        title="Confirmer l'arrivée ?"
        subtitle={`Déclarer l'arrivée à ${DEMO_TRIP.to}\nDurée du trajet : ${fmtElapsed(elapsed)}`}
        icon="map-pin"
        iconBg="#ECFDF5"
        iconColor="#059669"
        confirmLabel="Confirmer arrivée"
        confirmColor="#059669"
        onConfirm={handleArriveTrip}
        onCancel={() => setArriveConfirm(false)}
        loading={tripArriving}
      />

      <LinearGradient colors={[GREEN, GREEN_D]} style={S.header}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Feather name="arrow-left" size={20} color="white" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Espace Agent</Text>
          <Text style={S.headerSub}>Kouassi Jean · AGT-001</Text>
        </View>
        <View style={S.roleBadge}>
          <Feather name="user" size={13} color="white" />
          <Text style={S.roleBadgeText}>Agent</Text>
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tabBar} contentContainerStyle={S.tabBarContent}>
        {TABS.map(tab => (
          <Pressable key={tab.id} style={[S.tab, activeTab === tab.id && S.tabActive]} onPress={() => setActiveTab(tab.id)}>
            <Feather name={tab.icon as never} size={14} color={activeTab === tab.id ? GREEN : "#94A3B8"} />
            <Text style={[S.tabText, activeTab === tab.id && S.tabTextActive]}>{tab.label}</Text>
            {tab.id === "scanner" && <View style={S.tabDot} />}
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 12 }} showsVerticalScrollIndicator={false}>

        {/* ── Mission ── */}
        {activeTab === "mission" && (<>

          {/* Bus card — colour changes per trip status */}
          <View style={S.busCard}>
            <LinearGradient colors={busCardColors} style={S.busGradient}>
              <View style={S.busTop}>
                <View style={S.busIconWrap}><Feather name="truck" size={26} color="white" /></View>
                <View style={S.onlinePill}>
                  <View style={[S.onlineDot, tripStatus === "en_route" && { backgroundColor: "#FCD34D" }]} />
                  <Text style={S.onlineText}>{busStatusLabel}</Text>
                </View>
              </View>
              <Text style={S.busName}>{DEMO_BUS.busName}</Text>
              <Text style={S.busPlate}>{DEMO_BUS.plateNumber} · {DEMO_BUS.busType} · {DEMO_BUS.capacity} places</Text>
              {/* Elapsed timer when en route */}
              {tripStatus === "en_route" && (
                <View style={S.elapsedRow}>
                  <Feather name="clock" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={S.elapsedText}>En route depuis {fmtElapsed(elapsed)}</Text>
                </View>
              )}
              {/* GPS indicator */}
              {tripStatus === "en_route" && (
                <View style={[S.elapsedRow, { marginTop: 4 }]}>
                  <View style={{
                    width: 7, height: 7, borderRadius: 3.5,
                    backgroundColor: gpsStatus === "active" ? "#4ADE80"
                      : gpsStatus === "denied"  ? "#F87171"
                      : gpsStatus === "error"   ? "#FB923C"
                      : "#FCD34D",
                    marginRight: 5,
                  }} />
                  <Text style={S.elapsedText}>
                    {gpsStatus === "active"
                      ? `GPS actif${gpsCoords?.speed != null ? ` · ${gpsCoords.speed} km/h` : ""}`
                      : gpsStatus === "denied"
                      ? "GPS refusé — position non partagée"
                      : gpsStatus === "error"
                      ? "GPS — erreur localisation"
                      : "Acquisition GPS…"}
                  </Text>
                </View>
              )}
              {tripStatus === "arrived" && (
                <View style={S.elapsedRow}>
                  <Feather name="check-circle" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={S.elapsedText}>Trajet terminé · Arrivé à {DEMO_TRIP.to}</Text>
                </View>
              )}
            </LinearGradient>
          </View>

          <View style={S.tripCard}>
            <Text style={S.sectionTitle}>Trajet du jour</Text>
            <View style={S.tripRow}>
              <View style={S.cityBlock}>
                <View style={[S.cityDot, { backgroundColor: "#10B981" }]} />
                <Text style={S.cityName}>{DEMO_TRIP.from}</Text>
                <Text style={S.cityTime}>{DEMO_TRIP.departureTime}</Text>
              </View>
              <View style={S.tripArrow}>
                <View style={S.dashedLine} />
                <Feather name="arrow-right" size={16} color={PRIMARY} />
                <View style={S.dashedLine} />
              </View>
              <View style={[S.cityBlock, { alignItems: "flex-end" }]}>
                <View style={[S.cityDot, { backgroundColor: "#EF4444" }]} />
                <Text style={S.cityName}>{DEMO_TRIP.to}</Text>
                <Text style={S.cityTime}>{DEMO_TRIP.date}</Text>
              </View>
            </View>
          </View>

          {/* ── TRIP ACTION CARD ── */}
          {tripStatus === "scheduled" && (
            <View style={S.tripActionCard}>
              <View style={S.tripActionLeft}>
                <View style={[S.tripActionIcon, { backgroundColor: "#FFF7ED" }]}>
                  <Feather name="play-circle" size={22} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.tripActionTitle}>Prêt au départ</Text>
                  <Text style={S.tripActionSub}>{boarded}/{boarding.length} passagers embarqués</Text>
                </View>
              </View>
              <TouchableOpacity
                style={S.startBtn}
                onPress={() => setStartConfirm(true)}
                activeOpacity={0.85}
              >
                <Feather name="play" size={16} color="white" />
                <Text style={S.startBtnText}>Démarrer le trajet</Text>
              </TouchableOpacity>
            </View>
          )}

          {tripStatus === "en_route" && (
            <View style={[S.tripActionCard, { borderColor: "#FED7AA" }]}>
              <View style={S.tripActionLeft}>
                <View style={[S.tripActionIcon, { backgroundColor: "#FFF7ED" }]}>
                  <Feather name="navigation" size={22} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.tripActionTitle, { color: "#D97706" }]}>Trajet en cours</Text>
                  <Text style={S.tripActionSub}>{fmtElapsed(elapsed)} · {DEMO_TRIP.from} → {DEMO_TRIP.to}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[S.startBtn, { backgroundColor: GREEN }]}
                onPress={() => setArriveConfirm(true)}
                activeOpacity={0.85}
              >
                <Feather name="map-pin" size={16} color="white" />
                <Text style={S.startBtnText}>Arrivée</Text>
              </TouchableOpacity>
            </View>
          )}

          {tripStatus === "arrived" && (
            <View style={[S.tripActionCard, { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }]}>
              <View style={S.tripActionLeft}>
                <View style={[S.tripActionIcon, { backgroundColor: "#DCFCE7" }]}>
                  <Feather name="check-circle" size={22} color={GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.tripActionTitle, { color: GREEN }]}>Arrivé à destination</Text>
                  <Text style={[S.tripActionSub, { color: "#059669" }]}>Trajet terminé avec succès</Text>
                </View>
              </View>
            </View>
          )}

          {tripError ? (
            <View style={S.tripErrorBanner}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={S.tripErrorText}>{tripError}</Text>
            </View>
          ) : null}

          <Text style={S.sectionTitle}>Résumé de mission</Text>
          <View style={S.summaryGrid}>
            <View style={S.summaryCard}>
              <Text style={[S.summaryNum, { color: GREEN }]}>{boarded}</Text>
              <Text style={S.summaryLabel}>Embarqués</Text>
            </View>
            <View style={[S.summaryCard, { borderColor: "#FDE68A" }]}>
              <Text style={[S.summaryNum, { color: "#B45309" }]}>{waiting}</Text>
              <Text style={S.summaryLabel}>En attente</Text>
            </View>
            <View style={[S.summaryCard, { borderColor: "#BBF7D0" }]}>
              <Text style={[S.summaryNum, { color: "#065F46" }]}>{seatBooked}/{DEMO_TRIP.totalSeats}</Text>
              <Text style={S.summaryLabel}>Réservés</Text>
            </View>
            <View style={[S.summaryCard, { borderColor: "#E9D5FF" }]}>
              <Text style={[S.summaryNum, { color: "#6D28D9" }]}>{parcels.filter(p => !["livre", "annule"].includes(p.status)).length}</Text>
              <Text style={S.summaryLabel}>Colis actifs</Text>
            </View>
          </View>

          <View style={S.quickActionsRow}>
            <TouchableOpacity style={[S.quickAction, { backgroundColor: "#F0FDF4" }]} onPress={() => setActiveTab("scanner")} activeOpacity={0.8}>
              <Feather name="maximize" size={20} color={GREEN} />
              <Text style={[S.quickActionText, { color: GREEN }]}>Scanner ticket</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.quickAction, { backgroundColor: "#EEF2FF" }]} onPress={() => setActiveTab("embarquement")} activeOpacity={0.8}>
              <Feather name="users" size={20} color={PRIMARY} />
              <Text style={[S.quickActionText, { color: PRIMARY }]}>Voir les voyageurs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.quickAction, { backgroundColor: "#F5F3FF" }]} onPress={() => setActiveTab("sieges")} activeOpacity={0.8}>
              <Feather name="grid" size={20} color="#7C3AED" />
              <Text style={[S.quickActionText, { color: "#7C3AED" }]}>Gérer les sièges</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[S.quickAction, { backgroundColor: "#FFFBEB" }]} onPress={() => setActiveTab("colis")} activeOpacity={0.8}>
              <Feather name="package" size={20} color="#D97706" />
              <Text style={[S.quickActionText, { color: "#D97706" }]}>Colis</Text>
            </TouchableOpacity>
          </View>
        </>)}

        {/* ── Scanner ── */}
        {activeTab === "scanner" && (<>
          <View style={S.sectionRow}>
            <Text style={S.sectionTitle}>Scanner de ticket</Text>
            <View style={[S.badge, { backgroundColor: "#F0FDF4" }]}>
              <Feather name="maximize" size={11} color={GREEN} />
              <Text style={[S.badgeText, { color: GREEN }]}>QR · Code-barres</Text>
            </View>
          </View>
          <Text style={S.subLabel}>Scannez le QR code ou entrez la référence du ticket</Text>
          <ScannerTab boarding={boarding} setBoarding={setBoarding} token={token} />
        </>)}

        {/* ── Sièges ── */}
        {activeTab === "sieges" && (<>
          <Text style={S.sectionTitle}>Plan des sièges</Text>
          <Text style={S.subLabel}>{DEMO_TRIP.from} → {DEMO_TRIP.to} · {DEMO_TRIP.date} · {DEMO_TRIP.departureTime}</Text>

          <View style={S.seatSummaryRow}>
            <View style={[S.seatSummaryCard, { borderColor: "#BBF7D0" }]}>
              <Text style={[S.seatSummaryNum, { color: GREEN }]}>{seatAvail}</Text>
              <Text style={S.seatSummaryLabel}>Disponibles</Text>
            </View>
            <View style={[S.seatSummaryCard, { borderColor: "#FECACA" }]}>
              <Text style={[S.seatSummaryNum, { color: "#DC2626" }]}>{seatBooked}</Text>
              <Text style={S.seatSummaryLabel}>Réservés</Text>
            </View>
            <View style={[S.seatSummaryCard, { borderColor: "#C7D2FE" }]}>
              <Text style={[S.seatSummaryNum, { color: PRIMARY }]}>{seats.length}</Text>
              <Text style={S.seatSummaryLabel}>Total</Text>
            </View>
            <View style={[S.seatSummaryCard, { borderColor: "#FDE68A" }]}>
              <Text style={[S.seatSummaryNum, { color: "#D97706" }]}>{Math.round((seatBooked / Math.max(seats.length, 1)) * 100)}%</Text>
              <Text style={S.seatSummaryLabel}>Rempli</Text>
            </View>
          </View>

          <View style={S.seatLegend}>
            <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: "#F0FDF4", borderColor: GREEN }]} /><Text style={S.legendText}>Disponible</Text></View>
            <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: "#FEF2F2", borderColor: "#DC2626" }]} /><Text style={S.legendText}>Réservé</Text></View>
          </View>

          <View style={S.seatBusFrame}>
            <View style={S.busNoseWrap}><Feather name="truck" size={18} color="#94A3B8" /><Text style={S.busNoseText}>Conducteur</Text></View>
            <View style={S.seatGridWrap}>
              {Array.from({ length: Math.ceil(DEMO_BUS.capacity / 4) }, (_, rowIdx) => (
                <View key={rowIdx} style={S.seatRowWrap}>
                  <Text style={S.rowNum}>{rowIdx + 1}</Text>
                  {[0, 1].map(col => {
                    const s = seats.find(s => s.row === rowIdx + 1 && s.column === col);
                    return s ? (
                      <View key={col} style={[S.seat, s.status === "booked" ? S.seatBooked : S.seatAvail]}>
                        <Text style={[S.seatNum, { color: s.status === "booked" ? "#DC2626" : GREEN }]}>{s.number}</Text>
                      </View>
                    ) : <View key={col} style={S.seatEmpty} />;
                  })}
                  <View style={S.seatAisle} />
                  {[2, 3].map(col => {
                    const s = seats.find(s => s.row === rowIdx + 1 && s.column === col);
                    return s ? (
                      <View key={col} style={[S.seat, s.status === "booked" ? S.seatBooked : S.seatAvail]}>
                        <Text style={[S.seatNum, { color: s.status === "booked" ? "#DC2626" : GREEN }]}>{s.number}</Text>
                      </View>
                    ) : <View key={col} style={S.seatEmpty} />;
                  })}
                </View>
              ))}
            </View>
          </View>
        </>)}

        {/* ── Liste des voyageurs ── */}
        {activeTab === "embarquement" && (() => {
          const totalPax      = boarding.flatMap(b => b.passengers).length;
          const validatedCount = paxValidated.size;
          const pct           = totalPax > 0 ? Math.round((validatedCount / totalPax) * 100) : 0;
          return (
            <>
              {/* Header card */}
              <View style={S.paxHeaderCard}>
                <View style={S.paxHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.paxHeaderTitle}>Liste des voyageurs</Text>
                    <Text style={S.paxHeaderSub}>Trajet en cours · {DEMO_TRIP.from} → {DEMO_TRIP.to}</Text>
                  </View>
                  <View style={S.paxCountBadge}>
                    <Text style={S.paxCountText}>{validatedCount}/{totalPax}</Text>
                  </View>
                </View>
                {/* Progress bar */}
                <View style={S.paxProgressBg}>
                  <View style={[S.paxProgressFill, { width: `${pct}%` as any }]} />
                </View>
                <View style={S.paxProgressRow}>
                  <Text style={S.paxProgressLabel}>Embarquement</Text>
                  <Text style={S.paxProgressPct}>{pct}%</Text>
                </View>
              </View>

              {/* Search bar */}
              <View style={S.paxSearchBar}>
                <Feather name="search" size={15} color="#94A3B8" />
                <TextInput
                  style={S.paxSearchInput}
                  placeholder="Rechercher par nom ou siège…"
                  placeholderTextColor="#94A3B8"
                  value={passengerSearch}
                  onChangeText={setPassengerSearch}
                  clearButtonMode="while-editing"
                />
              </View>

              {/* Passenger cards */}
              {flatPassengers.length === 0 ? (
                <View style={S.paxEmpty}>
                  <Feather name="users" size={28} color="#CBD5E1" />
                  <Text style={S.paxEmptyText}>Aucun passager trouvé</Text>
                </View>
              ) : (
                flatPassengers.map(p => (
                  <View key={p.key} style={[S.paxCard, p.validated && S.paxCardDone]}>
                    {/* Avatar */}
                    <View style={[S.paxAvatar, { backgroundColor: p.validated ? "#ECFDF5" : "#EEF2FF" }]}>
                      <Text style={[S.paxAvatarText, { color: p.validated ? GREEN : PRIMARY }]}>
                        {p.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={S.paxCardName} numberOfLines={1}>{p.name}</Text>
                      <View style={S.paxBadgeRow}>
                        <View style={S.paxSeatBadge}>
                          <Feather name="grid" size={10} color={PRIMARY} />
                          <Text style={S.paxSeatText}>{p.seat}</Text>
                        </View>
                        <View style={[S.paxStatusBadge, { backgroundColor: p.validated ? "#ECFDF5" : "#FFFBEB", borderColor: p.validated ? "#6EE7B7" : "#FDE68A" }]}>
                          <Text style={[S.paxStatusText, { color: p.validated ? "#065F46" : "#D97706" }]}>
                            {p.validated ? "✓ Validé" : "Non validé"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Action */}
                    {p.validated ? (
                      <View style={S.paxDoneIcon}>
                        <Feather name="check-circle" size={22} color={GREEN} />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={S.paxValidateBtn}
                        onPress={() => validatePax(p.key, p.bookingId)}
                        activeOpacity={0.8}
                      >
                        <Text style={S.paxValidateBtnText}>Valider</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}

              {/* Summary footer */}
              <View style={S.paxFooter}>
                {[
                  { label: "Validés",     value: validatedCount, color: GREEN   },
                  { label: "En attente",  value: totalPax - validatedCount, color: "#D97706" },
                  { label: "Total",       value: totalPax,       color: "#64748B" },
                ].map(item => (
                  <View key={item.label} style={S.paxFooterItem}>
                    <Text style={[S.paxFooterNum, { color: item.color }]}>{item.value}</Text>
                    <Text style={S.paxFooterLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </>
          );
        })()}

        {/* ── Colis ── */}
        {activeTab === "colis" && (<>
          <Text style={S.sectionTitle}>Colis à traiter ({parcels.length})</Text>
          {parcels.map(parcel => {
            const st = PARCEL_STATUS[parcel.status] ?? PARCEL_STATUS.en_attente;
            return (
              <View key={parcel.id} style={S.parcelCard}>
                <View style={S.parcelTop}>
                  <View style={[S.parcelIcon, { backgroundColor: st.bg }]}><Feather name="package" size={18} color={st.color} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.parcelRef}>{parcel.trackingRef}</Text>
                    <Text style={S.parcelRoute}>{parcel.fromCity} → {parcel.toCity}</Text>
                  </View>
                  <View style={[S.badge, { backgroundColor: st.bg }]}><Text style={[S.badgeText, { color: st.color }]}>{st.label}</Text></View>
                </View>
                <View style={S.parcelDetails}>
                  {[
                    ["Expéditeur",   parcel.senderName],
                    ["Destinataire", parcel.receiverName],
                    ["Téléphone",    parcel.receiverPhone],
                    ["Poids / Prix", `${parcel.weight} kg · ${parcel.amount.toLocaleString()} FCFA`],
                  ].map(([label, val]) => (
                    <View key={label} style={S.detailRow}>
                      <Text style={S.detailLabel}>{label}</Text>
                      <Text style={S.detailValue}>{val}</Text>
                    </View>
                  ))}
                </View>
                <View style={S.parcelActions}>
                  {parcel.status === "en_attente" && (
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: "#EFF6FF" }]} onPress={() => updateParcel(parcel.id, "pris_en_charge", "pickup")} activeOpacity={0.8}>
                      <Feather name="package" size={14} color="#1D4ED8" /><Text style={[S.actionText, { color: "#1D4ED8" }]}>Prise en charge</Text>
                    </TouchableOpacity>
                  )}
                  {parcel.status === "pris_en_charge" && (
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: "#F5F3FF" }]} onPress={() => updateParcel(parcel.id, "en_transit", "transit")} activeOpacity={0.8}>
                      <Feather name="truck" size={14} color="#6D28D9" /><Text style={[S.actionText, { color: "#6D28D9" }]}>Mettre en transit</Text>
                    </TouchableOpacity>
                  )}
                  {parcel.status === "en_transit" && (
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: "#ECFDF5" }]} onPress={() => updateParcel(parcel.id, "livre", "deliver")} activeOpacity={0.8}>
                      <Feather name="check-circle" size={14} color={GREEN} /><Text style={[S.actionText, { color: GREEN }]}>Confirmer livraison</Text>
                    </TouchableOpacity>
                  )}
                  {parcel.status === "en_livraison" && (
                    <TouchableOpacity style={[S.actionBtn, { backgroundColor: "#ECFEFF" }]} onPress={() => updateParcel(parcel.id, "livre", "deliver")} activeOpacity={0.8}>
                      <Feather name="check" size={14} color="#0E7490" /><Text style={[S.actionText, { color: "#0E7490" }]}>Confirmer livraison</Text>
                    </TouchableOpacity>
                  )}
                  {parcel.status === "livre" && (
                    <View style={[S.actionBtn, { backgroundColor: "#F1F5F9" }]}>
                      <Feather name="check" size={14} color="#94A3B8" /><Text style={[S.actionText, { color: "#94A3B8" }]}>Livré ✓</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </>)}

      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "white" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 1 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  roleBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "white" },
  tabBar: { backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", maxHeight: 52 },
  tabBarContent: { paddingHorizontal: 16, gap: 4, alignItems: "center" },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: GREEN },
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  tabTextActive: { color: GREEN, fontFamily: "Inter_700Bold" },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN, marginLeft: 2 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A" },
  subLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  boardedCount: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: GREEN },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  busCard: { borderRadius: 20, overflow: "hidden" },
  busGradient: { padding: 20, gap: 8 },
  busTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  busIconWrap: { width: 50, height: 50, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  onlinePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ADE80" },
  onlineText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "white" },
  busName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "white" },
  busPlate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  elapsedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  elapsedText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.9)" },
  tripActionCard: { backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: "#E2E8F0", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, gap: 12 },
  tripActionLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  tripActionIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  tripActionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#0F172A" },
  tripActionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },
  startBtn: { backgroundColor: "#D97706", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  startBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "white" },
  tripErrorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12 },
  tripErrorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#DC2626" },
  tripCard: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  tripRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cityBlock: { flex: 1, gap: 4 },
  cityDot: { width: 10, height: 10, borderRadius: 5 },
  cityName: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#0F172A" },
  cityTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" },
  tripArrow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dashedLine: { flex: 1, height: 1, borderStyle: "dashed", borderWidth: 1, borderColor: "#CBD5E1" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { flex: 1, minWidth: "44%", backgroundColor: "white", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#DBEAFE", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  summaryNum: { fontSize: 26, fontFamily: "Inter_800ExtraBold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },
  quickActionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickAction: { width: "47%", alignItems: "center", gap: 6, padding: 14, borderRadius: 14 },
  quickActionText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  seatSummaryRow: { flexDirection: "row", gap: 8 },
  seatSummaryCard: { flex: 1, backgroundColor: "white", borderRadius: 12, padding: 12, borderWidth: 1.5, alignItems: "center" },
  seatSummaryNum: { fontSize: 20, fontFamily: "Inter_800ExtraBold" },
  seatSummaryLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },
  seatLegend: { flexDirection: "row", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5 },
  legendText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569" },
  seatBusFrame: { backgroundColor: "white", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  busNoseWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  busNoseText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94A3B8" },
  seatGridWrap: { alignItems: "center", gap: 6 },
  seatRowWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowNum: { width: 16, fontSize: 10, fontFamily: "Inter_400Regular", color: "#CBD5E1", textAlign: "center" },
  seat: { width: 36, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
  seatAvail: { backgroundColor: "#F0FDF4", borderColor: GREEN },
  seatBooked: { backgroundColor: "#FEF2F2", borderColor: "#DC2626" },
  seatEmpty: { width: 36, height: 32 },
  seatNum: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  seatAisle: { width: 14 },
  boardingCard: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  boardingDone: { backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0" },
  boardingTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bookingRefRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  bookingRef: { fontSize: 13, fontFamily: "Inter_700Bold" },
  paxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  seatTag: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  seatTagText: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },
  paxName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  paxMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 1 },
  validateBtn: { backgroundColor: GREEN, borderRadius: 12, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  validateText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 8 },
  totalLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  totalAmount: { fontSize: 14, fontFamily: "Inter_700Bold", color: GREEN },
  parcelCard: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  parcelTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  parcelIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  parcelRef: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A" },
  parcelRoute: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  parcelDetails: { gap: 6 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  detailValue: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#334155" },
  parcelActions: { flexDirection: "row", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  /* ── Passenger list (Liste des voyageurs) ── */
  paxHeaderCard: { backgroundColor: GREEN, borderRadius: 16, padding: 16, gap: 10, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  paxHeaderRow: { flexDirection: "row", alignItems: "center" },
  paxHeaderTitle: { fontSize: 16, fontFamily: "Inter_800ExtraBold", color: "white" },
  paxHeaderSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.78)", marginTop: 2 },
  paxCountBadge: { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  paxCountText: { fontSize: 13, fontFamily: "Inter_800ExtraBold", color: "white" },
  paxProgressBg: { height: 6, backgroundColor: "rgba(255,255,255,0.28)", borderRadius: 99, overflow: "hidden" },
  paxProgressFill: { height: "100%", backgroundColor: "white", borderRadius: 99 },
  paxProgressRow: { flexDirection: "row", justifyContent: "space-between" },
  paxProgressLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.82)" },
  paxProgressPct: { fontSize: 11, fontFamily: "Inter_700Bold", color: "white" },

  paxSearchBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "white", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1.5, borderColor: "#E2E8F0", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  paxSearchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#1E293B" },

  paxCard: { backgroundColor: "white", borderRadius: 14, padding: 13, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#E2E8F0", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  paxCardDone: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  paxAvatar: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  paxAvatarText: { fontSize: 14, fontFamily: "Inter_800ExtraBold" },
  paxCardName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 5 },
  paxBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  paxSeatBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  paxSeatText: { fontSize: 11, fontFamily: "Inter_700Bold", color: PRIMARY },
  paxStatusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  paxStatusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  paxDoneIcon: { flexShrink: 0, paddingHorizontal: 4 },
  paxValidateBtn: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, flexShrink: 0, shadowColor: GREEN, shadowOpacity: 0.35, shadowRadius: 6, elevation: 2 },
  paxValidateBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "white" },

  paxEmpty: { alignItems: "center", gap: 10, paddingVertical: 40 },
  paxEmptyText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#94A3B8" },

  paxFooter: { flexDirection: "row", backgroundColor: "white", borderRadius: 14, padding: 14, justifyContent: "space-around", borderWidth: 1, borderColor: "#E2E8F0", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  paxFooterItem: { alignItems: "center", gap: 2 },
  paxFooterNum: { fontSize: 22, fontFamily: "Inter_800ExtraBold" },
  paxFooterLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" },
});

/* ─── Scanner Styles ──────────────────────────────────────── */
const SC = StyleSheet.create({
  /* web banner */
  webBanner: { flexDirection: "row", gap: 8, backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, alignItems: "flex-start" },
  webBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#3730A3", lineHeight: 18 },
  /* manual card */
  manualCard: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  manualLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#334155" },
  manualInputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  manualInput: { flex: 1, borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#0F172A", backgroundColor: "#FAFAFA", letterSpacing: 1.5 },
  lookupBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: GREEN, justifyContent: "center", alignItems: "center" },
  /* demo chips */
  demoHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  demoChip: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  demoChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#475569", letterSpacing: 0.5 },
  /* open scan */
  scanOpenBtn: { backgroundColor: GREEN, borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  scanOpenText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "white" },
  /* camera */
  cameraWrap: { borderRadius: 20, overflow: "hidden", height: 340, position: "relative" },
  camera: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  scanFrame: { width: 220, height: 220, borderWidth: 3, borderColor: "white", borderRadius: 20, marginBottom: 16, opacity: 0.9 },
  scanHint: { color: "white", fontSize: 14, fontFamily: "Inter_600SemiBold", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  cameraLoading: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", gap: 12 },
  cameraLoadingText: { color: "white", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cancelScanBtn: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  cancelScanText: { color: "white", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  /* divider */
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  dividerText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  /* permission */
  permCenter: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  permCard: { alignItems: "center", gap: 14, padding: 32 },
  permTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#0F172A" },
  permSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" },
  permBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: GREEN, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  permBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "white" },
  /* error */
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#DC2626" },
  /* result card */
  resultCard: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  statusText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  clearBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  refText: { fontSize: 20, fontFamily: "Inter_800ExtraBold", color: "#0F172A", letterSpacing: 1 },
  tripPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#ECFDF5", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  tripPillText: { fontSize: 13, fontFamily: "Inter_700Bold", color: GREEN },
  tripPillDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  paxTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#334155" },
  paxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  seatTag: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 36, alignItems: "center" },
  seatTagText: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },
  paxName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0F172A" },
  paxMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8", marginTop: 1 },
  amountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 10 },
  amountLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  amountVal: { fontSize: 18, fontFamily: "Inter_800ExtraBold", color: GREEN },
  validateBtn: { backgroundColor: GREEN, borderRadius: 14, padding: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  validateText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "white" },
  boardedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#ECFDF5", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#A7F3D0" },
  boardedBannerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#065F46" },
});

/* ─── Confirm Modal Styles ───────────────────────────────── */
const CM = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "white", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, gap: 16, alignItems: "center" },
  iconWrap: { width: 68, height: 68, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 20, fontFamily: "Inter_800ExtraBold", color: "#0F172A", textAlign: "center" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center", lineHeight: 20 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 8, width: "100%" },
  cancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, backgroundColor: "#F1F5F9", alignItems: "center" },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#64748B" },
  confirmBtn: { flex: 1.4, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  confirmText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "white" },
});
