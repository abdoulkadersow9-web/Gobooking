import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Ticket, Package, Users, Map,
  BarChart3, FileText, LogOut, Menu, X, TrendingUp,
  Building2, AlertTriangle, ClipboardList, ShieldCheck,
  Wrench, Fuel, Radio, UserCheck, Settings, History,
  Star, MessageSquare, ChevronRight, Store,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/* ══════════════════════════════════════════════════════
   COMPANY NAVIGATION — 6 sections métier claires
══════════════════════════════════════════════════════ */

type NavItem = {
  path: string;
  label: string;
  icon: any;
  badge?: string;
};

const COMPANY_MAIN_NAV: NavItem[] = [
  { path: "/admin/dashboard",    label: "Statistiques",     icon: LayoutDashboard },
  { path: "/admin/trajets",      label: "Trajets",          icon: Map },
  { path: "/admin/colis",        label: "Colis",            icon: Package },
  { path: "/admin/agents",       label: "Agents",           icon: Users },
  { path: "/admin/alertes",      label: "Alertes",          icon: AlertTriangle },
  { path: "/admin/parametres",   label: "Paramètres",       icon: Settings },
];

const COMPANY_SECONDARY_NAV: NavItem[] = [
  { path: "/admin/reservations",  label: "Réservations",    icon: Ticket },
  { path: "/admin/suivi-engins",  label: "Suivi engins",   icon: Map },
  { path: "/admin/embarquement",  label: "Embarquement",   icon: UserCheck },
  { path: "/admin/affectation",   label: "Affectation",    icon: Users },
  { path: "/admin/maintenance",   label: "Maintenance",    icon: Wrench },
  { path: "/admin/financier",     label: "Rentabilité",    icon: TrendingUp },
  { path: "/admin/sms-marketing", label: "SMS Marketing",  icon: MessageSquare },
  { path: "/admin/rapports",      label: "Rapports",       icon: ClipboardList },
  { path: "/admin/factures",      label: "Factures",       icon: FileText },
];

/* ══════════════════════════════════════════════════════
   ADMIN NAVIGATION — sections superviseur global
══════════════════════════════════════════════════════ */

type AdminSection = { label: string; color: string; items: NavItem[] };

const ADMIN_NAV_SECTIONS: AdminSection[] = [
  {
    label: "SUPERVISION",
    color: "#7C3AED",
    items: [
      { path: "/admin/dashboard",    label: "Vue d'ensemble",  icon: LayoutDashboard },
      { path: "/admin/companies",    label: "Compagnies",      icon: Building2 },
      { path: "/admin/agences",      label: "Agences",         icon: Store },
      { path: "/admin/agents",       label: "Agents",          icon: Users },
    ],
  },
  {
    label: "EXPLOITATION",
    color: "#2563EB",
    items: [
      { path: "/admin/trajets",      label: "Trajets",         icon: Map },
      { path: "/admin/alertes",      label: "Alertes",         icon: AlertTriangle },
    ],
  },
  {
    label: "COMMERCIAL & COLIS",
    color: "#D97706",
    items: [
      { path: "/admin/reservations", label: "Réservations",    icon: Ticket },
      { path: "/admin/colis",        label: "Colis",           icon: Package },
    ],
  },
  {
    label: "ANALYSE",
    color: "#475569",
    items: [
      { path: "/admin/analytics",    label: "Analytics",       icon: BarChart3 },
      { path: "/admin/financier",    label: "Financier",       icon: TrendingUp },
      { path: "/admin/rapports",     label: "Rapports agents", icon: ClipboardList },
    ],
  },
];

/* ══════════════════════════════════════════════════════
   COMPANY SIDEBAR
══════════════════════════════════════════════════════ */
function CompanySidebar({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [showSecondary, setShowSecondary] = React.useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-18 flex items-center px-5 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FF6B00] flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="GoBooking" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <span className="font-bold text-base text-white block leading-tight">GoBooking</span>
            <span className="text-[11px] text-white/50">Espace Compagnie</span>
          </div>
        </div>
      </div>

      {/* User badge */}
      <div className="mx-4 mt-3 mb-1 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
          {(user?.name?.[0] || "C").toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-300 truncate">{user?.name || "Compagnie"}</p>
          <p className="text-[10px] text-white/40 truncate">{user?.email || ""}</p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 pt-3 space-y-0.5">
        {COMPANY_MAIN_NAV.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path} onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium relative
                ${isActive
                  ? "bg-amber-500/15 text-amber-300 font-semibold"
                  : "text-white/60 hover:bg-white/8 hover:text-white"
                }`}
            >
              {isActive && <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-amber-400" />}
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isActive ? "bg-amber-500/20" : "bg-transparent"}`}>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">{item.badge}</span>
              )}
            </Link>
          );
        })}

        {/* Secondary nav toggle */}
        <button
          onClick={() => setShowSecondary(!showSecondary)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white/30 hover:text-white/50 transition-colors mt-2"
        >
          <div className="flex-1 h-px bg-white/10" />
          <span>Plus</span>
          <ChevronRight size={12} className={`transition-transform ${showSecondary ? "rotate-90" : ""}`} />
          <div className="flex-1 h-px bg-white/10" />
        </button>

        {showSecondary && COMPANY_SECONDARY_NAV.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path} onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-xs
                ${isActive ? "bg-white/10 text-white font-semibold" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
            >
              <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
              {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-white/50" />}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-white/40 hover:bg-white/10 hover:text-red-400 transition-colors text-sm">
          <LogOut size={16} />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ADMIN SIDEBAR
══════════════════════════════════════════════════════ */
function AdminSidebar({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const allItems = ADMIN_NAV_SECTIONS.flatMap((s) => s.items);

  return (
    <div className="flex flex-col h-full">
      <div className="h-18 flex items-center px-5 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FF6B00] flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="GoBooking" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <span className="font-bold text-base text-white block leading-tight">GoBooking</span>
            <span className="text-[11px] text-white/50">Super Admin</span>
          </div>
        </div>
      </div>

      <div className="mx-4 mt-3 mb-1 px-3 py-2 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center gap-2">
        <ShieldCheck size={14} className="text-purple-400 shrink-0" />
        <p className="text-xs font-semibold text-purple-300 truncate">{user?.name || "Admin Global"}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pt-3 space-y-3">
        {ADMIN_NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="flex items-center gap-1.5 px-3 py-1.5 mt-1">
              <div className="h-px flex-1 opacity-20" style={{ backgroundColor: section.color }} />
              <p className="text-[9px] font-bold tracking-widest opacity-60 uppercase" style={{ color: section.color }}>
                {section.label}
              </p>
              <div className="h-px flex-1 opacity-20" style={{ backgroundColor: section.color }} />
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location === item.path;
                const Icon = item.icon;
                return (
                  <Link key={item.path} href={item.path} onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium relative
                      ${isActive ? "font-semibold" : "text-white/60 hover:bg-white/8 hover:text-white"}`}
                    style={isActive ? { backgroundColor: section.color + "18", color: section.color } : {}}
                  >
                    {isActive && <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ backgroundColor: section.color }} />}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={isActive ? { backgroundColor: section.color + "25" } : {}}>
                      <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 shrink-0">
        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-white/40 hover:bg-white/10 hover:text-red-400 transition-colors text-sm">
          <LogOut size={16} />
          <span>Déconnexion</span>
        </button>
      </div>
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

  const roleLabel = isSuperAdmin ? "Super Administrateur" : "Espace Compagnie";
  const roleColor = isSuperAdmin ? "#7C3AED" : "#D97706";

  const allNavItems = isSuperAdmin
    ? ADMIN_NAV_SECTIONS.flatMap((s) => s.items)
    : [...COMPANY_MAIN_NAV, ...COMPANY_SECONDARY_NAV];
  const currentNavItem = allNavItems.find((n) => n.path === location);
  const currentLabel = currentNavItem?.label || "GoBooking";
  const CurrentIcon = currentNavItem?.icon;

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-56 flex-col bg-sidebar text-sidebar-foreground shadow-2xl z-20 shrink-0">
        {isSuperAdmin ? <AdminSidebar /> : <CompanySidebar />}
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-56 bg-sidebar text-sidebar-foreground shadow-2xl relative z-10 h-full flex flex-col"
          >
            <div className="absolute top-4 right-4">
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            {isSuperAdmin
              ? <AdminSidebar onClose={() => setIsMobileMenuOpen(false)} />
              : <CompanySidebar onClose={() => setIsMobileMenuOpen(false)} />
            }
          </motion.aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 md:px-5 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 -ml-1 rounded-xl text-muted-foreground hover:bg-muted" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={21} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-0.5 h-5 rounded-full hidden md:block" style={{ backgroundColor: roleColor }} />
              {CurrentIcon && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center hidden md:flex" style={{ backgroundColor: roleColor + "15", color: roleColor }}>
                  <CurrentIcon size={14} />
                </div>
              )}
              <h1 className="text-base font-bold text-foreground tracking-tight">{currentLabel}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-foreground leading-tight">{user?.name || roleLabel}</p>
              <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
            </div>
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-sm"
              style={{ backgroundColor: roleColor }}
            >
              {(user?.name?.[0] || (isSuperAdmin ? "A" : "C")).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-5 bg-background">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="max-w-5xl mx-auto"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
