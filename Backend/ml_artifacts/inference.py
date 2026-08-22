#!/usr/bin/env python3
"""
inference.py — Called by Node.js via child_process.spawn
Input:  JSON string as argv[1]  { mode, ...fields }
Output: JSON to stdout
Modes:  analyze | insights
"""
import sys, json, os, math
import numpy as np
import joblib

ARTIFACTS = os.path.dirname(__file__)

def load():
    clf      = joblib.load(os.path.join(ARTIFACTS, "classifier.pkl"))
    reg      = joblib.load(os.path.join(ARTIFACTS, "regressor.pkl"))
    encoders = joblib.load(os.path.join(ARTIFACTS, "label_encoders.pkl"))
    with open(os.path.join(ARTIFACTS, "metadata.json")) as f:
        meta = json.load(f)
    return clf, reg, encoders, meta

def safe_enc(enc, val, fallback=0):
    try:    return int(enc.transform([str(val)])[0])
    except: return fallback

def build_features(data, encoders, meta):
    likes      = max(int(data.get("likes_count", 0)), 0)
    shares     = max(int(data.get("shares_count", 0)), 0)
    comments   = max(int(data.get("comments_count", 0)), 0)
    impressions= max(int(data.get("impressions", 1)), 1)
    num = [
        float(data.get("sentiment_score", 0.5)),
        float(data.get("toxicity_score", 0.1)),
        int(data.get("hashtag_count", 0)),
        int(data.get("mention_count", 0)),
        int(data.get("keyword_count", 3)),
        int(data.get("text_length", 100)),
        int(data.get("has_mention", 0)),
        float(data.get("user_past_sentiment_avg", 0.1)),
        float(data.get("user_engagement_growth", 0.0)),
        float(data.get("buzz_change_rate", 0.0)),
        math.log1p(likes),
        math.log1p(shares),
        math.log1p(comments),
        math.log1p(impressions),
        likes / (shares + 1),
    ]
    cat_feats = meta["cat_features"]
    enc_vals  = [safe_enc(encoders[c], data.get(c, ""), 0) for c in cat_feats]
    return np.array(num + enc_vals, dtype=float).reshape(1, -1)

TIER_COLOR = {"Low":"#ef4444","Medium":"#f59e0b","High":"#3b82f6","Viral":"#10b981"}
TIER_EMOJI = {"Low":"📉","Medium":"📊","High":"📈","Viral":"🚀"}

def recommendations(data, tier, score, meta):
    recs = []
    platform = data.get("platform","")
    ps = meta.get("platform_stats",{})
    ds = meta.get("day_stats",{})
    best_platform = max(ps.get("avg_perf",{"Instagram":50}).items(), key=lambda x:x[1])[0]
    best_day      = max(ds.get("avg_score",{"Wednesday":50}).items(), key=lambda x:x[1])[0]
    day = data.get("day_of_week","")
    hashtags = int(data.get("hashtag_count",0))
    mentions = int(data.get("mention_count",0))
    if tier in ("Low","Medium"):
        if best_platform and platform != best_platform:
            recs.append(f"Try posting on {best_platform} — it has the highest avg performance in our data.")
        if best_day and day != best_day:
            recs.append(f"Posting on {best_day} tends to get better reach historically.")
        if hashtags < 2:
            recs.append("Add 2–4 relevant hashtags to improve discoverability.")
        if mentions == 0:
            recs.append("Tag relevant accounts or partners to boost visibility.")
    elif tier == "High":
        recs.append("Strong performance! Replicate this campaign format.")
        recs.append("Consider a small paid boost to push it Viral.")
    else:
        recs.append("Exceptional! Document this campaign as a template.")
        recs.append("Boost with paid promotion to maximize reach now.")
    if not recs:
        recs.append("Performance is on track. Monitor engagement over the next 48 hours.")
    return recs

def mode_analyze(data, clf, reg, encoders, meta):
    X     = build_features(data, encoders, meta)
    tier  = clf.predict(X)[0]
    proba = clf.predict_proba(X)[0]
    score = float(np.clip(reg.predict(X)[0], 0, 100))

    likes      = int(data.get("likes_count",0))
    shares     = int(data.get("shares_count",0))
    comments   = int(data.get("comments_count",0))
    impressions= max(int(data.get("impressions",1)),1)
    eng_rate   = (likes + shares + comments) / impressions

    classes    = clf.classes_.tolist()
    proba_dict = {c: round(float(p)*100,1) for c,p in zip(classes, proba)}

    fi = meta.get("feature_importances",{})
    top_features = sorted(fi.items(), key=lambda x:x[1], reverse=True)[:5]
    top_features = [{"feature": k.replace("_enc","").replace("_"," ").title(),
                     "importance": round(v*100,1)} for k,v in top_features]

    platform = data.get("platform","")
    ps       = meta.get("platform_stats",{})
    p_avg    = ps.get("avg_perf",{}).get(platform, 50)

    return {
        "mode": "analyze",
        "tier": tier,
        "tier_color": TIER_COLOR.get(tier,"#6b7280"),
        "tier_emoji": TIER_EMOJI.get(tier,"📊"),
        "performance_score": round(score,1),
        "engagement_rate": round(eng_rate, 4),
        "tier_probabilities": proba_dict,
        "top_features": top_features,
        "recommendations": recommendations(data, tier, score, meta),
        "platform_benchmark": {
            "platform": platform,
            "your_score": round(score,1),
            "platform_avg": round(p_avg,1),
            "vs_average": round(score - p_avg, 1)
        },
        "model_accuracy": f"{meta['model_metrics']['classifier_accuracy']*100:.1f}%"
    }

def mode_insights(meta):
    def build(stat, key="avg_perf"):
        scores = stat.get(key,{})
        counts = stat.get("count",{})
        return [{"label":k,"score":round(v,1),"count":counts.get(k,0)}
                for k,v in sorted(scores.items(), key=lambda x:x[1], reverse=True)]
    return {
        "mode": "insights",
        "platform_insights":  build(meta.get("platform_stats",{})),
        "sentiment_insights": build(meta.get("sentiment_stats",{}), "avg_score"),
        "phase_insights":     build(meta.get("phase_stats",{}), "avg_score"),
        "emotion_insights":   build(meta.get("emotion_stats",{}), "avg_score"),
        "day_insights":       build(meta.get("day_stats",{}), "avg_score"),
        "topic_insights":     build(meta.get("topic_stats",{}), "avg_score"),
        "model_metrics":      meta.get("model_metrics",{})
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error":"No input"})); sys.exit(1)
    try:
        data = json.loads(sys.argv[1])
    except Exception as e:
        print(json.dumps({"error":f"Bad JSON: {e}"})); sys.exit(1)
    try:
        clf, reg, encoders, meta = load()
    except Exception as e:
        print(json.dumps({"error":f"Load artifacts failed: {e}"})); sys.exit(1)
    mode = data.get("mode","insights")
    if mode == "analyze":
        print(json.dumps(mode_analyze(data, clf, reg, encoders, meta)))
    else:
        print(json.dumps(mode_insights(meta)))

if __name__ == "__main__":
    main()
