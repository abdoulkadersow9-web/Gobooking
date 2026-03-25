import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Ticket, Package, Users, Map,
  BarChart3, FileText, LogOut, Menu, X, TrendingUp,
  Building2, Bus, AlertTriangle, ClipboardList, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const ADMIN_NAV = [
  { path: "/admin/dashboard",   label: "Tableau de bord",  icon: LayoutDashboard },
  { path: "/admin/companies",   label: "Compagnies",       icon: Building2 },
  { path: "/admin/trajets",     label: "Trajets",          icon: Map },
  { path: "/admin/colis",       label: "Colis",            icon: Package },
  { path: "/admin/reservations",label: "Tickets",          icon: Ticket },
  { path: "/admin/alertes",     label: "Alertes",          icon: AlertTriangle },
  { path: "/admin/rapports",    label: "Rapports agents",  icon: ClipboardList },
  { path: "/admin/analytics",   label: "Analytiques",      icon: BarChart3 },
];

const COMPANY_NAV = [
  { path: "/admin/dashboard",   label: "Tableau de bord",  icon: LayoutDashboard },
  { path: "/admin/trajets",     label: "Trajets & Bus",    icon: Map },
  { path: "/admin/reservations",label: "Réservations",     icon: Ticket },
  { path: "/admin/colis",       label: "Colis",            icon: Package },
  { path: "/admin/agents",      label: "Agents",           icon: Users },
  { path: "/admin/rapports",    label: "Rapports agents",  icon: ClipboardList },
  { path: "/admin/analytics",   label: "Analytiques",      icon: BarChart3 },
  { path: "/admin/factures",    label: "Factures",         icon: FileText },
  { path: "/admin/financier",   label: "Financier",        icon: TrendingUp },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout, isSuperAdmin, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = isSuperAdmin ? ADMIN_NAV : COMPANY_NAV;
  const roleLabel = isSuperAdmin ? "Super Administrateur" : "Espace Compagnie";
  const roleColor = isSuperAdmin ? "#7C3AED" : "#D97706";
  const roleInitial = isSuperAdmin ? "A" : "C";

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground shadow-2xl z-20">
        <div className="h-20 flex items-center px-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="GoBooking" className="w-8 h-8 rounded-lg" />
            <div>
              <span className="font-display font-bold tracking-tight text-xl block">GoBooking</span>
              <span className="text-xs opacity-60">{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* Role badge */}
        <div className="mx-4 mt-4 mb-2 rounded-xl px-3 py-2 flex items-center gap-2 border border-white/10 bg-white/5">
          {isSuperAdmin ? <ShieldCheck size={16} className="text-purple-400" /> : <Building2 size={16} className="text-amber-400" />}
          <span className="text-xs font-semibold" style={{ color: isSuperAdmin ? "#C4B5FD" : "#FCD34D" }}>
            {isSuperAdmin ? "Admin Global" : "Admin Compagnie"}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path} className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${isActive
                  ? "bg-accent text-accent-foreground font-semibold shadow-lg shadow-accent/25"
                  : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-white"
                }
              `}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          {user && (
            <div className="px-4 py-2 mb-2 rounded-xl bg-white/5">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-white/50 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sidebar-foreground/70 hover:bg-white/10 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            className="w-64 bg-sidebar text-sidebar-foreground shadow-2xl relative z-10 flex flex-col h-full"
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="GoBooking" className="w-6 h-6 rounded-md" />
                <span className="font-display font-bold">GoBooking</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path} onClick={() => setIsMobileMenuOpen(false)} className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl
                  ${location === item.path ? "bg-accent text-accent-foreground" : "text-white/70"}
                `}>
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </motion.aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 -ml-2 text-muted-foreground" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-display font-bold text-foreground">
              {navItems.find((n) => n.path === location)?.label || "Administration"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-foreground">{user?.name || roleLabel}</span>
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
            </div>
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm text-white"
              style={{ backgroundColor: roleColor }}
            >
              {roleInitial}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6 bg-background">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
