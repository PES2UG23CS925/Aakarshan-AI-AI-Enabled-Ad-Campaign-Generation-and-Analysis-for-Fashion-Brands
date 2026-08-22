import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage       from "./pages/AuthPage";
import Dashboard      from "./pages/Dashboard";
import GeneratePage   from "./pages/GeneratePage";
import AdPublicView   from "./pages/AdPublicView";
import PerformancePage from "./pages/PerformancePage";
import Navbar         from "./components/Navbar";
import { supabase }   from "./supabaseClient";
import { useState, useEffect } from "react";

function PrivateRoute({ children }) {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    supabase.auth.onAuthStateChange((_, s) => setSession(s));
  }, []);
  if (session === undefined) return null;
  return session ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/ad/:id" element={<AdPublicView />} />
        <Route path="/" element={<PrivateRoute><Navbar /><Dashboard /></PrivateRoute>} />
        <Route path="/generate" element={<PrivateRoute><Navbar /><GeneratePage /></PrivateRoute>} />
        <Route path="/performance/:id" element={<PrivateRoute><Navbar /><PerformancePage /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
