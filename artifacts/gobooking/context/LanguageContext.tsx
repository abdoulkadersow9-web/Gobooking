import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "fr" | "en";

export const translations = {
  fr: {
    lang: "fr" as Lang,

    // Tab bar
    tabAccueil: "Accueil",
    tabTrajets: "Trajets",
    tabColis: "Colis",
    tabSuivi: "Suivi",
    tabProfil: "Profil",

    // Colis screen
    mesColis: "Mes colis",
    suiviExpeditions: "Suivi de vos expéditions",
    envoyer: "Envoyer",
    tous: "Tous",
    enCours: "En cours",
    livres: "Livrés",
    suivre: "Suivre",
    aucunResultat: "Aucun résultat",
    aucunColisCategorie: "Aucun colis dans cette catégorie",
    voirTousLesColis: "Voir tous les colis",
    chargement: "Chargement…",
    connectezVous: "Connectez-vous pour voir vos colis",
    seConnecter: "Se connecter",
    expeditions: "expédition",
    expeditionsPlural: "expéditions",

    // Suivi screen
    suiviColis: "Suivi colis",
    suiviColisDesc: "Entrez votre numéro de suivi",
    numeroDeSuivi: "Numéro de suivi",
    placeholder: "GBX-XXXX-XXXX",
    rechercher: "Rechercher",
    colisIntrouvable: "Colis introuvable",
    colisIntrouvableDesc: "Aucun colis trouvé avec ce numéro.",
    resultats: "Résultats",

    // Parcel statuses
    statusEnAttente: "Colis enregistré",
    statusPrisEnCharge: "Reçu en agence",
    statusEnTransit: "En transit",
    statusEnLivraison: "En livraison",
    statusLivre: "Livré",
    statusAnnule: "Annulé",

    // Profile screen
    monCompte: "Mon compte",
    parametres: "Paramètres",
    langue: "Langue",
    langueActuelle: "Français",
    langueAutre: "English",
    deconnexion: "Déconnexion",
    deconnexionConfirm: "Êtes-vous sûr de vouloir vous déconnecter ?",
    annuler: "Annuler",
    modifier: "Modifier le profil",
    motDePasse: "Changer le mot de passe",
    aide: "Aide & FAQ",
    apropos: "À propos de GoBooking",
    administration: "Administration",
    adminDashboard: "Tableau de bord admin",
    mesReservations: "Mes réservations",
    support: "Support",

    // Home screen
    bonjour: "Bonjour",
    accesRapide: "Accès rapide",
    demandesColis: "Mes colis",
    mesReservationsHome: "Mes réservations",
    trajetsEtBillets: "Trajets & billets",
    suiviEtEnvois: "Suivi & envois",
    notifications: "Notifications",
    alertesInfos: "Alertes & infos",
    monProfil: "Mon profil",
    compteParametres: "Compte & paramètres",
  },

  en: {
    lang: "en" as Lang,

    // Tab bar
    tabAccueil: "Home",
    tabTrajets: "Trips",
    tabColis: "Parcels",
    tabSuivi: "Tracking",
    tabProfil: "Profile",

    // Colis screen
    mesColis: "My parcels",
    suiviExpeditions: "Track your shipments",
    envoyer: "Send",
    tous: "All",
    enCours: "In progress",
    livres: "Delivered",
    suivre: "Track",
    aucunResultat: "No results",
    aucunColisCategorie: "No parcels in this category",
    voirTousLesColis: "View all parcels",
    chargement: "Loading…",
    connectezVous: "Sign in to view your parcels",
    seConnecter: "Sign in",
    expeditions: "shipment",
    expeditionsPlural: "shipments",

    // Suivi screen
    suiviColis: "Parcel tracking",
    suiviColisDesc: "Enter your tracking number",
    numeroDeSuivi: "Tracking number",
    placeholder: "GBX-XXXX-XXXX",
    rechercher: "Search",
    colisIntrouvable: "Parcel not found",
    colisIntrouvableDesc: "No parcel found with this number.",
    resultats: "Results",

    // Parcel statuses
    statusEnAttente: "Parcel registered",
    statusPrisEnCharge: "Received at agency",
    statusEnTransit: "In transit",
    statusEnLivraison: "Out for delivery",
    statusLivre: "Delivered",
    statusAnnule: "Cancelled",

    // Profile screen
    monCompte: "My account",
    parametres: "Settings",
    langue: "Language",
    langueActuelle: "English",
    langueAutre: "Français",
    deconnexion: "Sign out",
    deconnexionConfirm: "Are you sure you want to sign out?",
    annuler: "Cancel",
    modifier: "Edit profile",
    motDePasse: "Change password",
    aide: "Help & FAQ",
    apropos: "About GoBooking",
    administration: "Administration",
    adminDashboard: "Admin dashboard",
    mesReservations: "My bookings",
    support: "Support",

    // Home screen
    bonjour: "Hello",
    accesRapide: "Quick access",
    demandesColis: "My parcels",
    mesReservationsHome: "My bookings",
    trajetsEtBillets: "Trips & tickets",
    suiviEtEnvois: "Track & send",
    notifications: "Notifications",
    alertesInfos: "Alerts & info",
    monProfil: "My profile",
    compteParametres: "Account & settings",
  },
} as const;

export type Translations = typeof translations.fr;

interface LanguageContextType {
  lang: Lang;
  t: Translations;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "fr",
  t: translations.fr,
  setLang: () => {},
  toggleLang: () => {},
});

const STORAGE_KEY = "gobooking_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "en" || saved === "fr") setLangState(saved);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "fr" ? "en" : "fr");
  }, [lang, setLang]);

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
