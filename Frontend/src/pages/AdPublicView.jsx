import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";

export default function AdPublicView() {
  const { id } = useParams();
  const [campaign, setCampaign]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [liked, setLiked]         = useState(false);
  const [shared, setShared]       = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment]     = useState("");
  const [toast, setToast]         = useState("");
  const viewedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/campaign/public/${id}`);
        const data = await res.json();
        if (!data.campaign) { setNotFound(true); setLoading(false); return; }
        setCampaign(data.campaign);
        setLoading(false);
        if (!viewedRef.current) {
          viewedRef.current = true;
          await api.simulateEngagement(id);
        }
      } catch {
        setNotFound(true); setLoading(false);
      }
    })();
  }, [id]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const engage = async (type) => {
    await api.simulateEngagement(id);
    if (type === "like")  { setLiked(true);  showToast("Liked!"); }
    if (type === "share") { setShared(true); showToast("Link copied!"); navigator.clipboard?.writeText(window.location.href); }
    if (type === "comment") setShowComment(true);
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    await api.simulateEngagement(id);
    showToast("Comment posted!");
    setComment(""); setShowComment(false);
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
              onClick={() => { engage("like"); showToast("Thanks for your interest!"); }}
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
