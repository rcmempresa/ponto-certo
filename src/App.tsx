import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Ferias from "./pages/Ferias";
import Faltas from "./pages/Faltas";
import HorasExtra from "./pages/HorasExtra";
import Documentos from "./pages/Documentos";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminEquipa from "./pages/admin/AdminEquipa";
import AdminPonto from "./pages/admin/AdminPonto";
import AdminAprovacoes from "./pages/admin/AdminAprovacoes";
import AdminDocumentos from "./pages/admin/AdminDocumentos";
import AdminHorasExtra from "./pages/admin/AdminHorasExtra";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* User Routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/ferias" element={<Ferias />} />
              <Route path="/faltas" element={<Faltas />} />
              <Route path="/horas-extra" element={<HorasExtra />} />
              <Route path="/documentos" element={<Documentos />} />
              
              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/equipa"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminEquipa />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ponto"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminPonto />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/aprovacoes"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminAprovacoes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/documentos"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDocumentos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/horas-extra"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminHorasExtra />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
