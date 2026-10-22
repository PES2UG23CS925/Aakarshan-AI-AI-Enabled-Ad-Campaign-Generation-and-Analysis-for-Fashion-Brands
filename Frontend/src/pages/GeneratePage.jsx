import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

const PLATFORMS  = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "Twitter"];
const CATEGORIES = ["Casual Wear", "Formal Wear", "Active Wear", "Ethnic Wear", "Streetwear", "Luxury Fashion", "Sustainable Fashion"];

// Customer segments: one click fills the audience with a persona description the LLM and the
// image prompt both use, so the copy and the visual are personalised to that segment.
const SEGMENTS = [
  { label: "Gen Z trendsetters",  audience: "Gen Z men and women 16-24, trend-driven students who shop on Instagram and TikTok" },
  { label: "Young professionals", audience: "Women 25-35, working professionals who want smart, versatile workwear" },
  { label: "Premium shoppers",    audience: "Men and women 30-45, high-income buyers who value luxury and craftsmanship" },
  { label: "Active & fitness",    audience: "Men 20-35, gym-goers and runners who want performance activewear" },
  { label: "Festive & ethnic",    audience: "Women 22-40, shoppers looking for festive and traditional ethnic wear" },
  { label: "Eco-conscious",       audience: "Women and men 20-35, sustainability-minded buyers who prefer ethical brands" },
];

const SENT_COLOR = { Positive: "text-emerald-600", Neutral: "text-slate-500", Negative: "text-red-500" };

export default function GeneratePage() {
  const [form, setForm]       = useState({ brandName: "", category: "", audience: "", platform: "Instagram", prompt: "", useTrends: true });
  const [trends, setTrends]   = useState(null);
  const [trendsLoading, setTrendsLoading] = useState(false);

  // Live fashion-news trends for the chosen category (cached on the server for 30 min)
  useEffect(() => {
    if (!form.category) { setTrends(null); return; }
    let cancelled = false;
    setTrendsLoading(true);
    api.getTrends(form.category).then(t => { if (!cancelled) { setTrends(t && t.keywords ? t : null); setTrendsLoading(false); } })
      .catch(() => { if (!cancelled) setTrendsLoading(false); });
    return () => { cancelled = true; };
  }, [form.category]);
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState("");
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [selectedImg, setSelectedImg] = useState(null);
  const [confirming, setConfirming]   = useState(false);
  const carouselRef = useRef(null);

  const scrollCarousel = (dir) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };
  const navigate = useNavigate();

  const generate = async () => {
    if (!form.brandName || !form.category || !form.audience)
      return alert("Please fill in Brand Name, Category, and Audience.");
    setLoading(true); setResult(null); setError(null); setSelectedImg(null);
    setStep("Writing ad copy with AI…");
    setTimeout(() => setStep("Generating ad visual 1 of 3…"), 5000);
    setTimeout(() => setStep("Generating ad visual 2 of 3…"), 25000);
    setTimeout(() => setStep("Generating ad visual 3 of 3…"), 45000);
    try {
      const data = await api.generateCampaign(form);
      if (!data.campaign) setError(data.message || "Generation failed");
      else {
        setResult(data);
        if (data.images && data.images.length > 0) setSelectedImg(data.images[0]);
      }
    } catch {
      setError("Connection error — make sure the backend is running.");
    }
    setLoading(false); setStep("");
  };

  // Publish ALL generated variants; visitors are split between them and the ML picks the winner.
  const startAbTest = async () => {
    if (!result?.campaign?.id || !result.images || result.images.length < 2) return;
    setConfirming(true);
    const r = await api.startAbTest(result.campaign.id, result.images);
    if (r.campaign) navigate(`/performance/${result.campaign.id}`);
    else { setError(r.message || "Couldn't start the A/B test."); setConfirming(false); }
  };

  const reset = () => { setResult(null); setError(null); setSelectedImg(null); };

  // User picks their favourite of the 3 generated ads → save it → jump straight
  // into the ML performance/analytics page for this campaign.
  const confirmSelection = async () => {
    if (!result?.campaign?.id || !selectedImg) return;
    setConfirming(true);
    try {
      await api.selectImage(result.campaign.id, selectedImg);
      navigate(`/performance/${result.campaign.id}`);
    } catch {
      setError("Couldn't save your selection — please try again.");
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Create Ad Campaign</h1>
          <p className="text-slate-500 text-sm mt-1">Fill in the details below to generate a complete ad creative.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">

          {/* ── Form ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Campaign Details</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Brand Name</label>
              <input
                value={form.brandName}
                onChange={e => setForm({ ...form, brandName: e.target.value })}
                placeholder="e.g. Zara, Nike, Titan…"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fashion Category</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Audience</label>
              <input
                value={form.audience}
                onChange={e => setForm({ ...form, audience: e.target.value })}
                placeholder="e.g. Women 25–40, working professionals"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SEGMENTS.map(seg => (
                  <button key={seg.label} type="button" onClick={() => setForm({ ...form, audience: seg.audience })}
                    className={`px-2.5 py-1 rounded-full border text-xs transition ${form.audience === seg.audience ? "bg-slate-900 border-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                    {seg.label}
                  </button>
                ))}
              </div>
            </div>

            {form.category && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-700">Live {form.category} trends <span className="font-normal text-slate-400">· fashion news</span></p>
                  {trends?.source === "offline-snapshot" && <span className="text-[10px] text-amber-600">offline snapshot</span>}
                </div>
                {trendsLoading && <p className="text-xs text-slate-400">Fetching latest trends…</p>}
                {!trendsLoading && trends && (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {trends.keywords.length === 0 && <span className="text-xs text-slate-400">No repeated themes right now.</span>}
                      {trends.keywords.map(k => <span key={k.word} className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-xs text-slate-700">{k.word} <span className="text-slate-400">×{k.count}</span></span>)}
                    </div>
                    <p className="text-xs text-slate-500 mb-1">
                      Headline mood: <span className="text-emerald-600 font-medium">{trends.sentiment.positive}% positive</span> · {trends.sentiment.neutral}% neutral · <span className="text-red-500">{trends.sentiment.negative}% negative</span>
                    </p>
                    {trends.headlines.slice(0, 2).map((h, i) => (
                      <p key={i} className="text-[11px] text-slate-500 truncate"><span className={SENT_COLOR[h.sentiment]}>●</span> {h.title}</p>
                    ))}
                  </>
                )}
                <label className="flex items-center gap-2 mt-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={form.useTrends} onChange={e => setForm({ ...form, useTrends: e.target.checked })} />
                  Use these trends in my ad copy
                </label>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Platform</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, platform: p })}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      form.platform === p
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Extra Instructions <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={form.prompt}
                onChange={e => setForm({ ...form, prompt: e.target.value })}
                placeholder="e.g. Focus on summer sale, use vibrant colours, highlight limited edition…"
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={generate}
                disabled={loading}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                {loading ? "Generating…" : "Generate Ad"}
              </button>
              {result && (
                <button
                  onClick={reset}
                  className="border border-slate-200 px-5 rounded-xl text-sm text-slate-600 hover:border-slate-400 transition"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* ── Result panel ── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Ad Preview</h2>
              {result && (
                <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                  Ready
                </span>
              )}
              {result?.ai_info && (
                <div className="flex gap-2 text-xs text-slate-400">
                  <span>{(result.ai_info.generation_time_ms / 1000).toFixed(1)}s</span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col">

              {/* Loading state */}
              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                  <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                  <p className="text-slate-600 text-sm">{step}</p>
                  <p className="text-slate-400 text-xs">This typically takes 30–70 seconds (3 images, generated one at a time)</p>
                </div>
              )}

              {/* Error state */}
              {error && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center max-w-xs">
                    <p className="text-red-600 text-sm font-medium mb-1">Generation Failed</p>
                    <p className="text-red-500 text-xs">{error}</p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!result && !loading && !error && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 text-sm">Your ad will appear here</p>
                  <p className="text-slate-400 text-xs">Fill in the form and click Generate Ad</p>
                </div>
              )}

              {/* Result: 3 ad variants side by side (Instagram-carousel style) — user picks one */}
              {result && !loading && (
                <div className="flex flex-col gap-0 flex-1">

                  {result.images && result.images.length > 0 ? (
                    <>
                      <p className="text-xs text-slate-500 px-4 pt-4">
                        Swipe through the 3 ad variants and pick the one you like best.
                      </p>

                      {/* Horizontal swipe carousel — Instagram-post style, with click arrows */}
                      <div className="relative mt-3">
                        <div
                          ref={carouselRef}
                          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-0 [&::-webkit-scrollbar]:hidden"
                          style={{ scrollbarWidth: "none" }}
                        >
                          {result.images.map((url, i) => (
                            <div key={url} className="relative w-full flex-shrink-0 snap-center aspect-square bg-slate-100">
                              <img src={url} alt={`Ad variant ${i + 1}`} className="w-full h-full object-cover" />
                              <span className="absolute top-3 left-3 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded-full pointer-events-none">
                                {i + 1} / {result.images.length}
                              </span>

                              {/* Explicit checkbox to pick this variant */}
                              <button
                                type="button"
                                onClick={() => setSelectedImg(url)}
                                aria-label={`Select ad variant ${i + 1}`}
                                className={`absolute top-3 right-3 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition ${
                                  selectedImg === url
                                    ? "bg-slate-900 border-slate-900 text-white"
                                    : "bg-white/90 border-white text-transparent hover:border-slate-300"
                                }`}
                              >
                                {selectedImg === url && (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Click arrows to move between images */}
                        {result.images.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => scrollCarousel(-1)}
                              aria-label="Previous image"
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 shadow-md flex items-center justify-center transition"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => scrollCarousel(1)}
                              aria-label="Next image"
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-amber-400 hover:bg-amber-500 text-slate-900 shadow-md flex items-center justify-center transition"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Dot indicators for quick jump/select */}
                      <div className="flex items-center justify-center gap-2 py-3">
                        {result.images.map((url, i) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setSelectedImg(url)}
                            aria-label={`Select ad variant ${i + 1}`}
                            className={`w-2.5 h-2.5 rounded-full transition ${
                              selectedImg === url ? "bg-slate-900" : "bg-slate-300 hover:bg-slate-400"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="w-full aspect-square overflow-hidden bg-slate-100 flex items-center justify-center">
                      <p className="text-slate-400 text-sm">Image generation failed for this campaign</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="p-4 flex gap-3 border-t border-slate-100 mt-auto flex-wrap">
                    {result.images && result.images.length >= 2 && (
                      <button
                        onClick={startAbTest}
                        disabled={confirming}
                        className="w-full border border-slate-900 text-slate-900 hover:bg-slate-50 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                      >
                        {confirming ? "Starting…" : `A/B test all ${result.images.length} with real viewers`}
                      </button>
                    )}
                    <button
                      onClick={confirmSelection}
                      disabled={!selectedImg || confirming}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                    >
                      {confirming ? "Saving…" : "Use This Ad → View Analytics"}
                    </button>
                    <button
                      onClick={reset}
                      className="flex-1 border border-slate-200 hover:border-slate-400 text-slate-700 py-2.5 rounded-xl text-sm transition"
                    >
                      Generate Another
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
