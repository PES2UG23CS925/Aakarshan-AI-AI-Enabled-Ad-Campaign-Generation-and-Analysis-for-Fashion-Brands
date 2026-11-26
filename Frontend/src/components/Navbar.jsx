import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { api } from "../services/api";

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { api.me().then(r => setIsAdmin(r?.user?.role === "admin")).catch(() => {}); }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        pathname === to
          ? "bg-slate-800 text-white"
          : "text-slate-400 hover:text-white hover:bg-slate-800/60"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
          <span className="text-white text-xs font-bold">A</span>
        </div>
        <span className="text-slate-900 font-semibold text-sm">AAKARSHAN AI</span>
      </div>

      <div className="flex items-center gap-1">
        {navLink("/", "Campaigns")}
        {navLink("/generate", "Create Ad")}
        {isAdmin && navLink("/admin", "Admin")}
      </div>

      <button
        onClick={logout}
        className="text-sm text-slate-500 hover:text-slate-900 transition px-3 py-1.5 rounded-lg hover:bg-slate-100"
      >
        Sign out
      </button>
    </nav>
  );
}
