import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Ticket, Package, Users, Map,
  BarChart3, FileText, LogOut, Menu, X, TrendingUp,
  Building2, Bus, AlertTriangle, ClipboardList, ShieldCheck,
  Wrench, Fuel, Radio, UserCheck, BarChart2,
  MessageSquare, Settings, History, Star, Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/* ══════════════════════════════════════════════════════
   NAVIGATION STRUCTURE — 5 sections métier
══════════════════════════════════════════════════════ */

type NavItem = { path: string; label: string; icon: any };
type NavSection = { section: string; color: string; items: NavItem[] };

const COMPANY_NAV_SECTIONS: NavSection[] = [
  {
    section: "EXPLOITATION",
    color: "#2563EB",
    items: [
      { path: "/admin/dashboard",    label: "Vue d'ensemble",   icon: LayoutDashboard },
      { path: "/admin/trajets",      label: "Trajets",          icon: Map },
      { path: "/admin/embarquement", label: "Embarquement",     icon: UserCheck },
      { path: "/admin/affectation",  label: "Affectation",      icon: Users },
    ],
  },
  {
    section: "LOGISTIQUE",
    color: "#059669",
    items: [
      { path: "/admin/suivi-engins", label: "Suivi Engins",     icon: Bus },
      { path: "/admin/maintenance",  label: "Maintenance",      icon: Wrench },
      { path: "/admin/carburant",    label: "Carburant",        icon: Fuel },
      { path: "/admin/suivi-live",   label: "Suivi Live (GPS)", icon: Radio },
      { path: "/admin/alertes",      label: "Alertes",          icon: AlertTriangle },
    ],
  },
  {
    section: "COMMERCIAL",
    color: "#D97706",
    items: [
      { path: "/admin/reservations", label: "Réservations",     icon: Ticket },
      { path: "/admin/billets",      label: "Billets guichet",  icon: FileText },
      { path: "/admin/avis",         label: "Avis clients",     icon: Star },
    ],
  },
  {
    section: "COLIS",
    color: "#7C3AED",
    items: [
      { path: "/admin/colis",           label: "Colis",          icon: Package },
      { path: "/admin/colis-historique",label: "Historique",     icon: History },
    ],
  },
  {
    section: "ANALYSE & GESTION",
    color: "#475569",
    items: [
      { path: "/admin/analytics",    label: "Analytics",        icon: BarChart3 },
      { path: "/admin/financier",    label: "Rentabilité",      icon: TrendingUp },
      { path: "/admin/rapports",     label: "Rapports agents",  icon: ClipboardList },
      { path: "/admin/sms-marketing",label: "SMS Marketing",    icon: MessageSquare },
      { path: "/admin/agents",       label: "Agents",           icon: UserCheck },
      { path: "/admin/factures",     label: "Factures",         icon: FileText },
      { path: "/admin/parametres",   label: "Paramètres",       icon: Settings },
    ],
  },
];

const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    section: "SUPERVISION",
    color: "#7C3AED",
    items: [
      { path: "/admin/dashboard",    label: "Vue d'ensemble",   icon: LayoutDashboard },
      { path: "/admin/companies",    label: "Compagnies",       icon: Building2 },
      { path: "/admin/agents",       label: "Agents",           icon: Users },
    ],
  },
  {
    section: "EXPLOITATION",
    color: "#2563EB",
    items: [
      { path: "/admin/trajets",      label: "Trajets",          icon: Map },
      { path: "/admin/alertes",      label: "Alertes",          icon: AlertTriangle },
    ],
  },
  {
    section: "COMMERCIAL & COLIS",
    color: "#D97706",
    items: [
      { path: "/admin/reservations", label: "Réservations",     icon: Ticket },
      { path: "/admin/colis",        label: "Colis",            icon: Package },
    ],
  },
  {
    section: "ANALYSE & GESTION",
    color: "#475569",
    items: [
      { path: "/admin/analytics",    label: "Analytics",        icon: BarChart3 },
      { path: "/admin/financier",    label: "Financier",        icon: TrendingUp },
      { path: "/admin/rapports",     label: "Rapports agents",  icon: ClipboardList },
    ],
  },
];

/* ══════════════════════════════════════════════════════
   SIDEBAR NAV SECTION COMPONENT
══════════════════════════════════════════════════════ */
function SidebarSection({ section, onClose }: { section: NavSection; onClose?: () => void }) {
  const [location] = useLocation();
  return (
    <div className="mb-2">
      <p className="text-[10px] font-bold tracking-widest px-4 py-1.5 opacity-40 uppercase" style={{ color: section.color }}>
        {section.section}
      </p>
      {section.items.map((item) => {
        const isActive = location === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={onClose}
            className={`flex items-center gap-3 px-4 py-2.5 mx-1 rounded-xl transition-all duration-150 text-sm
              ${isActive
                ? "font-semibold shadow-lg"
                : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            style={isActive ? {
              backgroundColor: section.color + "22",
              color: section.color === "#475569" ? "#CBD5E1" : section.color,
              boxShadow: `0 4px 12px ${section.color}33`,
            } : {}}
          >
            <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
            <span>{item.label}</span>
            {isActive && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: section.color }} />
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   APP LAYOUT
══════════════════════════════════════════════════════ */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout, isSuperAdmin, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navSections = isSuperAdmin ? ADMIN_NAV_SECTIONS : COMPANY_NAV_SECTIONS;
  const allItems = navSections.flatMap((s) => s.items);
  const roleLabel = isSuperAdmin ? "Super Administrateur" : "Espace Compagnie";
  const roleColor = isSuperAdmin ? "#7C3AED" : "#D97706";

  const currentLabel = allItems.find((n) => n.path === location)?.label || "Administration";

  function SidebarContent({ onClose }: { onClose?: () => void }) {
    return (
      <>
        <div className="h-20 flex items-center px-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-lg"
              style={{ backgroundColor: roleColor }}>
              G
            </div>
            <div>
              <span className="font-bold tracking-tight text-base block text-white">GoBooking</span>
              <span className="text-[11px] opacity-50 text-white">{roleLabel}</span>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-3 mb-2 rounded-xl px-3 py-2 flex items-center gap-2 border border-white/10 bg-white/5">
          {isSuperAdmin
            ? <ShieldCheck size={14} className="text-purple-400" />
            : <Building2 size={14} className="text-amber-400" />
          }
          <span className="text-xs font-semibold" style={{ color: isSuperAdmin ? "#C4B5FD" : "#FCD34D" }}>
            {isSuperAdmin ? "Admin Global" : user?.name || "Admin Compagnie"}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 pr-1 space-y-1 scrollbar-thin">
          {navSections.map((section) => (
            <SidebarSection key={section.section} section={section} onClose={onClose} />
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0">
          {user && (
            <div className="px-3 py-2 mb-2 rounded-xl bg-white/5">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-white/40 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-white/50 hover:bg-white/10 hover:text-red-400 transition-colors text-sm"
          >
            <LogOut size={17} />
            <span>Déconnexion</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground shadow-2xl z-20 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25 }}
            className="w-60 bg-sidebar text-sidebar-foreground shadow-2xl relative z-10 flex flex-col h-full"
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
              <span className="font-bold text-white">GoBooking</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent onClose={() => setIsMobileMenuOpen(false)} />
            </div>
          </motion.aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 -ml-2 text-muted-foreground" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={22} />
            </button>
            <h1 className="text-base font-bold text-foreground">{currentLabel}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-foreground">{user?.name || roleLabel}</span>
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
            </div>
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
              style={{ backgroundColor: roleColor }}
            >
              {(user?.name?.[0] || (isSuperAdmin ? "A" : "C")).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6 bg-background">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
