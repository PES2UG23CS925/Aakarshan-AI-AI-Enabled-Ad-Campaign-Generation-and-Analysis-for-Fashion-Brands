import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage       from "./pages/AuthPage";
import Dashboard      from "./pages/Dashboard";
import GeneratePage   from "./pages/GeneratePage";
import AdPublicView   from "./pages/AdPublicView";
import PerformancePage from "./pages/PerformancePage";
import AdminPage       from "./pages/AdminPage";
import Navbar         from "./components/Navbar";
import { supabase }   from "./supabaseClient";
import React, { useState, useEffect } from "react";

// Any render crash shows a recoverable screen instead of a blank page.
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("[UI error]", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-slate-700 font-medium">Something went wrong on this page</p>
        <p className="text-slate-400 text-sm max-w-md">{String(this.state.error?.message || this.state.error)}</p>
        <a href="/" className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm">Back to Campaigns</a>
      </div>
    );
  }
}

function PrivateRoute({ children }) {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    let on = true;
    supabase.auth.getSession().then(({ data }) => { if (on) setSession(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_, s) => { if (on) setSession(s); });
    return () => { on = false; data?.subscription?.unsubscribe(); };   // was leaking a listener on every page change
  }, []);
  if (session === undefined) return null;
  return session ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/ad/:id" element={<AdPublicView />} />
        <Route path="/" element={<PrivateRoute><Navbar /><Dashboard /></PrivateRoute>} />
        <Route path="/generate" element={<PrivateRoute><Navbar /><GeneratePage /></PrivateRoute>} />
        <Route path="/performance/:id" element={<PrivateRoute><Navbar /><PerformancePage /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><Navbar /><AdminPage /></PrivateRoute>} />
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
