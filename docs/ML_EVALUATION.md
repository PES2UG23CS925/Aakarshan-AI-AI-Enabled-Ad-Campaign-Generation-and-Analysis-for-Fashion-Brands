# ML evaluation (v5.1)

Everything below is produced by `python ml_artifacts/evaluate.py` from `ml_artifacts/dataset.csv`
and the code in `train.py` / `inference.py`. Figures are in `ml_artifacts/evaluation/`; raw numbers in `evaluation.json`.

## 1. Benchmark scorer
Reference: 11,837 posts after removing rows with impossible engagement (more than 1 engagement per view). Median engagement rate 7.98 %.
A post's score is the percentile of its engagement rate on its own platform. Small samples are pulled towards the platform median with a Gamma-Poisson prior worth 20 pseudo-views.

* **Calibration check.** Scoring the benchmark posts against their own platform curve gives an almost perfectly uniform score: Low 25.0 %, Medium 25.0 %, High 25.0 %, Viral 25.0 % (in-sample by construction; `fig_score_calibration.png`).
* **Uncertainty shrinks with views** (engagement rate fixed at 12 %, Instagram; `fig_score_uncertainty.png`):

| Views | Score | 10-90 % range | Confidence label |
|---|---|---|---|
| 10 | 54.3 | 7.4 - 73.0 | Low |
| 20 | 56.2 | 14.8 - 72.0 | Medium |
| 50 | 63.4 | 38.1 - 73.6 | Medium |
| 100 | 64.7 | 48.7 - 72.7 | High |
| 200 | 65.9 | 56.0 - 71.3 | High |
| 500 | 66.4 | 60.6 - 70.4 | High |
| 1000 | 66.5 | 62.5 - 69.6 | High |
| 5000 | 66.7 | 64.9 - 68.2 | High |

## 2. Sentiment classifier (TF-IDF 1-2 grams + class-balanced logistic regression)
Hold-out: 20 % of the dataset comments (n = 2,368), stratified, `random_state = 42`. Accuracy **93.2 %**, macro-F1 **0.926**, one-vs-rest AUC 0.995 / 0.995 / 0.996 (Negative / Neutral / Positive).

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| Negative | 0.949 | 0.924 | 0.936 | 958 |
| Neutral | 0.867 | 0.930 | 0.897 | 454 |
| Positive | 0.949 | 0.941 | 0.945 | 956 |

Fashion comments written by the team and never used for training (n = 22): accuracy **72.7 %**.

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| Negative | 0.615 | 1.000 | 0.762 | 8 |
| Neutral | 1.000 | 0.500 | 0.667 | 6 |
| Positive | 0.833 | 0.625 | 0.714 | 8 |

The gap between 93.2 % and 72.7 % is expected: the dataset text is templated, hand-written fashion comments are not. Twenty-two comments is a small test set, so read the second number as indicative. Figures: `fig_sentiment_confusion.png`, `fig_sentiment_roc.png`, `fig_sentiment_features.png`, `fig_sentiment_learning_curve.png`.

## 3. Pre-launch engagement prediction (negative result)
A random forest on content and timing features known before launch (platform, weekday, emotion, topic, campaign phase, language, sentiment score, toxicity, hashtag count, text length ...) reached R^2 = **-0.0061 +/- 0.0031** over 5-fold cross-validation, i.e. no better than predicting the mean (`fig_prelaunch_cv.png`). The application therefore does not show a pre-launch prediction.
Engagement, likes, shares and comments are deliberately excluded from the inputs: engagement rate is exactly (likes + shares + comments) / impressions in this dataset, so using them would leak the target.

## 4. Bayesian A/B decision rule
A winner is declared only when one variant has at least 97.5 % probability of being best **and** every variant has at least 30 views. 120 simulated tests per point (`fig_ab_power.png`):

| Views per variant | Winner declared when the real rates are 10 % vs 14 % | Winner declared when both are 12 % (false winner) |
|---|---|---|
| 50 | 8 % | 3.3 % |
| 100 | 9 % | 5.8 % |
| 200 | 22 % | 2.5 % |
| 300 | 22 % | 7.5 % |
| 500 | 45 % | 0.8 % |
| 750 | 61 % | 3.3 % |
| 1000 | 67 % | 2.5 % |
| 1500 | 85 % | 2.5 % |
| 2000 | 99 % | 5.8 % |

The rule is deliberately conservative: it rarely crowns a winner by luck (about 4 % on average across the grid), and it needs roughly 1,500-2,000 views per variant to find a 4-point difference reliably. With fewer views the app says "keep collecting data" instead of guessing.

## 4b. Cost of one ML call
Compute time inside Python: score about 15 ms, sentiment for 200 comments about 14 ms, three-variant A/B test about 4 ms. The API starts a Python process per call, so the end-to-end time is dominated by interpreter and library start-up: about 1.3 s for `analyze` and 0.85 s for `ab_test` on the build machine. A long-running worker would remove most of that and is listed as future work.

## 5. Reproduce
```
cd Backend
pip install -r requirements-dev.txt
python ml_artifacts/train.py      # rebuilds sentiment.pkl, benchmark.json, metrics.json
python ml_artifacts/test_ml.py    # 15 checks
python ml_artifacts/evaluate.py   # figures + evaluation.json (about two minutes)
```
