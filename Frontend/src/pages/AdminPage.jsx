import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

const TABS = ["Overview", "Users", "Logs"];
const levelColor = { info: "text-slate-500", warn: "text-amber-600", error: "text-red-600" };

function Card({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value ?? "—"}</p>
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Overview");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null);

  const load = useCallback(async () => {
    setError("");
    const profile = await api.me();
    setMe(profile?.user || null);
    const [o, u, l] = await Promise.all([api.adminOverview(), api.adminUsers(), api.adminLogs(100)]);
    if (o?.message === "Admin access required") { setError("Admin access required. Ask an administrator to give your account the admin role."); return; }
    if (o?.message) { setError(o.message); return; }
    setOverview(o); setUsers(u.users || []); setLogs(l.logs || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  // logs refresh while that tab is open
  useEffect(() => {
    if (tab !== "Logs") return undefined;
    const t = setInterval(async () => { const l = await api.adminLogs(100); if (l?.logs) setLogs(l.logs); }, 5000);
    return () => clearInterval(t);
  }, [tab]);

  const setRole = async (u, role) => {
    const r = await api.adminSetRole(u.id, role);
    if (r?.user) setUsers(prev => prev.map(x => (x.id === u.id ? { ...x, role: r.user.role } : x)));
    else alert(r?.message || "Could not change the role");
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4">
          <p className="text-slate-700 text-sm">{error}</p>
          <button onClick={() => navigate("/")} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm">Back to Campaigns</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Admin console</h1>
          <p className="text-sm text-slate-500">Platform monitoring, user roles and recent API activity.</p>
        </div>
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{t}</button>
          ))}
        </div>

        {tab === "Overview" && overview && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card label="Users" value={overview.totals.users} />
              <Card label="Campaigns" value={overview.totals.campaigns} />
              <Card label="Events" value={overview.totals.events} />
              <Card label="Events (24 h)" value={overview.totals.events_last_24h} />
              <Card label="Average score" value={overview.avg_score} />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-sm font-medium text-slate-900 mb-3">Recent campaigns</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-400"><th className="py-1">Brand</th><th>Platform</th><th>Views</th><th>Score</th><th>Tier</th></tr></thead>
                <tbody>
                  {overview.recent_campaigns.map(c => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="py-1.5">{c.brand_name}</td><td>{c.platform}</td><td>{c.views}</td>
                      <td>{c.performance_score ?? "—"}</td><td>{c.performance_tier ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "Users" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-400"><th className="py-1">Name</th><th>Email</th><th>Campaigns</th><th>Role</th><th /></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="py-1.5">{u.full_name}</td><td>{u.email}</td><td>{u.campaigns}</td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs ${u.role === "admin" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{u.role}</span></td>
                    <td className="text-right">
                      {me?.id !== u.id && (
                        <button onClick={() => setRole(u, u.role === "admin" ? "user" : "admin")} className="text-xs text-slate-600 hover:text-slate-900 underline">
                          {u.role === "admin" ? "Remove admin" : "Make admin"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Logs" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 overflow-x-auto">
            <p className="text-xs text-slate-400 mb-2">Latest API requests since the server started (refreshes every 5 s).</p>
            <table className="w-full text-xs font-mono">
              <thead><tr className="text-left text-slate-400"><th className="py-1">Time</th><th>Method</th><th>Path</th><th>Status</th><th>ms</th></tr></thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1">{new Date(l.ts).toLocaleTimeString()}</td><td>{l.method}</td><td>{l.path}</td>
                    <td className={levelColor[l.level]}>{l.status}</td><td>{l.ms ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
