#!/usr/bin/env python3
"""
Aakarshan AI - ML training pipeline (v2, leakage-free)

The old RandomForest pair used likes/shares/comments/impressions as INPUTS while
its TARGET (engagement_rate) is exactly (likes+shares+comments)/impressions.
That is target leakage: 89.9% accuracy / R2 0.994 came from re-deriving a
formula, not from predicting anything. This script produces instead:

  1. Engagement BENCHMARK (benchmark.json): per-platform empirical distribution
     of engagement rates. A live campaign is scored as a percentile against it.
  2. Audience SENTIMENT classifier (sentiment.pkl): TF-IDF + Logistic Regression
     labelling viewer comments Positive / Neutral / Negative. Evaluated on a
     hold-out split AND on unseen hand-written fashion-ad comments.
  3. Honest pre-launch experiment (metrics.json): can content/timing features
     predict engagement before launch? Cross-validated against a mean baseline.

Run from Backend/:  npm run train
"""
import os, re, json, warnings
import numpy as np, pandas as pd, joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, cross_val_score, KFold
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
SEED = 42
MAX_RATE = 3.0   # a viewer can like+share+comment => >3 engagements per view is impossible


def clean_text(t):
    t = str(t).lower()
    t = re.sub(r"https?://\S+", " ", t)
    t = re.sub(r"[#@]\w+", " ", t)
    t = re.sub(r"[^a-z0-9'!? ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


FASHION_TRAIN = [
 ("Love this dress, the colour is gorgeous!", "Positive"), ("Absolutely stunning collection", "Positive"),
 ("Need this jacket in my wardrobe right now", "Positive"), ("So stylish, I'm buying two", "Positive"),
 ("This looks amazing on the model", "Positive"), ("Best ad I've seen this week", "Positive"),
 ("The fabric looks so premium, obsessed!", "Positive"), ("Wow the fit is perfect", "Positive"),
 ("Beautiful design, well done team", "Positive"), ("Cannot wait for this drop", "Positive"),
 ("Great quality and great price", "Positive"), ("Such a classy look, love it", "Positive"),
 ("Finally a brand that gets my style", "Positive"), ("Super comfortable and trendy", "Positive"),
 ("Take my money already", "Positive"), ("This outfit is fire", "Positive"),
 ("Looks cheap and badly made", "Negative"), ("Way too expensive for what it is", "Negative"),
 ("I hate this colour, so ugly", "Negative"), ("Terrible quality, mine fell apart in a week", "Negative"),
 ("Not impressed at all with this collection", "Negative"), ("Boring and overpriced", "Negative"),
 ("The sizing is awful, nothing fits", "Negative"), ("Worst purchase I have ever made", "Negative"),
 ("Misleading ad, the real thing looks nothing like this", "Negative"), ("Disappointing, expected much better", "Negative"),
 ("This is a bad copy of other brands", "Negative"), ("Delivery was late and support ignored me", "Negative"),
 ("Cringe ad, would not wear this", "Negative"), ("Awful stitching and the fabric is rough", "Negative"),
 ("What sizes does it come in?", "Neutral"), ("Is this available in India?", "Neutral"),
 ("Does it come in black?", "Neutral"), ("When does the sale start?", "Neutral"),
 ("Where can I find the store?", "Neutral"), ("Is this cotton or polyester?", "Neutral"),
 ("Shipping time to Bengaluru?", "Neutral"), ("Can I exchange it if the size is wrong?", "Neutral"),
 ("Just saw this ad on my feed", "Neutral"), ("Sharing this with my sister", "Neutral"),
 ("Is there a men's version?", "Neutral"), ("How much is the shipping cost?", "Neutral"),
]
FASHION_TEST = [
 ("Gorgeous, I adore the pattern", "Positive"), ("This is the coolest thing I've seen all year", "Positive"),
 ("Really elegant and well made", "Positive"), ("Yes! Ordering immediately", "Positive"),
 ("I'm in love with this look", "Positive"), ("Fantastic quality for the price", "Positive"),
 ("The model looks incredible in it", "Positive"), ("Perfect for summer, so chic", "Positive"),
 ("Really ugly, who designed this", "Negative"), ("Garbage quality, total waste of money", "Negative"),
 ("Very disappointed with the material", "Negative"), ("So overpriced, no thanks", "Negative"),
 ("Looks tacky and uncomfortable", "Negative"), ("Horrible fit, returning mine", "Negative"),
 ("I don't like it at all", "Negative"), ("Poor stitching and fades after one wash", "Negative"),
 ("Do you ship internationally?", "Neutral"), ("Which fabric is this made of?", "Neutral"),
 ("Is there a discount code?", "Neutral"), ("Does it have pockets?", "Neutral"),
 ("Anyone know the return policy?", "Neutral"), ("What is the model wearing, size wise?", "Neutral"),
]


def main():
    print("Loading dataset...")
    df = pd.read_csv(os.path.join(HERE, "dataset.csv"))
    n_raw = len(df)

    # 1. leakage audit
    calc = (df.likes_count + df.shares_count + df.comments_count) / df.impressions
    max_diff = float((calc - df.engagement_rate).abs().max())
    print(f"[audit] engagement_rate == (likes+shares+comments)/impressions (max diff {max_diff:.6f})")
    print("[audit] => those four columns can NOT be model inputs when engagement_rate is the target")
    df["er"] = calc
    bad = df["er"] > MAX_RATE
    print(f"[audit] dropping {int(bad.sum())} impossible rows (>{MAX_RATE} engagements/view); keeping {int((~bad).sum())}/{n_raw}")
    df = df[~bad].copy()

    # 2. benchmark
    qs = np.linspace(0, 1, 201)
    def dist(s):
        return {"n": int(len(s)), "median_er": float(s["er"].median()),
                "er_q": [float(x) for x in np.quantile(s["er"], qs)],
                "like_q": [float(x) for x in np.quantile(s["likes_count"] / s["impressions"], qs)],
                "share_q": [float(x) for x in np.quantile(s["shares_count"] / s["impressions"], qs)],
                "comment_q": [float(x) for x in np.quantile(s["comments_count"] / s["impressions"], qs)]}
    benchmark = {"quantile_grid": [float(q) for q in qs], "max_rate": MAX_RATE,
                 "shrinkage_pseudo_views": 20, "All": dist(df)}
    for p, s in df.groupby("platform"):
        benchmark[p] = dist(s)

    # 3. sentiment classifier
    df["text_clean"] = df["text_content"].fillna("").map(clean_text)
    Xtr, Xte, ytr, yte = train_test_split(df["text_clean"], df["sentiment_label"], test_size=0.2,
                                          random_state=SEED, stratify=df["sentiment_label"])
    fx_tr = [clean_text(t) for t, _ in FASHION_TRAIN]; fy_tr = [l for _, l in FASHION_TRAIN]
    fx_te = [clean_text(t) for t, _ in FASHION_TEST];  fy_te = [l for _, l in FASHION_TEST]
    REP = 15
    X_fit = pd.concat([Xtr, pd.Series(fx_tr * REP)], ignore_index=True)
    y_fit = pd.concat([ytr, pd.Series(fy_tr * REP)], ignore_index=True)

    def make():
        return Pipeline([("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True)),
                         ("lr", LogisticRegression(max_iter=2000, C=3.0, class_weight="balanced"))])
    sent = make().fit(X_fit, y_fit)
    p_ds = sent.predict(Xte); p_fa = sent.predict(fx_te)
    majority = float((yte == yte.mode()[0]).mean())
    ds_acc = accuracy_score(yte, p_ds); ds_f1 = f1_score(yte, p_ds, average="macro")
    fa_acc = accuracy_score(fy_te, p_fa); fa_f1 = f1_score(fy_te, p_fa, average="macro")
    fa_major = float(pd.Series(fy_te).value_counts(normalize=True).max())
    print(f"[sentiment] dataset hold-out: acc {ds_acc:.3f} macroF1 {ds_f1:.3f} (majority {majority:.3f})")
    print(f"[sentiment] unseen fashion comments: acc {fa_acc:.3f} macroF1 {fa_f1:.3f} (majority {fa_major:.3f}, n={len(fy_te)})")
    print(classification_report(fy_te, p_fa, digits=3, zero_division=0))
    labels = ["Negative", "Neutral", "Positive"]
    cm = confusion_matrix(fy_te, p_fa, labels=labels).tolist()

    X_all = pd.concat([df["text_clean"], pd.Series(fx_tr * REP)], ignore_index=True)
    y_all = pd.concat([df["sentiment_label"], pd.Series(fy_tr * REP)], ignore_index=True)
    joblib.dump(make().fit(X_all, y_all), os.path.join(HERE, "sentiment.pkl"))

    # 4. honest pre-launch experiment
    cat = ["platform", "day_of_week", "sentiment_label", "emotion_type", "topic_category", "campaign_phase", "language"]
    Xp = pd.get_dummies(df[cat].fillna("Unknown").astype(str))
    for c in ["sentiment_score", "toxicity_score", "user_past_sentiment_avg", "user_engagement_growth", "buzz_change_rate"]:
        Xp[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    Xp["hashtag_count"] = df["hashtags"].fillna("").map(lambda s: len([h for h in s.split(",") if h.strip()]))
    Xp["text_length"] = df["text_content"].fillna("").str.len()
    y = np.log1p(df["er"].values)
    cv = cross_val_score(RandomForestRegressor(200, max_depth=8, min_samples_leaf=10, n_jobs=-1, random_state=SEED),
                         Xp, y, cv=KFold(5, shuffle=True, random_state=SEED), scoring="r2")
    verdict = ("no learnable signal: content/timing features do not predict engagement in this dataset, "
               "so no pre-launch prediction is shown to users") if cv.mean() < 0.02 else "some signal"
    print(f"[pre-launch] 5-fold CV R2 = {cv.mean():+.4f} +/- {cv.std():.4f} (baseline 0.0) -> {verdict}")

    metrics = {
        "trained_rows_after_cleaning": int(len(df)), "rows_dropped_impossible": int(bad.sum()),
        "leakage_audit": {"engagement_rate_equals_formula_max_abs_diff": max_diff,
                          "finding": "old RF used formula inputs as features -> inflated accuracy; removed"},
        "sentiment": {
            "dataset_holdout": {"accuracy": ds_acc, "macro_f1": ds_f1, "majority_baseline": majority, "n_test": int(len(yte))},
            "fashion_comments": {"accuracy": fa_acc, "macro_f1": fa_f1, "majority_baseline": fa_major,
                                 "n_test": len(fy_te), "labels": labels, "confusion_matrix": cm},
            "note": "dataset text is templated/synthetic; the fashion-comment set is the more realistic estimate"},
        "prelaunch_experiment": {"model": "RandomForestRegressor", "target": "log1p(engagement_rate)",
                                 "cv_r2_mean": float(cv.mean()), "cv_r2_std": float(cv.std()),
                                 "baseline_r2": 0.0, "verdict": verdict},
    }
    with open(os.path.join(HERE, "benchmark.json"), "w") as f: json.dump(benchmark, f)
    with open(os.path.join(HERE, "metrics.json"), "w") as f: json.dump(metrics, f, indent=2)
    print("Saved sentiment.pkl, benchmark.json, metrics.json")


if __name__ == "__main__":
    main()
