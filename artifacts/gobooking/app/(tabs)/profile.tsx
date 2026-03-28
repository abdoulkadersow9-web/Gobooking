import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { apiFetch } from "@/utils/api";

const _ws = (css: string): any => Platform.OS === "web" ? { boxShadow: css } : {};

interface WalletData {
  walletBalance: number;
  totalTrips: number;
  referralCode: string;
  totalReferrals: number;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, logout, isAdmin } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const topPad = Platform.OS === "web" ? 24 : insets.top;

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [copied, setCopied] = useState(false);
  const copyScaleAnim = useRef(new Animated.Value(1)).current;

  const avatarScale    = useRef(new Animated.Value(0.7)).current;
  const avatarOpacity  = useRef(new Animated.Value(0)).current;
  const statsSlide     = useRef(new Animated.Value(30)).current;
  const statsOpacity   = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const loyaltyBarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(avatarScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(avatarOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(180),
      Animated.parallel([
        Animated.spring(statsSlide, { toValue: 0, tension: 70, friction: 8, useNativeDriver: true }),
        Animated.timing(statsOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!token) return;
    apiFetch<WalletData>("/growth/wallet", { token })
      .then(setWallet)
      .catch(() => {});
  }, [token]);

  const loyaltyTrips = wallet?.totalTrips ?? user?.totalTrips ?? 0;
  const tripsToNextReward = Math.max(0, 10 - (loyaltyTrips % 10));
  const loyaltyLevel = loyaltyTrips >= 30 ? "Or" : loyaltyTrips >= 10 ? "Argent" : "Bronze";
  const loyaltyColor = loyaltyTrips >= 30 ? "#D97706" : loyaltyTrips >= 10 ? "#64748B" : "#B45309";

  useEffect(() => {
    const pct = Math.min(100, ((loyaltyTrips % 10) / 10) * 100);
    Animated.timing(loyaltyBarAnim, {
      toValue: pct,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [loyaltyTrips]);

  const refCode = wallet?.referralCode ?? user?.referralCode ?? "";

  const copyReferral = async () => {
    if (!refCode) return;
    await Clipboard.setStringAsync(refCode);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.spring(copyScaleAnim, { toValue: 1.15, speed: 30, bounciness: 8, useNativeDriver: true }),
      Animated.spring(copyScaleAnim, { toValue: 1,    speed: 20, bounciness: 4, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCopied(false), 2500);
  };

  const shareReferral = async () => {
    if (!refCode) return;
    try {
      await Share.share({
        message: `Rejoins GoBooking avec mon code parrainage "${refCode}" et gagne 500 FCFA sur ton premier voyage ! 🚌`,
        title: "GoBooking — Code parrainage",
      });
    } catch {}
  };

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
            router.replace("/(auth)/login");
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
    iconBg,
    iconColor,
  }: {
    icon: string;
    label: string;
    onPress: () => void;
    danger?: boolean;
    iconBg?: string;
    iconColor?: string;
  }) => (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: "#F8FAFC", transform: [{ scale: 0.99 }] }]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger, iconBg ? { backgroundColor: iconBg } : {}]}>
        <Feather name={icon as never} size={18} color={danger ? Colors.light.error : (iconColor ?? Colors.light.primary)} />
      </View>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      {!danger && <Feather name="chevron-right" size={16} color="#CBD5E1" />}
    </Pressable>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: 0,
        paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <LinearGradient
        colors={["#1650D0", "#1030B4", "#0A1C84"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.profileHeader, { paddingTop: topPad + 28 }]}
      >
        <Animated.View style={[styles.avatarRing, { transform: [{ scale: avatarScale }], opacity: avatarOpacity }]}>
          <LinearGradient colors={["rgba(255,255,255,0.40)", "rgba(255,255,255,0.12)"]} style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </Text>
          </LinearGradient>
        </Animated.View>
        <Animated.View style={{ alignItems: "center", opacity: avatarOpacity }}>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {isAdmin && (
            <View style={styles.adminTag}>
              <Feather name="shield" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={styles.adminTagText}>Administrator</Text>
            </View>
          )}
        </Animated.View>
      </LinearGradient>

      {/* Stats row — real data */}
      <Animated.View style={[styles.statsRow, { transform: [{ translateY: statsSlide }], opacity: statsOpacity }]}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{loyaltyTrips}</Text>
          <Text style={styles.statLabel}>Voyages</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#059669" }]}>
            {(wallet?.walletBalance ?? user?.walletBalance ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>FCFA Wallet</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: loyaltyColor }]}>{loyaltyLevel}</Text>
          <Text style={styles.statLabel}>Fidélité</Text>
        </View>
      </Animated.View>

      {/* Wallet card */}
      <Animated.View style={{ opacity: contentOpacity }}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mon portefeuille</Text>
        <LinearGradient colors={["#059669", "#047857", "#065F46"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.walletCard}>
          {/* Decorative circles */}
          <View style={styles.walletDecor1} />
          <View style={styles.walletDecor2} />
          <View style={styles.walletTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletLabel}>Solde disponible</Text>
              <Text style={styles.walletAmount}>
                {(wallet?.walletBalance ?? user?.walletBalance ?? 0).toLocaleString()} <Text style={{ fontSize: 16, opacity: 0.85 }}>FCFA</Text>
              </Text>
            </View>
            <View style={styles.walletIconWrap}>
              <Feather name="credit-card" size={26} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
          <View style={styles.walletSeparator} />
          <View style={styles.walletRow}>
            <View style={styles.walletStat}>
              <Feather name="award" size={14} color="rgba(255,255,255,0.75)" />
              <Text style={styles.walletStatText}>+500 FCFA par voyage confirmé</Text>
            </View>
            <View style={[styles.walletStat, { marginLeft: "auto" }]}>
              <Feather name="trending-up" size={13} color="rgba(255,255,255,0.6)" />
              <Text style={[styles.walletStatText, { color: "rgba(255,255,255,0.6)" }]}>
                {wallet?.totalTrips ?? user?.totalTrips ?? 0} voyages
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Loyalty card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Programme fidélité</Text>
        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyTop}>
            <View style={[styles.loyaltyBadge, { backgroundColor: loyaltyColor + "20" }]}>
              <Feather name="star" size={16} color={loyaltyColor} />
              <Text style={[styles.loyaltyBadgeText, { color: loyaltyColor }]}>{loyaltyLevel}</Text>
            </View>
            <Text style={styles.loyaltyTrips}>
              <Text style={styles.loyaltyTripsNum}>{loyaltyTrips}</Text> voyage{loyaltyTrips !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.loyaltyBar}>
            <Animated.View style={[styles.loyaltyProgress, {
              width: loyaltyBarAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
              backgroundColor: loyaltyColor,
            }]} />
          </View>
          <Text style={styles.loyaltyHint}>
            {tripsToNextReward === 0
              ? "Voyage gratuit disponible !"
              : `Encore ${tripsToNextReward} voyage${tripsToNextReward > 1 ? "s" : ""} pour un voyage gratuit`}
          </Text>
        </View>
      </View>

      {/* Referral section */}
      {refCode ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parrainage</Text>
          <View style={styles.referralCard}>
            <View style={styles.referralTop}>
              <Feather name="gift" size={20} color="#7C3AED" />
              <View style={{ flex: 1 }}>
                <Text style={styles.referralTitle}>Parrainez, gagnez 500 FCFA</Text>
                <Text style={styles.referralSub}>500 FCFA crédités pour chaque ami inscrit</Text>
              </View>
            </View>
            <View style={styles.referralCodeRow}>
              <View style={styles.referralCodeBox}>
                <Text
                  style={styles.referralCode}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {refCode}
                </Text>
              </View>
              <Pressable
                onPress={copyReferral}
                style={{ borderRadius: 10, overflow: "hidden" }}
              >
                <Animated.View style={[
                  styles.referralBtn,
                  { backgroundColor: copied ? "#059669" : Colors.light.primary },
                  { transform: [{ scale: copyScaleAnim }] },
                ]}>
                  <Feather name={copied ? "check" : "copy"} size={14} color="white" />
                  <Text style={styles.referralBtnText}>{copied ? "Copié !" : "Copier"}</Text>
                </Animated.View>
              </Pressable>
              <Pressable onPress={shareReferral} style={[styles.referralBtn, { backgroundColor: "#7C3AED" }]}>
                <Feather name="share-2" size={14} color="white" />
                <Text style={styles.referralBtnText}>Partager</Text>
              </Pressable>
            </View>
            {wallet?.totalReferrals != null && wallet.totalReferrals > 0 && (
              <View style={styles.referralStats}>
                <Feather name="users" size={13} color="#7C3AED" />
                <Text style={styles.referralStatsText}>
                  {wallet.totalReferrals} ami{wallet.totalReferrals > 1 ? "s" : ""} parrainé{wallet.totalReferrals > 1 ? "s" : ""}
                  {" "}· +{(wallet.totalReferrals * 500).toLocaleString()} FCFA gagnés
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {/* Mon compte */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.monCompte}</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="user"   label={t.modifier}    onPress={() => {}} iconBg="#EEF4FF" iconColor="#1650D0" />
          <View style={styles.menuDivider} />
          <MenuItem icon="lock"   label={t.motDePasse}  onPress={() => {}} iconBg="#F0FDF4" iconColor="#059669" />
        </View>
      </View>

      {/* Mes réservations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.mesReservations}</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="bookmark" label={t.mesReservations} onPress={() => router.push("/(tabs)/bookings")} iconBg="#EEF4FF" iconColor="#1650D0" />
        </View>
      </View>

      {/* Language */}
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


      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.support}</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="help-circle" label={t.aide}    onPress={() => {}} iconBg="#FFFBEB" iconColor="#D97706" />
          <View style={styles.menuDivider} />
          <MenuItem icon="info"        label={t.apropos} onPress={() => {}} iconBg="#F5F3FF" iconColor="#7C3AED" />
        </View>
      </View>

      {/* Déconnexion */}
      <View style={styles.section}>
        <View style={styles.menuCard}>
          <MenuItem icon="log-out" label={t.deconnexion} onPress={handleLogout} danger />
        </View>
      </View>
      </Animated.View>
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
    paddingHorizontal: 20,
    paddingBottom: 38,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
    marginBottom: 16,
    padding: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  userName: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "white",
    letterSpacing: -0.5,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 4,
  },
  adminTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  adminTagText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 20,
    borderRadius: 26,
    padding: 22,
    marginTop: -36,
    marginBottom: 8,
    shadowColor: "#1650D0",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#E8ECFA",
    ..._ws("0 14px 32px rgba(22,80,208,0.12)"),
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.light.primary,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#7A8FAA",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E8ECFA",
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 21,
    fontFamily: "Inter_700Bold",
    color: "#06101F",
    letterSpacing: -0.6,
    borderLeftWidth: 4,
    borderLeftColor: "#1650D0",
    paddingLeft: 12,
    marginBottom: 22,
  },

  // Wallet card
  walletCard: {
    borderRadius: 28,
    padding: 26,
    gap: 18,
    overflow: "hidden",
    shadowColor: "#1650D0",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 36,
    elevation: 12,
    ..._ws("0 16px 36px rgba(22,80,208,0.28)"),
  },
  walletDecor1: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  walletDecor2: {
    position: "absolute",
    bottom: -20,
    left: 60,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  walletTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  walletLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.72)",
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  walletAmount: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "white",
    letterSpacing: -1,
  },
  walletIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  walletSeparator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  walletStatText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.82)",
  },

  // Loyalty card
  loyaltyCard: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#ECEEF8",
    ..._ws("0 8px 22px rgba(0,0,0,0.07)"),
  },
  loyaltyTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  loyaltyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  loyaltyBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  loyaltyTrips: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  loyaltyTripsNum: {
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  loyaltyBar: {
    height: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 5,
    overflow: "hidden",
  },
  loyaltyProgress: {
    height: "100%",
    borderRadius: 4,
  },
  loyaltyHint: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },

  // Referral card
  referralCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 22,
    gap: 16,
    borderWidth: 1.5,
    borderColor: "#E9D5FF",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 22,
    elevation: 6,
    ..._ws("0 8px 22px rgba(124,58,237,0.10)"),
  },
  referralTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  referralTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
  },
  referralSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  referralCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  referralCodeBox: {
    flex: 1,
    backgroundColor: "#F5F3FF",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#DDD6FE",
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  referralCode: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#7C3AED",
    letterSpacing: 1.5,
  },
  referralBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  referralBtnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  referralStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F3FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  referralStatsText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#7C3AED",
  },

  // Menu items
  menuCard: {
    backgroundColor: "white",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#ECEEF8",
    ..._ws("0 8px 22px rgba(0,0,0,0.07)"),
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 17,
    gap: 16,
  },
  menuItemPressed: {
    backgroundColor: "#F4F6FF",
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  menuIconDanger: {
    backgroundColor: "#FEF2F2",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  menuLabelDanger: {
    color: "#DC2626",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F1F3FA",
    marginLeft: 80,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingLeft: 20,
  },
  langLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  langIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EEF4FF",
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
