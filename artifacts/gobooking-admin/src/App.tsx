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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Wrapper
function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/admin/login" />;
  }
  
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
      {/* Root redirect */}
      <Route path="/">
        <Redirect to={isAuthenticated ? "/admin/dashboard" : "/admin/login"} />
      </Route>
      
      {/* Public Auth Route */}
      <Route path="/admin/login">
        {isAuthenticated ? <Redirect to="/admin/dashboard" /> : <Login />}
      </Route>

      {/* Protected Routes */}
      <Route path="/admin">
        <Redirect to="/admin/dashboard" />
      </Route>
      <Route path="/admin/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/admin/reservations"><ProtectedRoute component={Reservations} /></Route>
      <Route path="/admin/colis"><ProtectedRoute component={Parcels} /></Route>
      <Route path="/admin/agents"><ProtectedRoute component={Agents} /></Route>
      <Route path="/admin/trajets"><ProtectedRoute component={Trips} /></Route>
      <Route path="/admin/analytics"><ProtectedRoute component={Analytics} /></Route>
      <Route path="/admin/factures"><ProtectedRoute component={Invoices} /></Route>

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
