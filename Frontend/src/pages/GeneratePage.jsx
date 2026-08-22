import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

const PLATFORMS  = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "Twitter"];
const CATEGORIES = ["Casual Wear", "Formal Wear", "Active Wear", "Ethnic Wear", "Streetwear", "Luxury Fashion", "Sustainable Fashion"];

export default function GeneratePage() {
  const [form, setForm]       = useState({ brandName: "", category: "", audience: "", platform: "Instagram", prompt: "" });
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState("");
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [saving, setSaving]   = useState(false);
  const navigate = useNavigate();

  const generate = async () => {
    if (!form.brandName || !form.category || !form.audience)
      return alert("Please fill in Brand Name, Category, and Audience.");
    setLoading(true); setResult(null); setError(null);
    setStep("Writing ad copy with AI…");
    // setTimeout(() => setStep("Generating 4 ad visuals…"), 5000);
    // setTimeout(() => setStep("Still working — up to 4 images take longer than 1…"), 20000);
    setTimeout(() => setStep("Generating 3 ad visuals…"), 5000);
    setTimeout(() => setStep("Still working — up to 3 images take longer than 1…"), 20000);
    setTimeout(() => setStep("Almost there, compositing final ads…"), 45000);
    try {
      const data = await api.generateCampaign(form);
      if (!data.campaign) setError(data.message || "Generation failed");
      else {
        setResult(data);
        setSelectedUrl(data.campaign.image_url || data.campaign.image_urls?.[0] || null);
      }
    } catch {
      setError("Connection error — make sure the backend is running.");
    }
    setLoading(false); setStep("");
  };

  const reset = () => { setResult(null); setError(null); setSelectedUrl(null); };

  const saveToDashboard = async () => {
    if (!result?.campaign?.id || !selectedUrl) return navigate("/");
    setSaving(true);
    try {
      // Persist which of the 4 variants the user picked as the final image
      if (selectedUrl !== result.campaign.image_url) {
        await api.selectImage(result.campaign.id, selectedUrl);
      }
    } catch {
      // non-fatal — campaign already has a default image_url from generation
    }
    setSaving(false);
    navigate("/");
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
            </div>

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
                  {/* <p className="text-slate-400 text-xs">Generating 4 options typically takes 40–90 seconds</p> */}
                  <p className="text-slate-400 text-xs">Generating 3 options typically takes 40–90 seconds</p>
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

              {/* Result: pick from the 4 generated variants */}
              {result && !loading && (
                <div className="flex flex-col gap-0 flex-1">

                  {(result.campaign.image_urls?.length > 0) ? (
                    <>
                      <p className="px-4 pt-4 text-xs text-slate-500">
                        {result.campaign.image_urls.length} options generated — tap one to choose it
                      </p>
                      <div className="grid grid-cols-2 gap-3 p-4">
                        {result.campaign.image_urls.map((url, i) => (
                          <button
                            key={url + i}
                            type="button"
                            onClick={() => setSelectedUrl(url)}
                            className={`relative aspect-square overflow-hidden rounded-xl bg-slate-100 border-2 transition ${
                              selectedUrl === url
                                ? "border-slate-900 ring-2 ring-slate-900"
                                : "border-transparent hover:border-slate-300"
                            }`}
                          >
                            <img
                              src={url}
                              alt={`Ad option ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {selectedUrl === url && (
                              <span className="absolute top-2 right-2 bg-slate-900 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                                Selected
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="w-full aspect-square overflow-hidden bg-slate-100 flex items-center justify-center">
                      <p className="text-slate-400 text-sm">Image unavailable</p>
                    </div>
                  )}

                  {/* Action buttons below the grid */}
                  <div className="p-4 flex gap-3 border-t border-slate-100">
                    <button
                      onClick={saveToDashboard}
                      disabled={saving || !selectedUrl}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save to Dashboard"}
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
