import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/components/NotificationProvider";
import Index from "./pages/Index";
import SearchPage from "./pages/Search";
import AgentProfile from "./pages/AgentProfile";
import Messages from "./pages/Messages";
import AgentChat from "./pages/AgentChat";
import AgentAuth from "./pages/AgentAuth";
import AgentDashboard from "./pages/AgentDashboard";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import FeedbackForm from "./pages/FeedbackForm";
import AdminFeedback from "./pages/AdminFeedback";
import { FeedbackButton } from "@/components/FeedbackButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <NotificationProvider />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/agent/:id" element={<AgentProfile />} />
            
            <Route path="/messages" element={<Messages />} />
            <Route path="/agent-chat" element={<AgentChat />} />
            <Route path="/agent-auth" element={<AgentAuth />} />
            <Route path="/agent-dashboard" element={<AgentDashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/feedback/:token" element={<FeedbackForm />} />
            <Route path="/admin/feedback" element={<AdminFeedback />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <FeedbackButton />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
