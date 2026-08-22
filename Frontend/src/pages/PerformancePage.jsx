import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

const TIER_STYLES = {
  Low:    { badge: "bg-red-50 text-red-600 border-red-200",       bar: "#ef4444" },
  Medium: { badge: "bg-amber-50 text-amber-600 border-amber-200", bar: "#f59e0b" },
  High:   { badge: "bg-blue-50 text-blue-600 border-blue-200",    bar: "#3b82f6" },
  Viral:  { badge: "bg-emerald-50 text-emerald-600 border-emerald-200", bar: "#10b981" },
};

function ScoreRing({ score }) {
  const r    = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ - (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#3b82f6" : score >= 25 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="absolute" width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash}
          transform="rotate(-90 64 64)" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="text-center">
        <p className="text-2xl font-bold text-slate-900">{Math.round(score)}</p>
        <p className="text-slate-400 text-xs">/ 100</p>
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport]     = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [noData, setNoData]     = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [copied, setCopied]     = useState(false);

  const load = async () => {
    setLoading(true); setNoData(false);
    try {
      const campRes = await api.getCampaign(id);
      setCampaign(campRes.campaign);
      if ((campRes.campaign?.views || 0) === 0) { setNoData(true); setLoading(false); return; }
      const analysisRes = await api.analyzePerformance(id);
      setReport(analysisRes);
    } catch (e) {
      setReport({ error: e.message });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const rerun = async () => {
    if ((campaign?.views || 0) === 0) { setNoData(true); return; }
    setRerunning(true);
    const res = await api.analyzePerformance(id);
    setReport(res);
    setRerunning(false);
  };

  const shareUrl = `${window.location.origin}/ad/${id}`;
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
    </div>
  );

  if (noData) return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate("/")} className="text-slate-500 hover:text-slate-900 text-sm mb-6 flex items-center gap-1.5 transition">
          ← Back to Campaigns
        </button>

        {campaign && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 mb-6 shadow-sm">
            {campaign.image_url && (
              <img src={campaign.image_url} alt="ad" className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0" />
            )}
            <div>
              <p className="font-semibold text-slate-900">{campaign.brand_name}</p>
              <p className="text-slate-500 text-sm">{campaign.headline}</p>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </div>
          <h2 className="font-semibold text-slate-900 mb-2">Waiting for engagement</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            Share your ad with real viewers. The ML model scores campaigns based on actual views, likes, and shares.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <p className="text-slate-600 text-sm font-medium mb-2">Public ad link</p>
            <div className="flex gap-2">
              <input readOnly value={shareUrl}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 truncate" />
              <button onClick={copyLink}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${copied ? "bg-emerald-600 text-white" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <button onClick={() => navigate("/")} className="text-slate-400 hover:text-slate-700 text-sm transition">
            ← Back to Campaigns
          </button>
        </div>
      </div>
    </div>
  );

  if (!report || report.error) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-slate-700 font-medium">Analysis failed</p>
      <p className="text-slate-400 text-sm">{report?.error || "Unknown error"}</p>
      <button onClick={() => navigate("/")} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm">
        Back to Campaigns
      </button>
    </div>
  );

  const tierStyle = TIER_STYLES[report.tier] || {};

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-5">

        <button onClick={() => navigate("/")} className="text-slate-500 hover:text-slate-900 text-sm flex items-center gap-1.5 transition">
          ← Back to Campaigns
        </button>

        {/* Campaign info */}
        {campaign && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            {campaign.image_url && (
              <img src={campaign.image_url} alt="ad" className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="font-semibold text-slate-900">{campaign.brand_name}</span>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{campaign.platform}</span>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{campaign.category}</span>
              </div>
              <p className="text-slate-500 text-sm">{campaign.headline}</p>
              <div className="flex gap-4 text-xs text-slate-400 mt-1.5">
                <span>{campaign.views || 0} views</span>
                <span>{campaign.likes || 0} likes</span>
                <span>{campaign.shares || 0} shares</span>
                <span>{campaign.comments || 0} comments</span>
              </div>
            </div>
          </div>
        )}

        {/* Score + probabilities */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-sm">
            <p className="text-slate-500 text-sm font-medium">Performance Score</p>
            <ScoreRing score={report.performance_score} />
            <span className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium ${tierStyle.badge}`}>
              {report.tier}
            </span>
            <p className="text-slate-400 text-xs">Model accuracy: {report.model_accuracy}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <p className="text-slate-500 text-sm font-medium mb-4">Tier Probabilities</p>
            <div className="space-y-3">
              {Object.entries(report.tier_probabilities || {}).sort((a, b) => b[1] - a[1]).map(([tier, pct]) => (
                <div key={tier}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{tier}</span>
                    <span className="text-slate-400">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: TIER_STYLES[tier]?.bar || "#94a3b8" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Platform benchmark */}
        {report.platform_benchmark && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 text-sm font-medium mb-4">Platform Benchmark — {report.platform_benchmark.platform}</p>
            <div className="flex gap-8">
              <div>
                <p className="text-2xl font-semibold text-slate-900">{report.platform_benchmark.your_score}</p>
                <p className="text-slate-400 text-xs mt-0.5">Your score</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-400">{report.platform_benchmark.platform_avg}</p>
                <p className="text-slate-400 text-xs mt-0.5">Platform avg</p>
              </div>
              <div>
                <p className={`text-2xl font-semibold ${report.platform_benchmark.vs_average >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {report.platform_benchmark.vs_average >= 0 ? "+" : ""}{report.platform_benchmark.vs_average}
                </p>
                <p className="text-slate-400 text-xs mt-0.5">vs average</p>
              </div>
            </div>
          </div>
        )}

        {/* Top features */}
        {report.top_features?.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 text-sm font-medium mb-4">Top Scoring Factors</p>
            <div className="space-y-3">
              {report.top_features.map((f, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">{f.feature}</span>
                    <span className="text-slate-400">{f.importance}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-900 rounded-full transition-all duration-700" style={{ width: `${f.importance}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {report.recommendations?.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 text-sm font-medium mb-3">Recommendations</p>
            <div className="space-y-2">
              {report.recommendations.map((r, i) => (
                <div key={i} className="flex gap-3 bg-slate-50 rounded-xl px-4 py-3">
                  <span className="text-slate-400 text-xs mt-0.5 shrink-0">→</span>
                  <p className="text-slate-600 text-sm">{r}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={copyLink}
            className={`flex-1 border py-3 rounded-xl text-sm font-medium transition ${copied ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50"}`}>
            {copied ? "Link Copied!" : "Copy & Share Ad Link"}
          </button>
          <button onClick={rerun} disabled={rerunning}
            className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">
            {rerunning ? "Analyzing…" : "Re-run ML Analysis"}
          </button>
          <button onClick={() => navigate("/generate")}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-sm font-medium transition">
            Create New Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
