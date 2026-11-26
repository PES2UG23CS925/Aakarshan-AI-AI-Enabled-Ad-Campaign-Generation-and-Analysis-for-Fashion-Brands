import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

const TIER_STYLES = {
  Low:    { badge: "bg-red-50 text-red-600 border-red-200",       bar: "#ef4444" },
  Medium: { badge: "bg-amber-50 text-amber-600 border-amber-200", bar: "#f59e0b" },
  High:   { badge: "bg-blue-50 text-blue-600 border-blue-200",    bar: "#3b82f6" },
  Viral:  { badge: "bg-emerald-50 text-emerald-600 border-emerald-200", bar: "#10b981" },
};
const CONF_STYLES = {
  Low:    "bg-amber-50 text-amber-700 border-amber-200",
  Medium: "bg-blue-50 text-blue-700 border-blue-200",
  High:   "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const Spinner = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
  </div>
);

function ScoreRing({ score }) {
  const r = 52, circ = 2 * Math.PI * r, dash = circ - (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#3b82f6" : score >= 25 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="absolute" width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dash} transform="rotate(-90 64 64)"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="text-center">
        <p className="text-2xl font-bold text-slate-900">{Math.round(score)}</p>
        <p className="text-slate-400 text-xs">/ 100</p>
      </div>
    </div>
  );
}

// Rates are shown as at most 100% (repeat comments/clicks can outnumber unique views).
const pctRate = (r) => `${Math.min(100, Math.max(0, (Number(r) || 0) * 100)).toFixed(1)}%`;
function Bar({ label, value, suffix = "%", color = "#0f172a" }) {
  value = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-400">{Math.round(value * 10) / 10}{suffix}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function PerformancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [report, setReport]     = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [ab, setAb]           = useState(null);
  const [picking, setPicking]   = useState(false);
  const [copiedVariant, setCopiedVariant] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [noData, setNoData]     = useState(false);
  const [errMsg, setErrMsg]     = useState("");
  const [rerunning, setRerunning] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const campRes = await api.getCampaign(id);
      if (!campRes.campaign) { setErrMsg(campRes.message || "Campaign not found"); setLoading(false); return; }
      setCampaign(campRes.campaign);
      if ((campRes.campaign.views || 0) === 0) { setNoData(true); setReport(null); setLoading(false); return; }
      setNoData(false);
      const [analysis, abRes] = await Promise.all([api.analyzePerformance(id), api.getAbTest(id)]);
      setAb(abRes.active ? abRes : null);
      if (analysis.performance_score === undefined) setErrMsg(analysis.detail || analysis.message || "Analysis failed");
      else { setReport(analysis); setErrMsg(""); }
      setUpdatedAt(new Date());
    } catch (e) { setErrMsg(e.message); }
    setLoading(false);
  }, [id]);

  // Re-score automatically every 15s so new views/likes/comments appear without a manual refresh
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(true); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  const rerun = async () => { setRerunning(true); await load(true); setRerunning(false); };

  // kind "tracked": a pinned link — always shows variant idx and its views/likes count toward that variant.
  // kind "preview": shows variant idx but records nothing (for reviewers).
  const copyVariantLink = (idx, kind = "tracked") => {
    const url = `${window.location.origin}/ad/${id}?v=${idx}${kind === "preview" ? "&preview=1" : ""}`;
    navigator.clipboard.writeText(url);
    const k = `${kind}-${idx}`;
    setCopiedVariant(k); setTimeout(() => setCopiedVariant(null), 2000);
  };

  const useWinner = async (url) => {
    if (!confirm("End the A/B test and use this variant for the campaign?")) return;
    setPicking(true);
    await api.selectImage(id, url);
    await load(true);
    setPicking(false);
  };

  const shareUrl = `${window.location.origin}/ad/${id}`;
  const copyLink = () => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (loading) return <Spinner />;

  const Header = () => campaign && (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      {campaign.image_url && <img src={campaign.image_url} alt="ad" className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-semibold text-slate-900">{campaign.brand_name}</span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{campaign.platform}</span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{campaign.category}</span>
        </div>
        <p className="text-slate-500 text-sm">{campaign.headline}</p>
        <div className="flex gap-4 text-xs text-slate-400 mt-1.5 flex-wrap">
          <span>{campaign.views || 0} views</span><span>{campaign.likes || 0} likes</span>
          <span>{campaign.shares || 0} shares</span><span>{campaign.comments || 0} comments</span>
          <span>{campaign.clicks || 0} clicks</span>
        </div>
      </div>
    </div>
  );

  if (noData) return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate("/")} className="text-slate-500 hover:text-slate-900 text-sm transition">← Back to Campaigns</button>
        <Header />
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-2">Waiting for real engagement</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            Share the public link. Scores are computed from real views, likes, shares, comments and clicks. This page updates automatically.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-slate-600 text-sm font-medium mb-2">Public ad link</p>
            <div className="flex gap-2">
              <input readOnly value={shareUrl} className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 truncate" />
              <button onClick={copyLink} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${copied ? "bg-emerald-600 text-white" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            {campaign?.variants?.length > 1 && (
              <div className="mt-4 text-left">
                <p className="text-slate-600 text-sm font-medium mb-1">Or share one variant per link</p>
                <p className="text-slate-400 text-xs mb-2">Each link always shows its own variant and counts toward that variant's stats. The main link above splits visitors automatically.</p>
                <div className="flex gap-2 flex-wrap">
                  {campaign.variants.map((_, i) => (
                    <button key={i} onClick={() => copyVariantLink(i, "tracked")}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition ${copiedVariant === `tracked-${i}` ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-700 hover:border-slate-900"}`}>
                      {copiedVariant === `tracked-${i}` ? "Copied!" : `Copy variant ${i + 1} link`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (!report) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-slate-700 font-medium">Analysis failed</p>
      <p className="text-slate-400 text-sm text-center max-w-md">{errMsg || "Unknown error"}</p>
      <div className="flex gap-3">
        <button onClick={() => load()} className="border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm">Retry</button>
        <button onClick={() => navigate("/")} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm">Back to Campaigns</button>
      </div>
    </div>
  );

  const tierStyle = TIER_STYLES[report.tier] || {};

  const downloadReport = async () => {
    setDownloading(true);
    try { await api.downloadReport(id, "csv"); }
    catch (e) { alert(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/")} className="text-slate-500 hover:text-slate-900 text-sm transition">← Back to Campaigns</button>
          {updatedAt && <span className="text-slate-400 text-xs">Live · updated {updatedAt.toLocaleTimeString()}</span>}
        </div>

        <Header />

        {report.confidence === "Low" && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
            Early data: only {report.counts.views} view{report.counts.views === 1 ? "" : "s"} so far. Treat the score as provisional; the range below shows how uncertain it is.
          </div>
        )}

        {/* Score + tier probabilities */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center gap-3 shadow-sm">
            <p className="text-slate-500 text-sm font-medium">Performance Score</p>
            <ScoreRing score={report.performance_score} />
            <span className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium ${tierStyle.badge}`}>{report.tier}</span>
            <p className="text-slate-500 text-xs">Likely range {report.score_range[0]}–{report.score_range[1]}</p>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${CONF_STYLES[report.confidence]}`}>{report.confidence} confidence</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <p className="text-slate-500 text-sm font-medium mb-1">Tier Probabilities</p>
            <p className="text-slate-400 text-xs mb-4">How likely each tier is given the data so far</p>
            <div className="space-y-3">
              {Object.entries(report.tier_probabilities || {}).sort((a, b) => b[1] - a[1]).map(([t, p]) => (
                <Bar key={t} label={t} value={p} color={TIER_STYLES[t]?.bar} />
              ))}
            </div>
          </div>
        </div>

        {/* A/B test */}
        {ab && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-slate-500 text-sm font-medium">A/B test: which ad wins?</p>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border ${ab.status === "winner" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}>
                {ab.status === "winner" ? "Winner found" : ab.status === "leaning" ? "Leaning" : ab.status === "collecting" ? "Collecting data" : "No clear winner"}
              </span>
            </div>
            <p className="text-slate-500 text-sm mb-4">{ab.message}</p>
            <div className={`grid gap-3 ${ab.variants.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
              {ab.variants.map(v => (
                <div key={v.index} className={`rounded-xl border p-3 ${ab.leader === v.index ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200"}`}>
                  <img src={v.image_url} alt={`Variant ${v.index + 1}`} className="w-full aspect-square object-cover rounded-lg mb-3 bg-slate-100" />
                  <p className="text-sm font-medium text-slate-900 mb-2">Variant {v.index + 1}</p>
                  <div className="text-xs text-slate-500 space-y-0.5 mb-3">
                    <p>{v.views} views · {v.likes} likes · {v.shares} shares · {v.comments} comments</p>
                    <p>Quality-adjusted engagement {pctRate(v.engagement_rate)} · CTR {pctRate(v.ctr)}</p>
                  </div>
                  <Bar label="Chance it's the best" value={v.prob_best} color={ab.leader === v.index ? "#10b981" : "#94a3b8"} />
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500 mb-1.5">
                      Comments ({v.comment_list?.length || 0})
                      {v.comment_list?.length > 0 && (
                        <span className="text-slate-400"> · <span className="text-emerald-600">{v.sentiment?.Positive || 0} positive</span> · {v.sentiment?.Neutral || 0} neutral · <span className="text-red-500">{v.sentiment?.Negative || 0} negative</span></span>
                      )}
                    </p>
                    {v.comment_list?.length ? (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {v.comment_list.map((c, i) => (
                          <p key={i} className="text-xs text-slate-600 break-words">
                            <span className={c.label === "Positive" ? "text-emerald-600" : c.label === "Negative" ? "text-red-500" : "text-slate-400"} title={c.label}>● </span>{c.text}
                          </p>
                        ))}
                      </div>
                    ) : <p className="text-xs text-slate-400">No comments yet.</p>}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => copyVariantLink(v.index, "tracked")}
                      className={`flex-1 border text-xs py-1.5 rounded-lg transition ${copiedVariant === `tracked-${v.index}` ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 hover:border-slate-900 text-slate-700"}`}>
                      {copiedVariant === `tracked-${v.index}` ? "Copied!" : "Copy link"}
                    </button>
                    <button onClick={() => useWinner(v.image_url)} disabled={picking}
                      className="flex-1 border border-slate-200 hover:border-slate-900 text-slate-700 text-xs py-1.5 rounded-lg transition disabled:opacity-50">
                      Use this
                    </button>
                  </div>
                  <button onClick={() => copyVariantLink(v.index, "preview")} className="mt-2 w-full text-slate-400 hover:text-slate-700 text-xs transition">
                    {copiedVariant === `preview-${v.index}` ? "Preview link copied" : "Copy preview link (not counted)"}
                  </button>
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


        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={copyLink} className={`flex-1 border py-3 rounded-xl text-sm font-medium transition ${copied ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50"}`}>
            {copied ? "Link Copied!" : "Copy & Share Ad Link"}
          </button>
          <button onClick={rerun} disabled={rerunning} className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">
            {rerunning ? "Refreshing…" : "Refresh now"}
          </button>
          <button onClick={downloadReport} disabled={downloading} className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50">
            {downloading ? "Preparing…" : "Download report (CSV)"}
          </button>
          <button onClick={() => navigate("/generate")} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-sm font-medium transition">
            Create New Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
