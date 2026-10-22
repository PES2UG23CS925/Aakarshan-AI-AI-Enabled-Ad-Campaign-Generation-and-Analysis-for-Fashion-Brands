#!/usr/bin/env python3
"""Sanity tests for the scoring model. Run: npm run test:ml"""
import os, sys, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable

def run(d):
    out = subprocess.run([PY, os.path.join(HERE, "inference.py"), json.dumps(d)], capture_output=True, text=True)
    return json.loads(out.stdout)

def A(**k):
    base = {"mode": "analyze", "platform": "Instagram", "views": 500, "likes": 0, "shares": 0, "comments": 0, "clicks": 0}
    base.update(k); return run(base)

fails = 0
def check(name, cond):
    global fails
    print(("PASS " if cond else "FAIL ") + name); fails += 0 if cond else 1

lo, mid, hi = A(likes=2), A(likes=40, shares=10, comments=5), A(likes=200, shares=60, comments=40)
check("score rises with engagement", lo["performance_score"] < mid["performance_score"] < hi["performance_score"])
check("scores stay within 0-100", all(0 <= r["performance_score"] <= 100 for r in (lo, mid, hi)))
check("tier matches score", lo["tier"] == "Low" and hi["tier"] in ("High", "Viral"))
few, many = A(views=3, likes=2), A(views=600, likes=400)
check("few views => wider range + Low confidence", (few["score_range"][1]-few["score_range"][0]) > (many["score_range"][1]-many["score_range"][0]) and few["confidence"] == "Low")
check("tier probabilities sum to ~100", abs(sum(mid["tier_probabilities"].values()) - 100) < 1)
check("unknown platform falls back to All benchmark", A(platform="TikTok", likes=20)["benchmark"]["platform_used"] == "All")
check("zero views returns no_data", run({"mode": "analyze", "views": 0}).get("error") == "no_data")
check("CTR computed from clicks", abs(A(clicks=25)["ctr"] - 0.05) < 1e-6)
s = run({"mode": "sentiment", "texts": ["I love this, gorgeous!", "terrible quality, overpriced", "does it come in black?"]})["results"]
check("sentiment pos/neg/neutral", [r["label"] for r in s] == ["Positive", "Negative", "Neutral"])
def V(i, views, e, clicks=0): return {"index": i, "image_url": "u%d" % i, "views": views, "likes": e, "shares": 0, "comments": 0, "clicks": clicks}
ab = lambda vs: run({"mode": "ab_test", "platform": "Instagram", "variants": vs})
check("A/B: too few views => collecting, no leader", ab([V(0, 5, 3), V(1, 6, 0), V(2, 4, 1)])["status"] == "collecting" and ab([V(0, 5, 3), V(1, 6, 0), V(2, 4, 1)])["leader"] is None)
r = ab([V(0, 400, 120), V(1, 400, 20), V(2, 400, 25)])
check("A/B: clear winner detected", r["status"] == "winner" and r["leader"] == 0)
r = ab([V(0, 400, 40), V(1, 400, 41)])
check("A/B: near-identical variants => no false winner", r["status"] in ("no_winner", "leaning") and r["status"] != "winner")
check("A/B: probabilities sum to 100", abs(sum(x["prob_best"] for x in ab([V(0, 100, 10), V(1, 100, 20), V(2, 100, 5)])["variants"]) - 100) < 0.5)
# false-positive rate: identical true rates must almost never produce a 'winner'
import random; random.seed(3); fp = 0; RUNS = 60
for _ in range(RUNS):
    a = sum(random.random() < 0.10 for _ in range(300)); b = sum(random.random() < 0.10 for _ in range(300))
    fp += ab([V(0, 300, a), V(1, 300, b)])["status"] == "winner"
check(f"A/B: false-winner rate on identical variants <= 12% ({fp}/{RUNS})", fp / RUNS <= 0.12)
m = json.load(open(os.path.join(HERE, "metrics.json")))
check("no leakage: pre-launch model not overclaimed", m["prelaunch_experiment"]["cv_r2_mean"] < 0.05)
print(f"\n{'ALL TESTS PASSED' if not fails else str(fails)+' FAILED'}"); sys.exit(1 if fails else 0)
