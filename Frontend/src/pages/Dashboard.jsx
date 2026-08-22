import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

const TIER_STYLES = {
  Low:    { badge: "bg-red-50 text-red-600 border-red-200",    dot: "bg-red-400" },
  Medium: { badge: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-400" },
  High:   { badge: "bg-blue-50 text-blue-600 border-blue-200",  dot: "bg-blue-400" },
  Viral:  { badge: "bg-emerald-50 text-emerald-600 border-emerald-200", dot: "bg-emerald-400" },
};

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [analyzing, setAnalyzing] = useState({});
  const [deleting, setDeleting]   = useState({});
  const [copyMsg, setCopyMsg]     = useState({});
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const [campRes, statRes] = await Promise.all([api.getCampaigns(), api.getPerfDashboard()]);
    setCampaigns(campRes.campaigns || []);
    setStats(statRes);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const analyze = async (id) => {
    setAnalyzing(a => ({ ...a, [id]: true }));
    await api.analyzePerformance(id);
    await load();
    setAnalyzing(a => ({ ...a, [id]: false }));
  };

  const del = async (id) => {
    if (!confirm("Delete this campaign?")) return;
    setDeleting(d => ({ ...d, [id]: true }));
    await api.deleteCampaign(id);
    setCampaigns(c => c.filter(x => x.id !== id));
    setDeleting(d => ({ ...d, [id]: false }));
  };

  const copyLink = (id) => {
    navigator.clipboard.writeText(`${window.location.origin}/ad/${id}`);
    setCopyMsg(m => ({ ...m, [id]: true }));
    setTimeout(() => setCopyMsg(m => ({ ...m, [id]: false })), 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Campaigns</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage your ad campaigns and track performance</p>
          </div>
          <button
            onClick={() => navigate("/generate")}
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
          >
            + Create Campaign
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Campaigns" value={stats.total_campaigns || 0} />
            <StatCard label="Avg Score" value={stats.avg_score ? `${stats.avg_score}/100` : "—"} />
            <StatCard label="Total Views" value={(stats.total_views || 0).toLocaleString()} />
            <StatCard label="Total Likes" value={(stats.total_likes || 0).toLocaleString()} />
          </div>
        )}

        {/* Campaigns grid */}
        {campaigns.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-slate-700 font-medium mb-1">No campaigns yet</p>
            <p className="text-slate-400 text-sm mb-5">Create your first AI-generated ad campaign</p>
            <button
              onClick={() => navigate("/generate")}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition"
            >
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {campaigns.map(c => {
              const tier = TIER_STYLES[c.performance_tier] || {};
              return (
                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                  {/* Ad image thumbnail */}
                  {c.image_url && (
                    <div className="w-full h-48 overflow-hidden bg-slate-100">
                      <img src={c.image_url} alt="ad" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="p-5">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-slate-900">{c.brand_name}</span>
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{c.platform}</span>
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{c.category}</span>
                        </div>
                        <p className="text-slate-600 text-sm">{c.headline}</p>
                      </div>
                    </div>

                    {/* Score + engagement */}
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      {c.performance_tier ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${tier.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                          {c.performance_tier} · {Math.round(c.performance_score)}/100
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">Not scored</span>
                      )}
                      <div className="flex gap-3 text-xs text-slate-400 ml-auto">
                        <span>{c.views || 0} views</span>
                        <span>{c.likes || 0} likes</span>
                        <span>{c.shares || 0} shares</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => analyze(c.id)}
                        disabled={analyzing[c.id]}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 px-3 rounded-lg transition disabled:opacity-50 font-medium"
                      >
                        {analyzing[c.id] ? "Analyzing…" : "Run ML Score"}
                      </button>

                      {c.performance_score !== null && (
                        <button
                          onClick={() => navigate(`/performance/${c.id}`)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 px-3 rounded-lg transition font-medium"
                        >
                          View Report
                        </button>
                      )}

                      <button
                        onClick={() => copyLink(c.id)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 px-3 rounded-lg transition font-medium"
                      >
                        {copyMsg[c.id] ? "Copied!" : "Share"}
                      </button>

                      <button
                        onClick={() => del(c.id)}
                        disabled={deleting[c.id]}
                        className="bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-400 text-xs py-2 px-3 rounded-lg transition"
                      >
                        Delete
                      </button>
                    </div>

                    <p className="text-slate-400 text-xs mt-3">
                      {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
