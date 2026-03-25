import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/Button";

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
            <div className="mx-auto w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-accent/30">
              <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-10 h-10 object-contain brightness-0 invert" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">GoBooking Admin</h1>
            <p className="text-muted-foreground mt-2">Espace Administration — Compagnie & Super Admin</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Email professionnel</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
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
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full mt-2" size="lg" isLoading={isLoggingIn}>
              Se connecter
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
