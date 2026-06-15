import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CampusProvider } from "@/contexts/CampusContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import TeamRequests from "@/pages/TeamRequests";
import TeamTasks from "@/pages/TeamTasks";
import TeamPageView from "@/pages/TeamPageView";
import UserManagement from "@/pages/UserManagement";
import Home from "@/pages/Home";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!session) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AuthProvider>
          <CampusProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/redefinir-senha" element={<ResetPassword />} />
                <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
                <Route path="/team/requests" element={<PrivateRoute><TeamRequests /></PrivateRoute>} />
                <Route path="/team/tasks" element={<PrivateRoute><TeamTasks /></PrivateRoute>} />
                <Route path="/team/pages/:id" element={<PrivateRoute><TeamPageView /></PrivateRoute>} />
                <Route path="/users" element={<PrivateRoute><UserManagement /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
            <Toaster richColors position="top-right" />
          </CampusProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
