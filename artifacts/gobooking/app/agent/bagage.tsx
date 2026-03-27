/**
 * Agent Bagage — Module 2
 * Gestion des bagages liés aux réservations
 * - Sélection du départ
 * - Recherche passager (ref ou QR)
 * - Ajout bagage + photo + prix
 * - Ticket bagage avec QR code
 * - Historique des bagages par départ
 */
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";

const P       = "#92400E";   // Agent Bagage primary (leather brown)
const P_LIGHT = "#FEF3C7";
const P_MED   = "#FDE68A";
const NAVY    = "#0B3C5D";
const GREEN   = "#059669";
const RED     = "#DC2626";
const GRAY    = "#64748B";

const API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

/* ─── Types ─── */
interface Trip {
  id: string; from: string; to: string; date: string;
  departureTime: string; busName: string; busType: string;
  status: string; totalPassengers: number;
  passengersWithBagage: number; bagageItemCount: number;
}
interface BookingInfo {
  bookingId: string; bookingRef: string;
  passengerName: string; passengerPhone: string;
  tripId: string; from: string; to: string;
  departureTime: string; date: string;
  bagageStatus: string; existingBagages: BagageItem[];
  declaresOnline: boolean;
}
interface BagageItem {
  id: string; trackingRef: string; bookingId: string;
  passengerName: string; bagageType: string;
  description: string | null; weightKg: number | null;
  price: number; paymentStatus: string;
  photoUrl: string | null; status: string;
  createdAt: string;
}

const BAGAGE_TYPES = [
  { key: "valise",    label: "Valise",        icon: "briefcase" as const },
  { key: "sac",       label: "Sac",           icon: "shopping-bag" as const },
  { key: "carton",    label: "Carton",        icon: "package" as const },
  { key: "alimentaire",label:"Alimentaire",   icon: "coffee" as const },
  { key: "fragile",   label: "Fragile",       icon: "alert-triangle" as const },
  { key: "autre",     label: "Autre",         icon: "more-horizontal" as const },
];

const STATUS_COLORS: Record<string, string> = {
  "accepté":   GREEN,
  "chargé":    "#2563EB",
  "livré":     "#7C3AED",
  "refusé":    RED,
};

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function AgentBagage() {
  const { user } = useAuth();
  const token = (user as any)?.token ?? "";

  const [tab, setTab] = useState<"ajouter" | "liste">("ajouter");

  // Step management: "trips" → "search" → "form" → "ticket"
  const [step, setStep] = useState<"trips" | "search" | "form" | "ticket">("trips");

  // Trips
  const [trips, setTrips]         = useState<Trip[]>([]);
  const [tripsLoading, setTL]     = useState(true);
  const [selectedTrip, setTrip]   = useState<Trip | null>(null);

  // Search
  const [searchRef, setSearch]    = useState("");
  const [searching, setSearching] = useState(false);
  const [booking, setBooking]     = useState<BookingInfo | null>(null);
  const [searchErr, setSearchErr] = useState("");

  // Form
  const [bagageType, setBagType]  = useState("valise");
  const [description, setDesc]    = useState("");
  const [weightKg, setWeight]     = useState("");
  const [price, setPrice]         = useState("");
  const [payMethod, setPayMethod] = useState("espèces");
  const [notes, setNotes]         = useState("");
  const [photoUri, setPhotoUri]   = useState<string | null>(null);
  const [photoB64, setPhotoB64]   = useState<string | null>(null);
  const [uploadingPhoto, setUPh]  = useState(false);
  const [submitting, setSub]      = useState(false);

  // Ticket result
  const [ticket, setTicket]       = useState<{ trackingRef: string; photoUrl: string | null } | null>(null);

  // Liste
  const [items, setItems]         = useState<BagageItem[]>([]);
  const [itemsLoading, setIL]     = useState(false);
  const [refreshing, setRefr]     = useState(false);

  /* ─ Fetch trips ─ */
  const loadTrips = useCallback(async () => {
    setTL(true);
    try {
      const r = await fetch(`${API}/agent/bagage/trips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setTrips(Array.isArray(data) ? data : []);
    } catch { setTrips([]); }
    finally { setTL(false); }
  }, [token]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  /* ─ Fetch bagage list for selected trip ─ */
  const loadItems = useCallback(async (tripId: string) => {
    setIL(true);
    try {
      const r = await fetch(`${API}/agent/bagage/items/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally { setIL(false); setRefr(false); }
  }, [token]);

  useEffect(() => {
    if (tab === "liste" && selectedTrip) loadItems(selectedTrip.id);
  }, [tab, selectedTrip, loadItems]);

  /* ─ Search booking ─ */
  const searchBooking = async () => {
    const ref = searchRef.trim().toUpperCase();
    if (!ref) return;
    setSearching(true);
    setSearchErr("");
    setBooking(null);
    try {
      const r = await fetch(`${API}/agent/bagage/booking/${ref}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) { setSearchErr(data.error ?? "Réservation non trouvée"); }
      else { setBooking(data); setStep("form"); }
    } catch { setSearchErr("Erreur réseau"); }
    finally { setSearching(false); }
  };

  /* ─ Pick photo ─ */
  const pickPhoto = async (src: "camera" | "library") => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (src === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission refusée", "Accès caméra nécessaire"); return; }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.5, base64: true });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5, base64: true });
      }
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setPhotoB64(result.assets[0].base64 ?? null);
      }
    } catch (e) { console.error("photo pick:", e); }
  };

  /* ─ Submit bagage ─ */
  const handleSubmit = async () => {
    if (!booking || !selectedTrip) return;
    if (!price) { Alert.alert("Prix manquant", "Veuillez définir le prix du bagage"); return; }
    setSub(true);
    try {
      const body: Record<string, unknown> = {
        bookingId:     booking.bookingId,
        tripId:        booking.tripId,
        passengerName: booking.passengerName,
        passengerPhone:booking.passengerPhone,
        bookingRef:    booking.bookingRef,
        bagageType, description, notes,
        weightKg: weightKg ? parseFloat(weightKg) : null,
        price: parseFloat(price),
        paymentMethod: payMethod,
      };
      if (photoB64) body.photoBase64 = photoB64;

      const r = await fetch(`${API}/agent/bagage/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) { Alert.alert("Erreur", data.error ?? "Impossible d'enregistrer"); return; }
      setTicket({ trackingRef: data.trackingRef, photoUrl: data.photoUrl });
      setStep("ticket");
    } catch { Alert.alert("Erreur réseau"); }
    finally { setSub(false); }
  };

  /* ─ Reset to start a new bagage ─ */
  const resetForm = () => {
    setBooking(null); setSearch(""); setSearchErr("");
    setDesc(""); setWeight(""); setPrice(""); setNotes(""); setPayMethod("espèces");
    setBagType("valise"); setPhotoUri(null); setPhotoB64(null);
    setTicket(null); setStep("search");
  };

  /* ─ Reset to trip selection ─ */
  const resetAll = () => {
    resetForm(); setTrip(null); setStep("trips");
  };

  /* ═══════════════════ RENDERS ═══════════════════ */

  const renderTripCard = (t: Trip) => (
    <TouchableOpacity key={t.id} style={SL.tripCard} onPress={() => { setTrip(t); setStep("search"); }}>
      <View style={[SL.tripAccent, { backgroundColor: P }]} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <Text style={SL.tripRoute}>{t.from} → {t.to}</Text>
          <View style={[SL.statusBadge, { backgroundColor: P + "18" }]}>
            <Text style={[SL.statusBadgeText, { color: P }]}>{t.departureTime}</Text>
          </View>
        </View>
        <Text style={SL.tripMeta}>{t.busName ?? t.busType} · {t.date}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
          <View style={SL.tripStat}>
            <Feather name="users" size={11} color={GRAY} />
            <Text style={SL.tripStatText}>{t.totalPassengers} passager{t.totalPassengers !== 1 ? "s" : ""}</Text>
          </View>
          <View style={[SL.tripStat, t.passengersWithBagage > 0 && { backgroundColor: P_LIGHT }]}>
            <Feather name="briefcase" size={11} color={t.passengersWithBagage > 0 ? P : GRAY} />
            <Text style={[SL.tripStatText, t.passengersWithBagage > 0 && { color: P, fontWeight: "700" }]}>
              {t.passengersWithBagage} déclaré{t.passengersWithBagage !== 1 ? "s" : ""} en ligne
            </Text>
          </View>
          {t.bagageItemCount > 0 && (
            <View style={[SL.tripStat, { backgroundColor: "#F0FDF4" }]}>
              <Feather name="check-circle" size={11} color={GREEN} />
              <Text style={[SL.tripStatText, { color: GREEN, fontWeight: "700" }]}>
                {t.bagageItemCount} enregistré{t.bagageItemCount !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={SL.tripArrow}>
        <Feather name="chevron-right" size={18} color={P} />
      </View>
    </TouchableOpacity>
  );

  /* ── Step: trips ── */
  const renderTrips = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={tripsLoading} onRefresh={loadTrips} tintColor={P} />}>
      {/* Header info */}
      <View style={SL.infoBox}>
        <Feather name="info" size={14} color={P} />
        <Text style={[SL.infoText, { color: P }]}>
          Sélectionnez un départ pour commencer à enregistrer les bagages des passagers.
        </Text>
      </View>

      {/* Section header */}
      <View style={SL.sectionHdr}>
        <View style={[SL.sectionAccent, { backgroundColor: P }]} />
        <View style={[SL.sectionIconBox, { backgroundColor: P + "18" }]}>
          <Feather name="navigation" size={17} color={P} />
        </View>
        <Text style={[SL.sectionTitle, { color: P }]}>Départs du jour</Text>
        <View style={[SL.sectionBadge, { backgroundColor: P + "18" }]}>
          <Text style={[SL.sectionBadgeText, { color: P }]}>{trips.length}</Text>
        </View>
      </View>

      {tripsLoading ? (
        <ActivityIndicator color={P} style={{ marginTop: 40 }} />
      ) : trips.length === 0 ? (
        <View style={SL.emptyBox}>
          <Feather name="calendar" size={40} color="#CBD5E1" />
          <Text style={SL.emptyTitle}>Aucun départ aujourd'hui</Text>
          <Text style={SL.emptySub}>Les départs du jour apparaîtront ici</Text>
        </View>
      ) : (
        trips.map(renderTripCard)
      )}
    </ScrollView>
  );

  /* ── Step: search ── */
  const renderSearch = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}
      keyboardShouldPersistTaps="handled">
      {/* Selected trip banner */}
      {selectedTrip && (
        <View style={SL.tripBanner}>
          <View style={{ flex: 1 }}>
            <Text style={SL.tripBannerRoute}>{selectedTrip.from} → {selectedTrip.to}</Text>
            <Text style={SL.tripBannerMeta}>{selectedTrip.departureTime} · {selectedTrip.busName ?? selectedTrip.busType}</Text>
          </View>
          <TouchableOpacity onPress={resetAll} style={SL.changeTripBtn}>
            <Text style={SL.changeTripTxt}>Changer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search box */}
      <View style={SL.sectionHdr}>
        <View style={[SL.sectionAccent, { backgroundColor: P }]} />
        <View style={[SL.sectionIconBox, { backgroundColor: P + "18" }]}>
          <Feather name="search" size={17} color={P} />
        </View>
        <Text style={[SL.sectionTitle, { color: P }]}>Trouver un passager</Text>
      </View>

      <View style={SL.searchRow}>
        <TextInput
          style={SL.searchInput}
          placeholder="Référence de réservation (ex: GBX1Y2Z3)"
          placeholderTextColor="#9CA3AF"
          value={searchRef}
          onChangeText={t => { setSearch(t); setSearchErr(""); }}
          autoCapitalize="characters"
          returnKeyType="search"
          onSubmitEditing={searchBooking}
        />
        <TouchableOpacity style={[SL.searchBtn, { backgroundColor: P }]} onPress={searchBooking} disabled={searching}>
          {searching
            ? <ActivityIndicator color="#fff" size="small" />
            : <Feather name="arrow-right" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>

      {searchErr !== "" && (
        <View style={SL.errorBox}>
          <Feather name="alert-circle" size={14} color={RED} />
          <Text style={SL.errorText}>{searchErr}</Text>
        </View>
      )}

      {/* Hint */}
      <View style={SL.hintBox}>
        <Feather name="info" size={13} color="#60A5FA" />
        <Text style={SL.hintText}>
          Entrez la référence imprimée sur le billet du passager (format GBxxxxxxxx).
        </Text>
      </View>
    </ScrollView>
  );

  /* ── Step: form ── */
  const renderForm = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}
      keyboardShouldPersistTaps="handled">
      {/* Passenger card */}
      {booking && (
        <View style={SL.passengerCard}>
          <View style={[SL.passengerIconBox, { backgroundColor: P + "20" }]}>
            <Feather name="user" size={22} color={P} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={SL.passengerName}>{booking.passengerName}</Text>
            <Text style={SL.passengerRef}>Réf: {booking.bookingRef}</Text>
            {booking.passengerPhone !== "" && (
              <Text style={SL.passengerPhone}>{booking.passengerPhone}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => { setBooking(null); setSearch(""); setStep("search"); }} hitSlop={8}>
            <Feather name="x" size={18} color={GRAY} />
          </TouchableOpacity>
        </View>
      )}

      {/* Existing bagages */}
      {(booking?.existingBagages ?? []).length > 0 && (
        <View style={SL.existingBox}>
          <Text style={SL.existingTitle}>Bagages déjà enregistrés ({booking!.existingBagages.length})</Text>
          {booking!.existingBagages.map(b => (
            <View key={b.id} style={SL.existingItem}>
              <Feather name="briefcase" size={13} color={GREEN} />
              <Text style={SL.existingText}>{b.trackingRef} · {b.bagageType} · {(b.price ?? 0).toLocaleString()} FCFA</Text>
              <View style={[SL.statusBadge, { backgroundColor: GREEN + "18" }]}>
                <Text style={[SL.statusBadgeText, { color: GREEN }]}>{b.status}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Declared online banner */}
      {booking?.declaresOnline && (
        <View style={[SL.infoBox, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
          <Feather name="check-circle" size={14} color="#2563EB" />
          <Text style={[SL.infoText, { color: "#2563EB" }]}>
            Ce passager a déclaré un bagage lors de sa réservation en ligne.
          </Text>
        </View>
      )}

      {/* Type selector */}
      <View style={SL.sectionHdr}>
        <View style={[SL.sectionAccent, { backgroundColor: P }]} />
        <View style={[SL.sectionIconBox, { backgroundColor: P + "18" }]}>
          <Feather name="briefcase" size={17} color={P} />
        </View>
        <Text style={[SL.sectionTitle, { color: P }]}>Type de bagage</Text>
      </View>

      <View style={SL.typeGrid}>
        {BAGAGE_TYPES.map(bt => (
          <TouchableOpacity
            key={bt.key}
            style={[SL.typeChip, bagageType === bt.key && { backgroundColor: P, borderColor: P }]}
            onPress={() => setBagType(bt.key)}>
            <Feather name={bt.icon} size={16} color={bagageType === bt.key ? "#fff" : GRAY} />
            <Text style={[SL.typeChipText, bagageType === bt.key && { color: "#fff" }]}>{bt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Details */}
      <View style={SL.sectionHdr}>
        <View style={[SL.sectionAccent, { backgroundColor: P }]} />
        <View style={[SL.sectionIconBox, { backgroundColor: P + "18" }]}>
          <Feather name="edit-3" size={17} color={P} />
        </View>
        <Text style={[SL.sectionTitle, { color: P }]}>Détails</Text>
      </View>

      <TextInput
        style={SL.input}
        placeholder="Description (couleur, contenu...)"
        placeholderTextColor="#9CA3AF"
        value={description}
        onChangeText={setDesc}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TextInput
          style={[SL.input, { flex: 1 }]}
          placeholder="Poids (kg)"
          placeholderTextColor="#9CA3AF"
          value={weightKg}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={[SL.input, { flex: 1, borderColor: price ? P : "#E2E8F0" }]}
          placeholder="Prix (FCFA) *"
          placeholderTextColor="#9CA3AF"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />
      </View>

      {/* Payment method */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["espèces", "orange money", "mtn money"].map(m => (
          <TouchableOpacity key={m}
            style={[SL.payChip, payMethod === m && { backgroundColor: NAVY, borderColor: NAVY }]}
            onPress={() => setPayMethod(m)}>
            <Text style={[SL.payChipText, payMethod === m && { color: "#fff" }]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Photo section */}
      <View style={SL.sectionHdr}>
        <View style={[SL.sectionAccent, { backgroundColor: P }]} />
        <View style={[SL.sectionIconBox, { backgroundColor: P + "18" }]}>
          <Feather name="camera" size={17} color={P} />
        </View>
        <Text style={[SL.sectionTitle, { color: P }]}>Photo du bagage</Text>
        <View style={[SL.sectionBadge, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
          <Text style={[SL.sectionBadgeText, { color: GREEN }]}>Recommandé</Text>
        </View>
      </View>

      {photoUri ? (
        <View style={SL.photoPreviewBox}>
          <Image source={{ uri: photoUri }} style={SL.photoPreview} resizeMode="cover" />
          <View style={SL.photoActions}>
            <TouchableOpacity style={SL.photoActionBtn} onPress={() => pickPhoto("camera")} disabled={uploadingPhoto}>
              <Feather name="refresh-cw" size={15} color={P} />
              <Text style={[SL.photoActionText, { color: P }]}>Reprendre</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[SL.photoActionBtn, { borderColor: RED + "44" }]}
              onPress={() => { setPhotoUri(null); setPhotoB64(null); }}>
              <Feather name="trash-2" size={15} color={RED} />
              <Text style={[SL.photoActionText, { color: RED }]}>Supprimer</Text>
            </TouchableOpacity>
          </View>
          <View style={SL.photoConfirmBadge}>
            <Feather name="check" size={12} color={GREEN} />
            <Text style={SL.photoConfirmText}>Photo prête</Text>
          </View>
        </View>
      ) : (
        <View style={SL.photoPickBox}>
          <TouchableOpacity style={[SL.photoPickBtn, { backgroundColor: P }]} onPress={() => pickPhoto("camera")}>
            <Ionicons name="camera" size={22} color="#fff" />
            <Text style={SL.photoPickBtnText}>Prendre une photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={SL.photoPickBtnOutline} onPress={() => pickPhoto("library")}>
            <Ionicons name="images-outline" size={22} color={P} />
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        style={[SL.input, { height: 72, textAlignVertical: "top" }]}
        placeholder="Notes (optionnel)"
        placeholderTextColor="#9CA3AF"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      {/* Submit */}
      <TouchableOpacity
        style={[SL.submitBtn, { backgroundColor: P, shadowColor: P }, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={submitting}>
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <>
              <Feather name="check-circle" size={20} color="#fff" />
              <Text style={SL.submitText}>Enregistrer le bagage</Text>
              <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.7)" />
            </>}
      </TouchableOpacity>

      <View style={{ height: 20 }} />
    </ScrollView>
  );

  /* ── Step: ticket ── */
  const renderTicket = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16, alignItems: "center" }}>
      {/* Success header */}
      <View style={SL.successIcon}>
        <Feather name="check" size={34} color="#fff" />
      </View>
      <Text style={SL.successTitle}>Bagage enregistré !</Text>
      <Text style={SL.successSub}>Le ticket bagage a été créé avec succès</Text>

      {/* Ticket card */}
      {ticket && (
        <View style={SL.ticketCard}>
          <View style={[SL.ticketHeader, { backgroundColor: P }]}>
            <Feather name="briefcase" size={18} color="#fff" />
            <Text style={SL.ticketHeaderText}>Ticket Bagage</Text>
          </View>
          <View style={SL.ticketBody}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <QRCode
                value={ticket.trackingRef}
                size={140}
                color="#000"
                backgroundColor="#fff"
              />
            </View>
            <Text style={SL.ticketRef}>{ticket.trackingRef}</Text>
            {booking && (
              <>
                <View style={SL.ticketRow}>
                  <Text style={SL.ticketLabel}>Passager</Text>
                  <Text style={SL.ticketValue}>{booking.passengerName}</Text>
                </View>
                <View style={SL.ticketRow}>
                  <Text style={SL.ticketLabel}>Trajet</Text>
                  <Text style={SL.ticketValue}>{booking.from} → {booking.to}</Text>
                </View>
                <View style={SL.ticketRow}>
                  <Text style={SL.ticketLabel}>Départ</Text>
                  <Text style={SL.ticketValue}>{booking.departureTime}</Text>
                </View>
              </>
            )}
            <View style={SL.ticketRow}>
              <Text style={SL.ticketLabel}>Type</Text>
              <Text style={SL.ticketValue}>{bagageType}</Text>
            </View>
            <View style={SL.ticketRow}>
              <Text style={SL.ticketLabel}>Prix</Text>
              <Text style={[SL.ticketValue, { color: P, fontWeight: "800" }]}>
                {parseFloat(price || "0").toLocaleString()} FCFA
              </Text>
            </View>
            <View style={SL.ticketRow}>
              <Text style={SL.ticketLabel}>Paiement</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="check-circle" size={13} color={GREEN} />
                <Text style={[SL.ticketValue, { color: GREEN }]}>Payé · {payMethod}</Text>
              </View>
            </View>
            {ticket.photoUrl && (
              <View style={SL.ticketRow}>
                <Text style={SL.ticketLabel}>Photo</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="camera" size={13} color={GREEN} />
                  <Text style={[SL.ticketValue, { color: GREEN }]}>Enregistrée</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <TouchableOpacity style={[SL.submitBtn, { backgroundColor: P, width: "100%" }]} onPress={resetForm}>
        <Feather name="plus" size={20} color="#fff" />
        <Text style={SL.submitText}>Nouveau bagage</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[SL.outlineBtn, { width: "100%" }]} onPress={() => { setTab("liste"); if (selectedTrip) loadItems(selectedTrip.id); }}>
        <Feather name="list" size={18} color={P} />
        <Text style={[SL.outlineBtnText, { color: P }]}>Voir la liste des bagages</Text>
      </TouchableOpacity>
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  /* ── Liste tab ── */
  const renderListe = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
        setRefr(true);
        if (selectedTrip) loadItems(selectedTrip.id);
      }} tintColor={P} />}>
      {!selectedTrip ? (
        <View style={SL.emptyBox}>
          <Feather name="navigation" size={40} color="#CBD5E1" />
          <Text style={SL.emptyTitle}>Aucun départ sélectionné</Text>
          <Text style={SL.emptySub}>Allez dans l'onglet Enregistrer pour choisir un départ</Text>
          <TouchableOpacity style={[SL.submitBtn, { marginTop: 12, backgroundColor: P }]}
            onPress={() => setTab("ajouter")}>
            <Text style={SL.submitText}>Sélectionner un départ</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Trip summary */}
          <View style={SL.tripBanner}>
            <View style={{ flex: 1 }}>
              <Text style={SL.tripBannerRoute}>{selectedTrip.from} → {selectedTrip.to}</Text>
              <Text style={SL.tripBannerMeta}>{selectedTrip.departureTime} · {selectedTrip.busName ?? selectedTrip.busType}</Text>
            </View>
            <View style={[SL.statusBadge, { backgroundColor: GREEN + "18" }]}>
              <Text style={[SL.statusBadgeText, { color: GREEN }]}>{items.length} bagage{items.length !== 1 ? "s" : ""}</Text>
            </View>
          </View>

          {/* Section */}
          <View style={SL.sectionHdr}>
            <View style={[SL.sectionAccent, { backgroundColor: P }]} />
            <View style={[SL.sectionIconBox, { backgroundColor: P + "18" }]}>
              <Feather name="briefcase" size={17} color={P} />
            </View>
            <Text style={[SL.sectionTitle, { color: P }]}>Bagages enregistrés</Text>
            <View style={[SL.sectionBadge, { backgroundColor: P + "18" }]}>
              <Text style={[SL.sectionBadgeText, { color: P }]}>{items.length}</Text>
            </View>
          </View>

          {itemsLoading ? (
            <ActivityIndicator color={P} style={{ marginTop: 30 }} />
          ) : items.length === 0 ? (
            <View style={SL.emptyBox}>
              <Feather name="briefcase" size={40} color="#CBD5E1" />
              <Text style={SL.emptyTitle}>Aucun bagage enregistré</Text>
              <Text style={SL.emptySub}>Les bagages du départ sélectionné apparaîtront ici</Text>
            </View>
          ) : (
            items.map(item => {
              const sc = STATUS_COLORS[item.status] ?? GRAY;
              return (
                <View key={item.id} style={[SL.itemCard, { borderLeftColor: sc }]}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={SL.itemThumb} resizeMode="cover" />
                    ) : (
                      <View style={[SL.itemThumbEmpty, { backgroundColor: P + "18" }]}>
                        <Feather name="briefcase" size={18} color={P} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <Text style={SL.itemRef}>{item.trackingRef}</Text>
                        <View style={[SL.statusBadge, { backgroundColor: sc + "18" }]}>
                          <Text style={[SL.statusBadgeText, { color: sc }]}>{item.status}</Text>
                        </View>
                        {item.photoUrl && (
                          <View style={[SL.statusBadge, { backgroundColor: "#F0FDF4" }]}>
                            <Ionicons name="camera" size={9} color={GREEN} />
                            <Text style={[SL.statusBadgeText, { color: GREEN }]}>Photo</Text>
                          </View>
                        )}
                      </View>
                      <Text style={SL.itemPassenger}>{item.passengerName}</Text>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                        <View style={SL.tripStat}>
                          <Feather name="briefcase" size={11} color={GRAY} />
                          <Text style={SL.tripStatText}>{item.bagageType}</Text>
                        </View>
                        {item.weightKg != null && (
                          <View style={SL.tripStat}>
                            <Feather name="layers" size={11} color={GRAY} />
                            <Text style={SL.tripStatText}>{item.weightKg} kg</Text>
                          </View>
                        )}
                        <View style={[SL.tripStat, { backgroundColor: P_LIGHT }]}>
                          <Text style={[SL.tripStatText, { color: P, fontWeight: "700" }]}>
                            {(item.price ?? 0).toLocaleString()} FCFA
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );

  /* ─── Determine step content ─── */
  const renderAjouter = () => {
    if (step === "trips" || !selectedTrip) return renderTrips();
    if (step === "search") return renderSearch();
    if (step === "form") return renderForm();
    if (step === "ticket") return renderTicket();
    return null;
  };

  /* ─── Breadcrumb ─── */
  const breadcrumb = () => {
    if (step === "trips") return null;
    return (
      <View style={SL.breadcrumb}>
        <TouchableOpacity onPress={resetAll} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Feather name="home" size={13} color={P} />
          <Text style={[SL.breadText, { color: P }]}>Départs</Text>
        </TouchableOpacity>
        {(step === "search" || step === "form" || step === "ticket") && selectedTrip && (
          <>
            <Feather name="chevron-right" size={13} color={GRAY} />
            <TouchableOpacity onPress={() => { setBooking(null); setSearch(""); setStep("search"); }}>
              <Text style={SL.breadText}>{selectedTrip.from} → {selectedTrip.to}</Text>
            </TouchableOpacity>
          </>
        )}
        {(step === "form" || step === "ticket") && booking && (
          <>
            <Feather name="chevron-right" size={13} color={GRAY} />
            <Text style={[SL.breadText, { color: "#0F172A" }]}>{booking.passengerName.split(" ")[0]}</Text>
          </>
        )}
        {step === "ticket" && (
          <>
            <Feather name="chevron-right" size={13} color={GRAY} />
            <Text style={[SL.breadText, { color: GREEN }]}>✓ Enregistré</Text>
          </>
        )}
      </View>
    );
  };

  /* ══════════ MAIN RENDER ══════════ */
  return (
    <SafeAreaView style={SL.root} edges={["top"]}>
      {/* Header */}
      <View style={SL.header}>
        <TouchableOpacity onPress={() => router.back()} style={SL.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={SL.headerTitle}>Agent Bagage</Text>
          <Text style={SL.headerSub}>Gestion des bagages passagers</Text>
        </View>
        <TouchableOpacity
          style={[SL.refreshBtn, { opacity: tripsLoading ? 0.5 : 1 }]}
          onPress={loadTrips} disabled={tripsLoading}>
          <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={SL.tabs}>
        <TouchableOpacity
          style={[SL.tab, tab === "ajouter" && [SL.tabActive, { borderBottomColor: P }]]}
          onPress={() => setTab("ajouter")}>
          <Feather name="plus-circle" size={15} color={tab === "ajouter" ? P : GRAY} />
          <Text style={[SL.tabText, tab === "ajouter" && { color: P }]}>Enregistrer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[SL.tab, tab === "liste" && [SL.tabActive, { borderBottomColor: P }]]}
          onPress={() => { setTab("liste"); if (selectedTrip) loadItems(selectedTrip.id); }}>
          <Feather name="list" size={15} color={tab === "liste" ? P : GRAY} />
          <Text style={[SL.tabText, tab === "liste" && { color: P }]}>
            Liste{selectedTrip ? ` (${items.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Breadcrumb */}
      {tab === "ajouter" && breadcrumb()}

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === "ajouter" ? renderAjouter() : renderListe()}
      </View>
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════════ */
const SL = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  header: { backgroundColor: NAVY, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },

  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { },
  tabText: { fontSize: 13, fontWeight: "700", color: GRAY },

  breadcrumb: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  breadText: { fontSize: 12, fontWeight: "600", color: GRAY },

  sectionHdr: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  sectionAccent: { width: 5, height: 34, borderRadius: 3 },
  sectionIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "800", flex: 1 },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: "transparent" },
  sectionBadgeText: { fontSize: 12, fontWeight: "700" },

  tripCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: NAVY, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3, overflow: "hidden" },
  tripAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  tripRoute: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  tripMeta: { fontSize: 12, color: GRAY, marginTop: 1 },
  tripStat: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F8FAFC", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  tripStatText: { fontSize: 11, fontWeight: "600", color: GRAY },
  tripArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: P + "10", justifyContent: "center", alignItems: "center" },

  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },

  tripBanner: { backgroundColor: P + "10", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: P + "30" },
  tripBannerRoute: { fontSize: 14, fontWeight: "800", color: P },
  tripBannerMeta: { fontSize: 12, color: P + "99", marginTop: 1 },
  changeTripBtn: { backgroundColor: P + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  changeTripTxt: { fontSize: 12, fontWeight: "700", color: P },

  searchRow: { flexDirection: "row", gap: 10 },
  searchInput: { flex: 1, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#0F172A", fontWeight: "600" },
  searchBtn: { width: 52, height: 52, borderRadius: 12, justifyContent: "center", alignItems: "center" },

  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P_LIGHT, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: P_MED },
  infoText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  hintBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#EFF6FF", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#BFDBFE" },
  hintText: { flex: 1, fontSize: 12, color: "#3B82F6", lineHeight: 18 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { color: RED, fontSize: 13, fontWeight: "600" },

  passengerCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: NAVY, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: P + "30" },
  passengerIconBox: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  passengerName: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  passengerRef: { fontSize: 12, color: GRAY, marginTop: 1 },
  passengerPhone: { fontSize: 12, color: GRAY },

  existingBox: { backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, gap: 6, borderWidth: 1, borderColor: "#BBF7D0" },
  existingTitle: { fontSize: 12, fontWeight: "700", color: GREEN, marginBottom: 2 },
  existingItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  existingText: { flex: 1, fontSize: 12, color: "#374151" },

  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  typeChipText: { fontSize: 13, fontWeight: "700", color: GRAY },

  input: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#0F172A" },

  payChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  payChipText: { fontSize: 12, fontWeight: "700", color: GRAY },

  photoPickBox: { flexDirection: "row", gap: 10 },
  photoPickBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 14 },
  photoPickBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  photoPickBtnOutline: { width: 56, height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: P, backgroundColor: P + "10", justifyContent: "center", alignItems: "center" },

  photoPreviewBox: { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" },
  photoPreview: { width: "100%", height: 200 },
  photoActions: { flexDirection: "row", gap: 0 },
  photoActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F1F5F9", borderRightWidth: 0.5, borderRightColor: "#E2E8F0" },
  photoActionText: { fontSize: 13, fontWeight: "700" },
  photoConfirmBadge: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingVertical: 8, backgroundColor: "#F0FDF4" },
  photoConfirmText: { fontSize: 12, fontWeight: "700", color: GREEN },

  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  submitText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: P, backgroundColor: "transparent" },
  outlineBtnText: { fontSize: 14, fontWeight: "700" },

  emptyBox: { alignItems: "center", paddingVertical: 50, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155" },
  emptySub: { fontSize: 13, color: GRAY, textAlign: "center" },

  /* Ticket */
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: GREEN, justifyContent: "center", alignItems: "center", shadowColor: GREEN, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  successTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  successSub: { fontSize: 14, color: GRAY },
  ticketCard: { width: "100%", backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", shadowColor: NAVY, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
  ticketHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16 },
  ticketHeaderText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  ticketBody: { padding: 20, gap: 4 },
  ticketRef: { fontSize: 22, fontWeight: "900", color: "#0F172A", textAlign: "center", letterSpacing: 1, marginBottom: 12 },
  ticketRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  ticketLabel: { fontSize: 13, color: GRAY, fontWeight: "600" },
  ticketValue: { fontSize: 13, color: "#0F172A", fontWeight: "700" },

  /* Liste */
  itemCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: NAVY, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  itemRef: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  itemPassenger: { fontSize: 13, color: GRAY, fontWeight: "600" },
  itemThumb: { width: 56, height: 56, borderRadius: 10 },
  itemThumbEmpty: { width: 56, height: 56, borderRadius: 10, justifyContent: "center", alignItems: "center" },
});
