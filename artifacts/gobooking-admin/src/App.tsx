import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Reservations from "@/pages/reservations";
import Parcels from "@/pages/parcels";
import Agents from "@/pages/agents";
import Trips from "@/pages/trips";
import Analytics from "@/pages/analytics";
import Invoices from "@/pages/invoices";
import Financial from "@/pages/financial";
import Companies from "@/pages/companies";
import Reports from "@/pages/reports";
import AlertsPage from "@/pages/alerts";
import NotFound from "@/pages/not-found";

import Embarquement from "@/pages/embarquement";
import Affectation from "@/pages/affectation";
import SuiviEngins from "@/pages/suivi-engins";
import Maintenance from "@/pages/maintenance";
import Carburant from "@/pages/carburant";
import SuiviLive from "@/pages/suivi-live";
import Billets from "@/pages/billets";
import Avis from "@/pages/avis";
import ColisHistorique from "@/pages/colis-historique";
import SmsMarketing from "@/pages/sms-marketing";
import Parametres from "@/pages/parametres";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/admin/login" />;
  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function Router() {
  const { isAuthenticated } = useAuth();
  return (
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
