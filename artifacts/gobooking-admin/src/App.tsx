import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";

/* ── Lazy-loaded pages (only download what the user actually visits) ── */
const Login          = lazy(() => import("@/pages/login"));
const Dashboard      = lazy(() => import("@/pages/dashboard"));
const Reservations   = lazy(() => import("@/pages/reservations"));
const Parcels        = lazy(() => import("@/pages/parcels"));
const Agents         = lazy(() => import("@/pages/agents"));
const Trips          = lazy(() => import("@/pages/trips"));
const Analytics      = lazy(() => import("@/pages/analytics"));
const Invoices       = lazy(() => import("@/pages/invoices"));
const Financial      = lazy(() => import("@/pages/financial"));
const Companies      = lazy(() => import("@/pages/companies"));
const Agences        = lazy(() => import("@/pages/agences"));
const Reports        = lazy(() => import("@/pages/reports"));
const AlertsPage     = lazy(() => import("@/pages/alerts"));
const NotFound       = lazy(() => import("@/pages/not-found"));
const Embarquement   = lazy(() => import("@/pages/embarquement"));
const Affectation    = lazy(() => import("@/pages/affectation"));
const SuiviEngins    = lazy(() => import("@/pages/suivi-engins"));
const Maintenance    = lazy(() => import("@/pages/maintenance"));
const Carburant      = lazy(() => import("@/pages/carburant"));
const SuiviLive      = lazy(() => import("@/pages/suivi-live"));
const Billets        = lazy(() => import("@/pages/billets"));
const Avis           = lazy(() => import("@/pages/avis"));
const ColisHistorique = lazy(() => import("@/pages/colis-historique"));
const SmsMarketing   = lazy(() => import("@/pages/sms-marketing"));
const Parametres     = lazy(() => import("@/pages/parametres"));

/* ── Optimized QueryClient ── */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 90_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: "always",
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: 0,
    },
  },
});

/* ── Lightweight page-level loading skeleton ── */
function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center h-full min-h-[40vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs text-muted-foreground font-medium">Chargement…</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/admin/login" />;
  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Component {...rest} />
      </Suspense>
    </AppLayout>
  );
}

function Router() {
  const { isAuthenticated } = useAuth();
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/">
          <Redirect to={isAuthenticated ? "/admin/dashboard" : "/admin/login"} />
        </Route>

        <Route path="/admin/login">
          {isAuthenticated ? <Redirect to="/admin/dashboard" /> : <Login />}
        </Route>

        <Route path="/admin">
          <Redirect to="/admin/dashboard" />
        </Route>

        {/* Core */}
        <Route path="/admin/dashboard"><ProtectedRoute component={Dashboard} /></Route>
        <Route path="/admin/companies"><ProtectedRoute component={Companies} /></Route>
        <Route path="/admin/agences"><ProtectedRoute component={Agences} /></Route>

        {/* EXPLOITATION */}
        <Route path="/admin/trajets"><ProtectedRoute component={Trips} /></Route>
        <Route path="/admin/embarquement"><ProtectedRoute component={Embarquement} /></Route>
        <Route path="/admin/affectation"><ProtectedRoute component={Affectation} /></Route>

        {/* LOGISTIQUE */}
        <Route path="/admin/suivi-engins"><ProtectedRoute component={SuiviEngins} /></Route>
        <Route path="/admin/maintenance"><ProtectedRoute component={Maintenance} /></Route>
        <Route path="/admin/carburant"><ProtectedRoute component={Carburant} /></Route>
        <Route path="/admin/suivi-live"><ProtectedRoute component={SuiviLive} /></Route>
        <Route path="/admin/alertes"><ProtectedRoute component={AlertsPage} /></Route>

        {/* COMMERCIAL */}
        <Route path="/admin/reservations"><ProtectedRoute component={Reservations} /></Route>
        <Route path="/admin/billets"><ProtectedRoute component={Billets} /></Route>
        <Route path="/admin/avis"><ProtectedRoute component={Avis} /></Route>

        {/* COLIS */}
        <Route path="/admin/colis"><ProtectedRoute component={Parcels} /></Route>
        <Route path="/admin/colis-historique"><ProtectedRoute component={ColisHistorique} /></Route>

        {/* ANALYSE & GESTION */}
        <Route path="/admin/analytics"><ProtectedRoute component={Analytics} /></Route>
        <Route path="/admin/financier"><ProtectedRoute component={Financial} /></Route>
        <Route path="/admin/rapports"><ProtectedRoute component={Reports} /></Route>
        <Route path="/admin/sms-marketing"><ProtectedRoute component={SmsMarketing} /></Route>
        <Route path="/admin/agents"><ProtectedRoute component={Agents} /></Route>
        <Route path="/admin/factures"><ProtectedRoute component={Invoices} /></Route>
        <Route path="/admin/parametres"><ProtectedRoute component={Parametres} /></Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
