// App.tsx — the root of the admin portal (the control room web app).
//
// It maps each URL to a page in <Routes> (dashboard, requests, providers, drivers,
// payments, applications, spare parts, etc.) and wraps everything in shared providers:
//   • ThemeProvider — light/dark mode
//   • QueryClientProvider — React Query, which fetches + caches server data so screens
//     stay fast and don't re-fetch on every navigation (see the staleTime/gcTime below)
// New admin screen? Add its import and a <Route> here.

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Requests from "./pages/Requests";
import MechanicMatching from "./pages/MechanicMatching";
import Providers from "./pages/Providers";
import Payments from "./pages/Payments";
import Drivers from "./pages/Drivers";
import DriverDetail from "./pages/DriverDetail";
import Applications from "./pages/Applications";
import SpareParts from "./pages/SpareParts";
import ApplicationDetail from "./pages/ApplicationDetail";
import Settings from "./pages/Settings";
import HelpCenter from "./pages/HelpCenter";
import Profile from "./pages/Profile";
import ActivityLog from "./pages/ActivityLog";
import Security from "./pages/Security";
import AccountSettings from "./pages/AccountSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3 * 60 * 1000,   // 3 minutes — data stays fresh across navigation
      gcTime:    10 * 60 * 1000,  // 10 minutes — keep unused cache in memory
      retry: 1,
    },
  },
});

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/matching" element={<MechanicMatching />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/drivers/:id" element={<DriverDetail />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/spare-parts" element={<SpareParts />} />
          <Route path="/applications/:id" element={<ApplicationDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/activity-log" element={<ActivityLog />} />
          <Route path="/security" element={<Security />} />
          <Route path="/account-settings" element={<AccountSettings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
