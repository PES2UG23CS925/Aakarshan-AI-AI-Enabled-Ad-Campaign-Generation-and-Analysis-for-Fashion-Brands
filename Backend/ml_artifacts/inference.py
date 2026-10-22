#!/usr/bin/env python3
"""
inference.py - called by Node via child_process.spawn (JSON in argv[1], JSON on stdout)
Modes:
  analyze  : score a live campaign from its REAL counters (+ comments)
  sentiment: classify a list of comments
  insights : benchmark + honest model metrics for the dashboard
"""
import sys, os, re, json, warnings
import numpy as np
import joblib
from scipy.stats import gamma

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
TIERS = [(75, "Viral"), (50, "High"), (25, "Medium"), (0, "Low")]
TIER_COLOR = {"Low": "#ef4444", "Medium": "#f59e0b", "High": "#3b82f6", "Viral": "#10b981"}


def clean_text(t):  # must match train.py
    t = str(t).lower()
    t = re.sub(r"https?://\S+", " ", t)
    t = re.sub(r"[#@]\w+", " ", t)
    t = re.sub(r"[^a-z0-9'!? ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def tier_of(score):
    for cut, name in TIERS:
        if score >= cut:
            return name
    return "Low"


def load_json(name):
    with open(os.path.join(HERE, name)) as f:
        return json.load(f)


def pct(value, quantiles, grid):
    """Percentile (0-100) of `value` inside a benchmark quantile curve."""
    q = np.asarray(quantiles, float)
    # np.interp needs increasing x; break ties with a tiny ramp
    q = q + np.arange(len(q)) * 1e-12
    return float(np.interp(value, q, np.asarray(grid) * 100.0))


def sentiment_batch(texts):
    if not texts:
        return []
    model = joblib.load(os.path.join(HERE, "sentiment.pkl"))
    cleaned = [clean_text(t) for t in texts]
    labels = model.predict(cleaned)
    proba = model.predict_proba(cleaned)
    classes = list(model.classes_)
    out = []
    for lab, p in zip(labels, proba):
        out.append({"label": str(lab), "confidence": round(float(p.max()), 3),
                    "score": round(float(p[classes.index("Positive")] - p[classes.index("Negative")]), 3)})
    return out


def mode_sentiment(d):
    texts = [str(t) for t in d.get("texts", [])][:200]
    return {"mode": "sentiment", "results": sentiment_batch(texts)}


def mode_analyze(d):
    bm = load_json("benchmark.json")
    grid = bm["quantile_grid"]
    k = bm["shrinkage_pseudo_views"]

    views = max(int(d.get("views", 0)), 0)
    likes = max(int(d.get("likes", 0)), 0)
    shares = max(int(d.get("shares", 0)), 0)
    comments = max(int(d.get("comments", 0)), 0)
    clicks = max(int(d.get("clicks", 0)), 0)
    if views == 0:
        return {"error": "no_data"}

    platform = d.get("platform", "")
    used = platform if platform in bm else "All"
    ref = bm[used]

    # ---- engagement rate with small-sample shrinkage (Gamma-Poisson) ----
    eng = likes + shares + comments
    raw_rate = eng / views
    prior = ref["median_er"]
    alpha, beta = eng + k * prior, views + k          # posterior of the true rate
    rate_hat = alpha / beta
    score = pct(rate_hat, ref["er_q"], grid)

    rng = np.random.default_rng(0)
    draws = gamma.rvs(a=alpha, scale=1.0 / beta, size=4000, random_state=rng)
    draw_scores = np.array([pct(x, ref["er_q"], grid) for x in draws[:800]])
    lo, hi = np.percentile(draw_scores, [10, 90])
    tier_counts = {t: 0 for _, t in TIERS}
    for s in draw_scores:
        tier_counts[tier_of(s)] += 1
    tier_prob = {t: round(100.0 * c / len(draw_scores), 1) for t, c in tier_counts.items()}

    confidence = "Low" if views < 20 else "Medium" if views < 100 else "High"

    # ---- component percentiles (with the same shrinkage) ----
    def comp(count, qkey):
        med = float(np.median(ref[qkey]))
        r = (count + k * med) / (views + k)
        return round(pct(r, ref[qkey], grid), 1)
    components = {"likes": comp(likes, "like_q"), "shares": comp(shares, "share_q"), "comments": comp(comments, "comment_q")}

    ctr = clicks / views
    sent = d.get("comment_texts") or []
    sres = sentiment_batch([str(t) for t in sent][:200])
    sent_counts = {"Positive": 0, "Neutral": 0, "Negative": 0}
    for r in sres:
        sent_counts[r["label"]] += 1
    sent_total = sum(sent_counts.values())
    sent_index = round((sent_counts["Positive"] - sent_counts["Negative"]) / sent_total, 2) if sent_total else None

    recs = recommendations(d, views, likes, shares, comments, clicks, ctr, components, sent_counts, sent_total, confidence)

    return {
        "mode": "analyze",
        "tier": tier_of(score),
        "tier_color": TIER_COLOR[tier_of(score)],
        "performance_score": round(score, 1),
        "score_range": [round(float(lo), 1), round(float(hi), 1)],
        "confidence": confidence,
        "tier_probabilities": tier_prob,
        "engagement_rate": round(raw_rate, 4),
        "ctr": round(ctr, 4),
        "components": components,
        "counts": {"views": views, "likes": likes, "shares": shares, "comments": comments, "clicks": clicks},
        "benchmark": {"platform_used": used, "n_posts": ref["n"], "median_engagement_rate": round(ref["median_er"], 4),
                      "your_engagement_rate": round(raw_rate, 4),
                      "vs_median_pct": round((raw_rate / ref["median_er"] - 1) * 100, 1) if ref["median_er"] else None},
        "sentiment": {"counts": sent_counts, "index": sent_index, "analysed": sent_total,
                      "samples": [{"text": str(t)[:140], **r} for t, r in list(zip(sent, sres))[:5]]},
        "recommendations": recs,
        "method": "Percentile of the campaign's engagement rate vs. the platform benchmark, with small-sample shrinkage. "
                  "Range and tier probabilities come from the Gamma-Poisson posterior, so few views = wide range.",
    }


def recommendations(d, views, likes, shares, comments, clicks, ctr, comp, sc, st, confidence):
    r = []
    if confidence == "Low":
        r.append(f"Only {views} view(s) so far - treat this score as provisional. Share the link more widely; the range narrows quickly past ~100 views.")
    if comp["likes"] < 40:
        r.append("Like rate is below the benchmark. Test a stronger hero image or opening line - pick a different variant from the generator.")
    if comp["shares"] < 40:
        r.append("Few shares relative to views. Add a more shareable hook (offer, limited drop, or emotional story) to the copy.")
    if comp["comments"] < 40 and views >= 20:
        r.append("Low comment rate. End the copy with a question or a poll-style prompt to invite replies.")
    if views >= 20 and ctr < 0.03:
        r.append(f"CTA click-through is {ctr*100:.1f}%. Make the call-to-action more specific (e.g. 'Shop the drop') and keep it above the fold.")
    if st >= 3 and sc["Negative"] / st >= 0.4:
        r.append("Around 40%+ of comments are negative. Read them in the report and address price, fit or quality concerns in your next variant.")
    elif st >= 3 and sc["Positive"] / st >= 0.6:
        r.append("Audience sentiment is strongly positive - reuse this tone and visual style in your next campaign.")
    if int(d.get("hashtag_count", 0)) < 3:
        r.append("Use 3-5 relevant hashtags to improve discoverability.")
    if not r or (comp["likes"] >= 75 and comp["shares"] >= 60):
        r.append("Strong engagement vs. benchmark - keep this creative live and consider a small paid boost.")
    return r[:5]


MIN_VIEWS_PER_VARIANT = 30
WINNER_P = 97.5   # 2 variants: false-winner rate ~5%
LEAN_P = 85.0

def mode_ab_test(d):
    """Bayesian A/B(/C/D) test on engagement rate. Same Gamma-Poisson model as the scorer,
    so a variant with few views is pulled toward the benchmark instead of winning by luck."""
    bm = load_json("benchmark.json")
    ref = bm[d.get("platform")] if d.get("platform") in bm else bm["All"]
    k, prior = bm["shrinkage_pseudo_views"], ref["median_er"]
    vs = d["variants"]
    rng = np.random.default_rng(1)
    N = 20000
    draws, rows = [], []
    for v in vs:
        views = int(v["views"]); eng = int(v["likes"]) + int(v["shares"]) + int(v["comments"])
        a, b = eng + k * prior, views + k
        draws.append(gamma.rvs(a=a, scale=1.0 / b, size=N, random_state=rng))
        rows.append({**v, "engagement_rate": round(eng / views, 4) if views else 0.0,
                     "ctr": round(int(v["clicks"]) / views, 4) if views else 0.0,
                     "adjusted_rate": round(a / b, 4)})
    M = np.vstack(draws)
    best = M.argmax(axis=0)
    for i, r in enumerate(rows):
        r["prob_best"] = round(float((best == i).mean()) * 100, 1)
    order = sorted(range(len(rows)), key=lambda i: -rows[i]["prob_best"])
    top, second = order[0], order[1]
    lift = float(np.median(M[top] / np.maximum(M[second], 1e-9)) - 1) * 100
    min_views = min(int(v["views"]) for v in vs)
    p = rows[top]["prob_best"]
    if min_views < MIN_VIEWS_PER_VARIANT:
        status, msg = "collecting", f"Keep collecting data: every variant needs at least {MIN_VIEWS_PER_VARIANT} views (lowest has {min_views})."
    elif p >= WINNER_P:
        status, msg = "winner", f"Variant {top+1} is the clear winner ({p}% probability of being best, about {lift:.0f}% higher engagement than the runner-up)."
    elif p >= LEAN_P:
        status, msg = "leaning", f"Variant {top+1} is leading ({p}% probability of being best) but the result is not conclusive yet. Keep the test running."
    else:
        status, msg = "no_winner", "No clear winner yet: the variants perform about the same so far. Keep testing or pick the one you prefer."
    return {"mode": "ab_test", "status": status, "message": msg, "leader": rows[top]["index"] if status in ("winner", "leaning") else None,
            "lift_vs_runner_up_pct": round(lift, 1), "min_views": min_views, "min_views_required": MIN_VIEWS_PER_VARIANT,
            "variants": rows}


def mode_insights(_):
    bm, mt = load_json("benchmark.json"), load_json("metrics.json")
    plats = [{"platform": p, "n_posts": bm[p]["n"], "median_engagement_rate": round(bm[p]["median_er"], 4)}
             for p in bm if p not in ("quantile_grid", "max_rate", "shrinkage_pseudo_views", "All")]
    return {"mode": "insights", "benchmark_platforms": plats, "overall_median_engagement_rate": round(bm["All"]["median_er"], 4),
            "benchmark_posts": bm["All"]["n"], "metrics": mt}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input"})); sys.exit(1)
    try:
        data = json.loads(sys.argv[1])
    except Exception as e:
        print(json.dumps({"error": f"Bad JSON: {e}"})); sys.exit(1)
    try:
        fn = {"analyze": mode_analyze, "sentiment": mode_sentiment, "ab_test": mode_ab_test}.get(data.get("mode"), mode_insights)
        print(json.dumps(fn(data)))
    except Exception as e:
        print(json.dumps({"error": f"{type(e).__name__}: {e}"})); sys.exit(1)


if __name__ == "__main__":
    main()
