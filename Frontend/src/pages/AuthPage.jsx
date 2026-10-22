import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { api }      from "../services/api";

export default function AuthPage() {
  const [mode, setMode]       = useState("login");
  const [form, setForm]       = useState({ fullName: "", email: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      if (mode === "login") {
        const data = await api.login(form.email, form.password);
        if (data.token) {
          await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
          navigate("/");
        } else {
          setError(data.message || "Login failed");
        }
      } else {
        const data = await api.register(form.fullName, form.email, form.password);
        if (data.message === "Registered successfully") {
          await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
          navigate("/");
        } else {
          setError(data.message || "Registration failed");
        }
      }
    } catch {
      setError("Could not connect to server. Is the backend running?");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-lg font-bold">A</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">AAKARSHAN AI</h1>
          <p className="text-slate-500 text-sm mt-1">AI-powered ad generation & analytics</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

          {/* Tabs */}
          <div className="flex mb-5 bg-slate-100 rounded-xl p-1">
            {["login", "register"].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handle} className="space-y-3">
            {mode === "register" && (
              <input
                placeholder="Full Name"
                value={form.fullName}
                onChange={e => setForm({ ...form, fullName: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50 mt-1"
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
