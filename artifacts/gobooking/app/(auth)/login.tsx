import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { AgentRole, UserRole, getDashboardPath, useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/utils/api";

/* ── Types ─────────────────────────────────────────────────────── */
interface AuthResponse {
  token: string;
  user: {
    id: string; name: string; email: string; phone: string;
    role: UserRole; agentRole?: AgentRole | null;
    extraRoles?: string[]; busId?: string | null; tripId?: string | null;
    companyId?: string | null; photoUrl?: string | null;
    referralCode?: string; walletBalance?: number; totalTrips?: number;
    createdAt: string;
  };
}

interface DemoRole {
  email: string; password: string;
  userRole: string; agentRole: string | null;
}

/* ── Config visuelle des rôles (label + icône + couleur) ────────
   Computed from userRole / agentRole — non codé en dur dans la liste.
   ──────────────────────────────────────────────────────────────── */
type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

interface RoleStyle {
  label: string;
  icon: FeatherIconName;
  color: string;
  bg: string;
  order: number;
}

const ROLE_STYLES: Record<string, RoleStyle> = {
  admin:              { label: "Super Admin",     icon: "shield",       color: "#6D28D9", bg: "#F5F3FF", order: 0  },
  compagnie:          { label: "Compagnie",       icon: "briefcase",    color: "#1D4ED8", bg: "#EEF2FF", order: 1  },
  chef_agence:        { label: "Chef Agence",     icon: "star",         color: "#3730A3", bg: "#E0E7FF", order: 2  },
  /* Guichet = vente physique en gare */
  agent_guichet:      { label: "Agent Guichet",   icon: "tag",          color: "#B45309", bg: "#FEF3C7", order: 3  },
  /* Réservation = gestion des réservations en ligne */
  agent_reservation:  { label: "Réservation",     icon: "calendar",     color: "#0369A1", bg: "#E0F2FE", order: 4  },
  agent_embarquement: { label: "Embarquement",    icon: "check-circle", color: "#15803D", bg: "#DCFCE7", order: 5  },
  agent_colis:        { label: "Agent Colis",     icon: "package",      color: "#5B21B6", bg: "#EDE9FE", order: 6  },
  agent_route:        { label: "Agent Route",     icon: "navigation",   color: "#92400E", bg: "#FFF7ED", order: 7  },
  validation_depart:  { label: "Validation",      icon: "check-square", color: "#0E7490", bg: "#ECFEFF", order: 8  },
  logistique:         { label: "Logistique",      icon: "truck",        color: "#166534", bg: "#D1FAE5", order: 9  },
  suivi:              { label: "Suivi",           icon: "map-pin",      color: "#9A3412", bg: "#FEF3C7", order: 10 },
  client:             { label: "Client",          icon: "user",         color: "#0891B2", bg: "#F0F9FF", order: 11 },
  user:               { label: "Client",          icon: "user",         color: "#0891B2", bg: "#F0F9FF", order: 11 },
};

function getRoleStyle(userRole: string, agentRole: string | null): RoleStyle {
  const key = agentRole ?? userRole;
  return ROLE_STYLES[key] ?? {
    label: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    icon: "user" as FeatherIconName,
    color: "#6B7280",
    bg: "#F3F4F6",
    order: 99,
  };
}

/* ── Composant principal ────────────────────────────────────────── */
const VISIBLE = 3; /* nombre de cartes visibles simultanément */

export default function LoginScreen() {
  const insets        = useSafeAreaInsets();
  const { login }     = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [demoLoading, setDemoLoading]   = useState<string | null>(null);
  const [fieldError, setFieldError]     = useState("");
  const [serverError, setServerError]   = useState("");
  const [carouselPage, setCarouselPage] = useState(0);

  /* Rôles démo chargés dynamiquement depuis la DB via API */
  const [demoRoles, setDemoRoles]        = useState<DemoRole[]>([]);
  const [demoRolesLoading, setDRLoading] = useState(true);

  /* Largeur d'une carte = (zone utile) / VISIBLE
     Zone utile = largeur écran − padding formCard (24×2) − gaps internes */
  const FORM_PADDING  = 24;
  const CARD_GAP      = 8;
  const ZONE_WIDTH    = screenWidth - FORM_PADDING * 2;
  const CARD_WIDTH    = (ZONE_WIDTH - CARD_GAP * (VISIBLE - 1)) / VISIBLE;
  const PAGE_SIZE     = CARD_WIDTH + CARD_GAP; /* distance de snap par carte */
  const totalPages    = Math.ceil(demoRoles.length / VISIBLE);

  useEffect(() => {
    apiFetch<DemoRole[]>("/auth/demo-roles")
      .then(data => {
        const sorted = [...data].sort((a, b) => {
          const oA = getRoleStyle(a.userRole, a.agentRole).order;
          const oB = getRoleStyle(b.userRole, b.agentRole).order;
          return oA - oB;
        });
        setDemoRoles(sorted);
      })
      .catch(() => {/* silently ignore — user can still log in manually */})
      .finally(() => setDRLoading(false));
  }, []);

  /* ── Connexion ─────────────────────────────────────────────── */
  const doLogin = async (em: string, pw: string) => {
    const res = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: em.trim(), password: pw }),
    });
    await login(res.token, res.user);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(getDashboardPath(res.user.role, res.user.agentRole) as never);
  };

  const handleLogin = async () => {
    setFieldError(""); setServerError("");
    if (!email.trim() && !password.trim()) { setFieldError("Veuillez remplir tous les champs."); return; }
    if (!email.trim())    { setFieldError("L'adresse email est requise."); return; }
    if (!password.trim()) { setFieldError("Le mot de passe est requis."); return; }
    setLoading(true);
    try { await doLogin(email, password); }
    catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Connexion échouée. Vérifiez vos identifiants.");
    } finally { setLoading(false); }
  };

  const handleDemoLogin = async (acc: DemoRole) => {
    setFieldError(""); setServerError("");
    const key = acc.agentRole ?? acc.userRole;
    setDemoLoading(key);
    try { await doLogin(acc.email, acc.password); }
    catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Impossible de se connecter avec ce compte démo.");
    } finally { setDemoLoading(null); }
  };

  const errorMessage = fieldError || serverError;
  const isServerErr  = !!serverError && !fieldError;

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.light.primary }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.light.primaryDark} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop:    Platform.OS === "web" ? 67 : insets.top + 20,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo / titre ── */}
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryDark]}
          style={styles.headerGradient}
        >
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.appName}>GoBooking</Text>
          <Text style={styles.tagline}>Voyagez partout en Côte d'Ivoire</Text>
        </LinearGradient>

        <View style={styles.formCard}>
          {/* ══ Accès rapide — rôles dynamiques ══════════════════ */}
          <View style={styles.demoBox}>
            <View style={styles.demoHeader}>
              <Feather name="zap" size={13} color="#B45309" />
              <Text style={styles.demoTitle}>Accès rapide — choisir un rôle</Text>
            </View>

            {demoRolesLoading ? (
              <View style={styles.demoLoaderRow}>
                <ActivityIndicator size="small" color="#B45309" />
                <Text style={styles.demoLoaderText}>Chargement des rôles…</Text>
              </View>
            ) : demoRoles.length === 0 ? (
              <Text style={styles.demoEmptyText}>Aucun rôle démo disponible</Text>
            ) : (
              <>
                {/* ── Carousel horizontal — 3 cartes visibles ── */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={PAGE_SIZE * VISIBLE}
                  decelerationRate="fast"
                  contentContainerStyle={{ gap: CARD_GAP }}
                  scrollEventThrottle={16}
                  onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const x    = e.nativeEvent.contentOffset.x;
                    const page = Math.round(x / (PAGE_SIZE * VISIBLE));
                    setCarouselPage(page);
                  }}
                >
                  {demoRoles.map((acc) => {
                    const key     = acc.agentRole ?? acc.userRole;
                    const rs      = getRoleStyle(acc.userRole, acc.agentRole);
                    const busy    = demoLoading === key;
                    const anyBusy = demoLoading !== null || loading;

                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.demoCard,
                          { width: CARD_WIDTH, borderColor: rs.color + "35", backgroundColor: rs.bg },
                          busy && styles.demoBusy,
                        ]}
                        onPress={() => handleDemoLogin(acc)}
                        activeOpacity={0.72}
                        disabled={anyBusy}
                      >
                        <View style={[styles.demoIconWrap, { backgroundColor: rs.color + "1A" }]}>
                          {busy
                            ? <ActivityIndicator size="small" color={rs.color} />
                            : <Feather name={rs.icon} size={17} color={rs.color} />
                          }
                        </View>
                        <Text style={[styles.demoCardLabel, { color: rs.color }]} numberOfLines={2}>
                          {rs.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* ── Points de pagination ── */}
                {totalPages > 1 && (
                  <View style={styles.dotRow}>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          i === carouselPage && styles.dotActive,
                        ]}
                      />
                    ))}
                  </View>
                )}

                {/* ── Hint swipe (disparaît après le 1er scroll) ── */}
                {carouselPage === 0 && demoRoles.length > VISIBLE && (
                  <View style={styles.swipeHint}>
                    <Feather name="chevrons-right" size={12} color="#B45309" />
                    <Text style={styles.swipeHintText}>Glisser pour voir plus</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── Séparateur ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou connexion manuelle</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Titre formulaire ── */}
          <Text style={styles.welcomeTitle}>Connexion</Text>
          <Text style={styles.welcomeSubtitle}>Entrez vos identifiants GoBooking</Text>

          {/* ── Erreur inline ── */}
          {!!errorMessage && (
            <View style={[styles.errorBanner, isServerErr && styles.errorBannerServer]}>
              <Feather
                name={isServerErr ? "alert-circle" : "alert-triangle"}
                size={15} color={isServerErr ? "#B91C1C" : "#92400E"}
              />
              <Text style={[styles.errorText, isServerErr && styles.errorTextServer]}>
                {errorMessage}
              </Text>
            </View>
          )}

          {/* ── Email ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputContainer, fieldError && !email.trim() && styles.inputError]}>
              <Feather name="mail" size={18} color={Colors.light.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="vous@exemple.com"
                placeholderTextColor={Colors.light.textMuted}
                value={email}
                onChangeText={(t) => { setEmail(t); setFieldError(""); setServerError(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* ── Mot de passe ── */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={[styles.inputContainer, fieldError && !password.trim() && styles.inputError]}>
              <Feather name="lock" size={18} color={Colors.light.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Votre mot de passe"
                placeholderTextColor={Colors.light.textMuted}
                value={password}
                onChangeText={(t) => { setPassword(t); setFieldError(""); setServerError(""); }}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={Colors.light.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* ── Bouton connexion ── */}
          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.loginButtonPressed,
              (loading || demoLoading !== null) && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading || demoLoading !== null}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <>
                  <Feather name="log-in" size={18} color="white" />
                  <Text style={styles.loginButtonText}>Se connecter</Text>
                </>
            }
          </Pressable>

          {/* ── Inscription ── */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Pas encore de compte ?</Text>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.registerLink}>S'inscrire</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Styles ─────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.light.background,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 64,
    alignItems: "center",
    gap: 8,
  },
  logoImage: {
    width: 110,
    height: 110,
    marginBottom: 4,
  },
  appName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "white",
  },
  tagline: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
  },
  formCard: {
    backgroundColor: Colors.light.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    flex: 1,
    padding: 24,
    paddingTop: 28,
  },

  /* ── Démo box ──────────────────────────────────────────────── */
  demoBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 4,
  },
  demoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  demoTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#92400E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  demoLoaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
  },
  demoLoaderText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#92400E",
  },
  demoEmptyText: {
    textAlign: "center",
    fontSize: 13,
    color: "#9CA3AF",
    paddingVertical: 8,
  },

  /* ── Carousel ──────────────────────────────────────────────── */
  demoCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 7,
    /* hauteur fixe pour uniformité */
    minHeight: 80,
  },
  demoBusy: {
    opacity: 0.65,
  },
  demoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  demoCardLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: 0.2,
    lineHeight: 13,
  },

  /* ── Dots de pagination ─────────────────────────────────────── */
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FDE68A",
  },
  dotActive: {
    width: 18,
    backgroundColor: "#B45309",
    borderRadius: 3,
  },

  /* ── Hint swipe ─────────────────────────────────────────────── */
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 6,
    opacity: 0.7,
  },
  swipeHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#B45309",
  },

  /* ── Divider ───────────────────────────────────────────────── */
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textMuted,
  },

  /* ── Titre ─────────────────────────────────────────────────── */
  welcomeTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.light.text,
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    marginBottom: 20,
  },

  /* ── Erreur ────────────────────────────────────────────────── */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  errorBannerServer: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#92400E",
  },
  errorTextServer: {
    color: "#B91C1C",
  },

  /* ── Inputs ────────────────────────────────────────────────── */
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.text,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FFF5F5",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.text,
  },
  eyeButton: {
    padding: 4,
  },

  /* ── Bouton ────────────────────────────────────────────────── */
  loginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  loginButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },

  /* ── Footer ────────────────────────────────────────────────── */
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
  },
  registerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.light.primary,
  },
});
