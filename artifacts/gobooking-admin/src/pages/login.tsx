import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/Button";

const DEMO_ACCOUNTS = [
  { label: "Compagnie",   email: "compagnie@test.com",  color: "#D97706", bg: "#FEF3C7" },
  { label: "Super Admin", email: "admin@test.com",       color: "#7C3AED", bg: "#EDE9FE" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
      setLocation("/admin/dashboard");
      toast({ title: "Connexion réussie", description: "Bienvenue dans l'espace admin." });
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Échec de connexion", 
        description: err.message || "Vérifiez vos identifiants."
      });
    }
  };

  const quickLogin = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    try {
      await login({ email: acc.email, password: "test123" });
      setLocation("/admin/dashboard");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Échec", description: err.message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-sidebar">
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Background" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-sidebar/80 mix-blend-multiply" />
      </div>

      <div className="relative z-10 w-full max-w-md p-6">
        <div className="bg-card rounded-3xl shadow-2xl p-8 border border-border/50 backdrop-blur-sm">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-[#FF6B00] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-orange-500/40">
              <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">GoBooking Admin</h1>
            <p className="text-muted-foreground mt-2 text-sm">Espace Administration — Compagnie &amp; Super Admin</p>
          </div>

          {/* Demo quick access */}
          <div className="mb-6 rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Accès rapide démo</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => quickLogin(acc)}
                  disabled={isLoggingIn}
                  className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all hover:shadow-sm active:scale-95 text-left"
                  style={{ backgroundColor: acc.bg, borderColor: acc.color + "40" }}
                >
                  <span className="text-xs font-bold" style={{ color: acc.color }}>{acc.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate w-full text-center">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">ou connexion manuelle</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Email professionnel</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm"
                placeholder="admin@compagnie.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Mot de passe</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 h-12 rounded-xl font-bold text-white text-base transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
              style={{ background: "linear-gradient(135deg, #FF6B00, #E55A00)", boxShadow: "0 4px 16px rgba(255,107,0,0.35)" }}
            >
              {isLoggingIn ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              Se connecter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
