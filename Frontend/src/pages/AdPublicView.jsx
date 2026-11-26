import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";

// Anonymous, persistent visitor id so the server can de-duplicate (one like per person,
// refreshes don't inflate views). Falls back to a per-tab id if storage is blocked.
function getVisitorId() {
  try {
    let v = localStorage.getItem("aakarshan_visitor");
    if (!v) { v = (crypto.randomUUID?.() || `v-${Date.now()}-${Math.random().toString(36).slice(2)}`); localStorage.setItem("aakarshan_visitor", v); }
    return v;
  } catch { return window.__vid || (window.__vid = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`); }
}
const flagKey = (id, t) => `aakarshan_${t}_${id}`;   // id already includes the variant for pinned links
const hasFlag = (id, t) => { try { return !!localStorage.getItem(flagKey(id, t)); } catch { return false; } };
const setFlag = (id, t) => { try { localStorage.setItem(flagKey(id, t), "1"); } catch {} };

export default function AdPublicView() {
  const { id } = useParams();
  const params = new URLSearchParams(window.location.search);
  const isPreview = params.get("preview") === "1";
  // ?v=N (without preview) is a tracked, pinned variant link: always shows variant N, stats count for N.
  const vParam = params.get("v");
  const pin = !isPreview && /^\d+$/.test(vParam || "") ? parseInt(vParam, 10) : null;
  const fid = pin !== null ? `${id}_v${pin}` : id;
  const [campaign, setCampaign]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [liked, setLiked]         = useState(() => hasFlag(fid, "like"));
  const [shared, setShared]       = useState(() => hasFlag(fid, "share"));
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment]     = useState("");
  const [toast, setToast]         = useState("");
  const viewedRef = useRef(false);
  // Per-variant visitor id for pinned links, so opening link B after link A isn't swallowed by A's de-dupe window.
  const visitor = useRef(getVisitorId() + (pin !== null ? `-v${pin}` : "")).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = isPreview ? await api.getPublicAd(id, "", { preview: "1", v: params.get("v") }) : await api.getPublicAd(id, visitor, pin !== null ? { v: String(pin) } : {});
        if (cancelled) return;
        if (!data.campaign) { setNotFound(true); setLoading(false); return; }
        setCampaign(data.campaign);
        setLoading(false);
        // Exactly one view per page visit (ref guard survives React re-renders);
        // the server additionally ignores repeat views from the same visitor within 30 min.
        // Never record real events while previewing a specific variant
        if (!viewedRef.current && !isPreview) {
          viewedRef.current = true;
          api.recordEvent(id, "view", visitor, undefined, pin ?? undefined);
        }
      } catch {
        if (!cancelled) { setNotFound(true); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const like = async () => {
    if (liked || isPreview) return;
    setLiked(true); setFlag(fid, "like"); showToast("Liked!");
    api.recordEvent(id, "like", visitor, undefined, pin ?? undefined);
  };

  const share = async () => {
    if (isPreview) return;
    const url = window.location.href;   // a pinned link shares itself, so the friend sees the same variant
    try {
      if (navigator.share) await navigator.share({ title: campaign?.headline, url });
      else { await navigator.clipboard?.writeText(url); showToast("Link copied!"); }
    } catch { return; }              // user cancelled the share sheet -> not a share
    setShared(true); setFlag(fid, "share");
    api.recordEvent(id, "share", visitor, undefined, pin ?? undefined);
  };

  // CTA is a CLICK (used for CTR) — it no longer fakes a like.
  const cta = () => { if (isPreview) return showToast("Preview mode — clicks aren't recorded here"); api.recordEvent(id, "click", visitor, undefined, pin ?? undefined); showToast("Thanks for your interest!"); };

  const submitComment = async () => {
    if (isPreview) return;
    const text = comment.trim();
    if (!text) return;
    const r = await api.recordEvent(id, "comment", visitor, text, pin ?? undefined);
    showToast(r.counted ? "Comment posted!" : r.reason === "rate_limited" ? "Too many comments, try later" : "Couldn't post comment");
    if (r.counted) { setComment(""); setShowComment(false); }
  };

  const engage = (type) => {
    if (type === "like") like();
    if (type === "share") share();
    if (type === "comment") setShowComment(true);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-4">
      <p className="text-slate-700 font-medium mb-2">Ad not found</p>
      <p className="text-slate-400 text-sm">This ad may have been removed.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10">

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      <div className="w-full max-w-sm">
        {isPreview && (
          <div className="bg-slate-900 text-white text-center text-xs py-2 px-3 rounded-xl mb-3">
            Preview — variant {parseInt(params.get("v"), 10) + 1}. Likes/shares/comments here aren't recorded.
          </div>
        )}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          {/* Brand header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {campaign.brand_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-slate-900 text-sm font-semibold">{campaign.brand_name}</p>
              <p className="text-slate-400 text-xs">{campaign.platform} · Sponsored</p>
            </div>
          </div>

          {/* The composited ad image — full width, all text baked in */}
          <div className="w-full aspect-square bg-slate-100 overflow-hidden">
            {campaign.image_url ? (
              <img
                src={campaign.image_url}
                alt={campaign.headline}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-slate-400 text-sm">Image unavailable</p>
              </div>
            )}
          </div>

          {/* Engagement buttons */}
          <div className="px-4 py-3 flex items-center gap-5 border-b border-slate-100">
            <button
              onClick={() => engage("like")}
              disabled={liked}
              className={`flex items-center gap-1.5 text-sm transition ${liked ? "text-red-500" : "text-slate-500 hover:text-red-500"}`}
            >
              <svg className="w-5 h-5" fill={liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Like
            </button>
            <button
              onClick={() => engage("comment")}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Comment
            </button>
            <button
              onClick={() => engage("share")}
              disabled={shared}
              className={`flex items-center gap-1.5 text-sm transition ml-auto ${shared ? "text-emerald-600" : "text-slate-500 hover:text-slate-900"}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>

          {/* CTA */}
          <div className="px-4 py-3">
            <button
              onClick={cta}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-sm font-medium transition"
            >
              {campaign.cta || "Shop Now"}
            </button>
          </div>

          {/* Comment box */}
          {showComment && (
            <div className="px-4 pb-4 flex gap-2">
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Write a comment…"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              />
              <button onClick={submitComment}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm transition">
                Post
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-slate-400 text-xs mt-4">
          Your interaction helps measure ad performance
        </p>
      </div>
    </div>
  );
}
