"""
evaluate.py - reproducible evaluation of the Aakarshan AI analytics models.

Run:  python ml_artifacts/evaluate.py           (about 1-2 minutes)
Out:  ml_artifacts/evaluation/*.png  and  ml_artifacts/evaluation/evaluation.json

Everything here is computed from ml_artifacts/dataset.csv and the code in train.py / inference.py;
nothing is typed in by hand. The sentiment model is re-fitted on the same 80/20 split that train.py
reports (random_state=42), so the hold-out numbers match metrics.json.
"""
import json
import os
import sys
import time

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (auc, classification_report, confusion_matrix, f1_score, roc_curve)
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.preprocessing import label_binarize

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import inference as inf                      # noqa: E402
import train as tr                           # noqa: E402

OUT = os.path.join(HERE, "evaluation")
os.makedirs(OUT, exist_ok=True)
SEED = 42
CLASSES = ["Negative", "Neutral", "Positive"]
plt.rcParams.update({"font.family": "DejaVu Serif", "font.size": 10, "axes.grid": True, "grid.alpha": 0.3})
res = {}


def load():
    df = pd.read_csv(os.path.join(HERE, "dataset.csv"))
    df["text_clean"] = df["text_content"].map(tr.clean_text)
    # same cleaning as train.py: engagement rate from raw counts, impossible rows dropped
    df["er"] = (df.likes_count + df.shares_count + df.comments_count) / df.impressions
    df = df[df["er"] <= tr.MAX_RATE].copy()
    return df


def sentiment_eval(df):
    """Hold-out evaluation + fashion test set + ROC + coefficients + learning curve."""
    d = df[df["sentiment_label"].isin(CLASSES)].copy()
    X, y = d["text_clean"].values, d["sentiment_label"].values
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)
    REP = 15                                   # same up-weighting of the hand-written fashion comments as train.py
    aug_x = [tr.clean_text(t) for t, _ in tr.FASHION_TRAIN] * REP
    aug_y = [l for _, l in tr.FASHION_TRAIN] * REP
    X_fit, y_fit = np.concatenate([Xtr, aug_x]), np.concatenate([ytr, aug_y])
    model = tr.make_sentiment_pipeline().fit(X_fit, y_fit)

    # --- hold-out (templated dataset text) ---
    pred = model.predict(Xte)
    proba = model.predict_proba(Xte)
    classes = list(model.classes_)
    rep = classification_report(yte, pred, labels=CLASSES, output_dict=True, zero_division=0)
    cm = confusion_matrix(yte, pred, labels=CLASSES)
    # --- fashion test set (22 hand-written comments) ---
    fx = [tr.clean_text(t) for t, _ in tr.FASHION_TEST]
    fy = [l for _, l in tr.FASHION_TEST]
    fpred = model.predict(fx)
    frep = classification_report(fy, fpred, labels=CLASSES, output_dict=True, zero_division=0)
    fcm = confusion_matrix(fy, fpred, labels=CLASSES)

    # --- ROC (one-vs-rest) on hold-out ---
    Y = label_binarize(yte, classes=classes)
    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    aucs = {}
    for i, c in enumerate(classes):
        fpr, tpr, _ = roc_curve(Y[:, i], proba[:, i])
        aucs[c] = float(auc(fpr, tpr))
        ax.plot(fpr, tpr, lw=2, label=f"{c} (AUC = {aucs[c]:.3f})")
    ax.plot([0, 1], [0, 1], "k--", lw=1, label="Chance")
    ax.set(xlabel="False positive rate", ylabel="True positive rate", title="Sentiment classifier: one-vs-rest ROC (hold-out)")
    ax.legend(loc="lower right")
    fig.tight_layout(); fig.savefig(os.path.join(OUT, "fig_sentiment_roc.png"), dpi=200); plt.close(fig)

    # --- confusion matrices (two panels) ---
    fig, axes = plt.subplots(1, 2, figsize=(9.2, 4.0))
    for ax, m, title in [(axes[0], cm, f"Dataset hold-out (n = {len(yte)})"), (axes[1], fcm, f"Fashion comments (n = {len(fy)})")]:
        norm = m / np.maximum(m.sum(axis=1, keepdims=True), 1)
        im = ax.imshow(norm, cmap="Blues", vmin=0, vmax=1)
        ax.set_xticks(range(3)); ax.set_xticklabels(CLASSES); ax.set_yticks(range(3)); ax.set_yticklabels(CLASSES)
        ax.set(xlabel="Predicted", ylabel="Actual", title=title); ax.grid(False)
        for i in range(3):
            for j in range(3):
                ax.text(j, i, f"{m[i, j]}", ha="center", va="center", color="white" if norm[i, j] > 0.5 else "black", fontsize=11)
    fig.suptitle("Sentiment classifier confusion matrices (cell = count, shade = row share)", y=1.0)
    fig.tight_layout(); fig.savefig(os.path.join(OUT, "fig_sentiment_confusion.png"), dpi=200); plt.close(fig)

    # --- strongest n-grams per class (the feature-importance view of a linear model) ---
    tf, lr = model.named_steps["tfidf"], model.named_steps["lr"]
    names = np.array(tf.get_feature_names_out())
    fig, axes = plt.subplots(1, 3, figsize=(10.5, 3.9))
    top = {}
    for ax, (i, c) in zip(axes, enumerate(lr.classes_)):
        idx = np.argsort(lr.coef_[i])[-10:]
        top[c] = [(names[j], float(lr.coef_[i][j])) for j in idx[::-1]]
        ax.barh([names[j] for j in idx], lr.coef_[i][idx], color={"Negative": "#ef4444", "Neutral": "#94a3b8", "Positive": "#10b981"}[c])
        ax.set_title(f"Top terms: {c}"); ax.tick_params(axis="y", labelsize=8)
    fig.tight_layout(); fig.savefig(os.path.join(OUT, "fig_sentiment_features.png"), dpi=200); plt.close(fig)

    # --- learning curve: macro-F1 on the hold-out vs share of training data ---
    fr = [0.02, 0.05, 0.1, 0.2, 0.4, 0.7, 1.0]
    rng = np.random.default_rng(SEED)
    lc = []
    for f in fr:
        sc = []
        for rep_i in range(3):
            n = max(int(len(Xtr) * f), 30)
            idx = rng.choice(len(Xtr), n, replace=False)
            m = tr.make_sentiment_pipeline().fit(np.concatenate([Xtr[idx], aug_x]), np.concatenate([ytr[idx], aug_y]))
            sc.append(f1_score(yte, m.predict(Xte), average="macro"))
        lc.append((f, float(np.mean(sc)), float(np.std(sc))))
    fig, ax = plt.subplots(figsize=(5.4, 3.8))
    ax.errorbar([a for a, _, _ in lc], [b for _, b, _ in lc], yerr=[c for _, _, c in lc], marker="o", capsize=3)
    ax.set(xscale="log", xlabel="Share of training data used", ylabel="Macro-F1 on hold-out", title="Learning curve of the sentiment classifier")
    ax.set_xticks(fr); ax.set_xticklabels([f"{int(f*100)}%" for f in fr])
    fig.tight_layout(); fig.savefig(os.path.join(OUT, "fig_sentiment_learning_curve.png"), dpi=200); plt.close(fig)

    # --- latency of the sentiment call (in-process, 200 comments, as the API does) ---
    texts = [str(t) for t in df["text_content"].head(200)]
    inf.sentiment_batch(texts[:5])
    t0 = time.perf_counter()
    for _ in range(10):
        inf.sentiment_batch(texts)
    sent_ms = (time.perf_counter() - t0) / 10 * 1000

    res["sentiment"] = {
        "holdout_n": int(len(yte)), "holdout_accuracy": float(rep["accuracy"]),
        "holdout_macro_f1": float(rep["macro avg"]["f1-score"]),
        "holdout_per_class": {c: {k: float(rep[c][k]) for k in ("precision", "recall", "f1-score", "support")} for c in CLASSES},
        "holdout_confusion": cm.tolist(), "auc_ovr": aucs,
        "fashion_n": len(fy), "fashion_accuracy": float(frep["accuracy"]),
        "fashion_per_class": {c: {k: float(frep[c][k]) for k in ("precision", "recall", "f1-score", "support")} for c in CLASSES},
        "fashion_confusion": fcm.tolist(), "top_terms": top,
        "learning_curve": [{"share": a, "macro_f1": b, "std": c} for a, b, c in lc],
        "latency_ms_200_comments": sent_ms,
    }


def benchmark_eval(df):
    """Reference curves, calibration, small-sample shrinkage."""
    bm = inf.load_json("benchmark.json")
    grid = bm["quantile_grid"]
    k = bm["shrinkage_pseudo_views"]

    # reference curves (engagement-rate quantiles per platform)
    fig, ax = plt.subplots(figsize=(6.2, 4.0))
    for p in ["Facebook", "Instagram", "Reddit", "Twitter", "YouTube"]:
        ax.plot(bm[p]["er_q"], grid, lw=1.6, label=f"{p} (n={bm[p]['n']})")
    ax.set(xlabel="Engagement rate  (likes + shares + comments) / views", ylabel="Percentile (score)", title="Benchmark percentile curves per platform")
    ax.legend(fontsize=8)
    fig.tight_layout(); fig.savefig(os.path.join(OUT, "fig_benchmark_curves.png"), dpi=200); plt.close(fig)

    # calibration: score every benchmark post against its own platform curve -> should be ~uniform
    d = df.dropna(subset=["er"])
    d = d[d["er"] <= bm["max_rate"]]
    scores, plats = [], []
    for p in ["Facebook", "Instagram", "Reddit", "Twitter", "YouTube"]:
        sub = d[d["platform"] == p]
        sc = [inf.pct(v, bm[p]["er_q"], grid) for v in sub["er"].values]
        scores += sc; plats += [p] * len(sc)
    scores = np.array(scores)
    tiers = {"Low (<25)": float((scores < 25).mean()), "Medium (25-50)": float(((scores >= 25) & (scores < 50)).mean()),
             "High (50-75)": float(((scores >= 50) & (scores < 75)).mean()), "Viral (>=75)": float((scores >= 75).mean())}
    fig, ax = plt.subplots(figsize=(5.6, 3.6))
    ax.hist(scores, bins=20, range=(0, 100), color="#3b82f6", edgecolor="white")
    ax.axhline(len(scores) / 20, color="k", ls="--", lw=1, label="Ideal (uniform)")
    ax.set(xlabel="Performance score", ylabel="Posts", title="Calibration: scores of the benchmark posts themselves"); ax.legend()
    fig.tight_layout(); fig.savefig(os.path.join(OUT, "fig_score_calibration.png"), dpi=200); plt.close(fig)

    # small-sample behaviour: same raw rate (12 %) at increasing views
    views_grid = [10, 20, 50, 100, 200, 500, 1000, 5000]
    rows = []
    for v in views_grid:
        r = inf.mode_analyze({"views": v, "likes": int(round(0.12 * v)), "shares": 0, "comments": 0, "clicks": 0, "platform": "Instagram"})
        rows.append({"views": v, "score": r["performance_score"], "lo": r["score_range"][0], "hi": r["score_range"][1], "confidence": r["confidence"]})
    fig, ax = plt.subplots(figsize=(5.8, 3.8))
    ax.plot(views_grid, [r["score"] for r in rows], "o-", label="Score")
    ax.fill_between(views_grid, [r["lo"] for r in rows], [r["hi"] for r in rows], alpha=0.25, label="10-90% range")
    ax.set(xscale="log", xlabel="Views (engagement rate fixed at 12 %)", ylabel="Performance score", title="Score and uncertainty vs number of views")
    ax.legend(); fig.tight_layout(); fig.savefig(os.path.join(OUT, "fig_score_uncertainty.png"), dpi=200); plt.close(fig)

    # latency of one analyze call (in-process)
    inf.mode_analyze({"views": 500, "likes": 40, "shares": 5, "comments": 4, "clicks": 20, "platform": "Instagram"})
    t0 = time.perf_counter()
    for _ in range(20):
        inf.mode_analyze({"views": 500, "likes": 40, "shares": 5, "comments": 4, "clicks": 20, "platform": "Instagram"})
    an_ms = (time.perf_counter() - t0) / 20 * 1000
    res["benchmark"] = {"n_posts": bm["All"]["n"], "k_pseudo_views": k, "median_er_all": bm["All"]["median_er"],
                        "calibration_tier_shares": tiers, "uncertainty_table": rows, "analyze_latency_ms": an_ms}


def ab_eval():
    """Monte-Carlo power / false-winner curves for the Bayesian A/B rule (winner needs P>=97.5% and >=30 views)."""
    rng = np.random.default_rng(7)
    grid = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000]
    sims = 120
    out = []
    for v in grid:
        win_real, win_same, wrong = 0, 0, 0
        for _ in range(sims):
            # real difference: 10 % vs 14 % engagement
            ea, eb = rng.binomial(v, 0.10), rng.binomial(v, 0.14)
            r = inf.mode_ab_test({"platform": "Instagram", "variants": [
                {"index": 1, "views": v, "likes": int(ea), "shares": 0, "comments": 0, "clicks": 0},
                {"index": 2, "views": v, "likes": int(eb), "shares": 0, "comments": 0, "clicks": 0}]})
            if r["status"] == "winner":
                win_real += 1
                wrong += int(r["leader"] != 2)
            # identical ads: both 12 %
            ea, eb = rng.binomial(v, 0.12), rng.binomial(v, 0.12)
            r = inf.mode_ab_test({"platform": "Instagram", "variants": [
                {"index": 1, "views": v, "likes": int(ea), "shares": 0, "comments": 0, "clicks": 0},
                {"index": 2, "views": v, "likes": int(eb), "shares": 0, "comments": 0, "clicks": 0}]})
            win_same += int(r["status"] == "winner")
        out.append({"views_per_variant": v, "detect_real_gap": win_real / sims, "wrong_winner": wrong / sims, "false_winner_identical": win_same / sims})
    fig, ax = plt.subplots(figsize=(6.2, 4.0))
    ax.plot(grid, [o["detect_real_gap"] * 100 for o in out], "o-", label="Real gap (10 % vs 14 %): winner declared")
    ax.plot(grid, [o["false_winner_identical"] * 100 for o in out], "s--", color="#ef4444", label="Identical ads (12 % vs 12 %): false winner")
    ax.axhline(5, color="gray", lw=1, ls=":")
    ax.set(xlabel="Views per variant", ylabel="Share of simulated tests (%)", title=f"A/B decision rule: power and false-winner rate ({sims} simulations per point)")
    ax.title.set_fontsize(9); ax.legend(fontsize=8)
    fig.tight_layout(); fig.savefig(os.path.join(OUT, "fig_ab_power.png"), dpi=200); plt.close(fig)

    t0 = time.perf_counter()
    for _ in range(10):
        inf.mode_ab_test({"platform": "Instagram", "variants": [{"index": i, "views": 500, "likes": 50, "shares": 0, "comments": 0, "clicks": 0} for i in (1, 2, 3)]})
    res["ab"] = {"simulations_per_point": sims, "curve": out, "latency_ms_3_variants": (time.perf_counter() - t0) / 10 * 1000}


def prelaunch_eval(df):
    Xp, y = tr.prelaunch_matrix(df)
    kf = KFold(5, shuffle=True, random_state=SEED)
    rf = RandomForestRegressor(200, max_depth=8, min_samples_leaf=10, n_jobs=-1, random_state=SEED)
    sc = cross_val_score(rf, Xp, y, cv=kf, scoring="r2")
    fig, ax = plt.subplots(figsize=(5.2, 3.6))
    ax.bar(range(1, 6), sc, color="#94a3b8"); ax.axhline(0, color="k", lw=1)
    ax.set(xlabel="Cross-validation fold", ylabel="R$^2$", title="Pre-launch model: R$^2$ per fold (0 = predict the mean)")
    ax.set_ylim(-0.05, 0.05)
    fig.tight_layout(); fig.savefig(os.path.join(OUT, "fig_prelaunch_cv.png"), dpi=200); plt.close(fig)
    res["prelaunch"] = {"cv_r2_folds": [float(s) for s in sc], "cv_r2_mean": float(sc.mean()), "cv_r2_std": float(sc.std())}


def main():
    df = load()
    print("sentiment..."); sentiment_eval(df)
    print("benchmark..."); benchmark_eval(df)
    print("A/B simulation (this is the slow part)..."); ab_eval()
    print("pre-launch CV..."); prelaunch_eval(df)
    json.dump(res, open(os.path.join(OUT, "evaluation.json"), "w"), indent=2)
    print("Saved figures and evaluation.json to", OUT)
    s = res["sentiment"]
    print(f"Sentiment hold-out accuracy {s['holdout_accuracy']:.3f}, macro-F1 {s['holdout_macro_f1']:.3f}; fashion accuracy {s['fashion_accuracy']:.3f}")
    print("AUC:", {k: round(v, 3) for k, v in s["auc_ovr"].items()})


if __name__ == "__main__":
    main()
