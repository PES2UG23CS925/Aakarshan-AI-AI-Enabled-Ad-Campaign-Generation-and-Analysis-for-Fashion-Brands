#!/usr/bin/env python3
import os, json, warnings
import numpy as np, pandas as pd, joblib
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
warnings.filterwarnings("ignore")
ARTIFACTS = os.path.dirname(os.path.abspath(__file__))
CSV_PATH  = os.path.join(ARTIFACTS, "dataset.csv")
print("📊 Loading dataset...")
df = pd.read_csv(CSV_PATH)
df["hashtag_count"]   = df["hashtags"].fillna("").apply(lambda x: len([h for h in x.split(",") if h.strip()]))
df["mention_count"]   = df["mentions"].fillna("").apply(lambda x: len([m for m in x.split(",") if m.strip()]))
df["has_mention"]     = (df["mention_count"] > 0).astype(int)
df["keyword_count"]   = df["keywords"].fillna("").apply(lambda x: len([k for k in x.split(",") if k.strip()]))
df["text_length"]     = df["text_content"].fillna("").apply(len)
df["log_likes"]       = np.log1p(df["likes_count"].fillna(0))
df["log_shares"]      = np.log1p(df["shares_count"].fillna(0))
df["log_comments"]    = np.log1p(df["comments_count"].fillna(0))
df["log_impressions"] = np.log1p(df["impressions"].fillna(1))
df["like_share_ratio"]= df["likes_count"] / (df["shares_count"] + 1)
df["engagement_rate"] = df["engagement_rate"].clip(0, 35)
# Percentile-based balanced scoring
df["performance_score"] = df["engagement_rate"].rank(pct=True) * 100
df["performance_score"]  = df["performance_score"].clip(0,100)
def tier(s):
    if s < 25: return "Low"
    elif s < 50: return "Medium"
    elif s < 75: return "High"
    else: return "Viral"
df["performance_tier"] = df["performance_score"].apply(tier)
print("Tier distribution:", df["performance_tier"].value_counts().to_dict())
CAT_FEATURES = ["platform","day_of_week","sentiment_label","emotion_type","topic_category","campaign_phase","language"]
for col in CAT_FEATURES: df[col] = df[col].fillna("Unknown").astype(str)
encoders = {}
for col in CAT_FEATURES:
    le = LabelEncoder()
    df[col+"_enc"] = le.fit_transform(df[col])
    encoders[col]  = le
NUM_FEATURES = ["sentiment_score","toxicity_score","hashtag_count","mention_count","keyword_count","text_length","has_mention","user_past_sentiment_avg","user_engagement_growth","buzz_change_rate","log_likes","log_shares","log_comments","log_impressions","like_share_ratio"]
ENC_FEATURES = [c+"_enc" for c in CAT_FEATURES]
ALL_FEATURES = NUM_FEATURES + ENC_FEATURES
for col in NUM_FEATURES: df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
X = df[ALL_FEATURES].values
y_tier  = df["performance_tier"].values
y_score = df["performance_score"].values
X_tr,X_te,yt_tr,yt_te,ys_tr,ys_te = train_test_split(X,y_tier,y_score,test_size=0.2,random_state=42,stratify=y_tier)
print("Training classifier...")
clf = RandomForestClassifier(n_estimators=200,max_depth=20,min_samples_leaf=2,n_jobs=-1,random_state=42)
clf.fit(X_tr,yt_tr)
acc = accuracy_score(yt_te,clf.predict(X_te))
print(f"  Accuracy: {acc*100:.1f}%")
print("Training regressor...")
reg = RandomForestRegressor(n_estimators=200,max_depth=20,min_samples_leaf=2,n_jobs=-1,random_state=42)
reg.fit(X_tr,ys_tr)
ys_pred = reg.predict(X_te)
mae = mean_absolute_error(ys_te,ys_pred); r2 = r2_score(ys_te,ys_pred)
print(f"  MAE:{mae:.2f}  R2:{r2:.4f}")
def avg_by(col): return df.groupby(col)["performance_score"].mean().round(2).to_dict()
def cnt_by(col): return df[col].value_counts().to_dict()
metadata = {
    "cat_features":CAT_FEATURES,"enc_features":ENC_FEATURES,"all_features":ALL_FEATURES,"num_features":NUM_FEATURES,
    "classifier_classes":clf.classes_.tolist(),
    "feature_importances":dict(zip(ALL_FEATURES,clf.feature_importances_.tolist())),
    "platform_stats":{"avg_perf":avg_by("platform"),"count":cnt_by("platform")},
    "sentiment_stats":{"avg_score":avg_by("sentiment_label"),"count":cnt_by("sentiment_label")},
    "phase_stats":{"avg_score":avg_by("campaign_phase"),"count":cnt_by("campaign_phase")},
    "emotion_stats":{"avg_score":avg_by("emotion_type"),"count":cnt_by("emotion_type")},
    "day_stats":{"avg_score":avg_by("day_of_week"),"count":cnt_by("day_of_week")},
    "topic_stats":{"avg_score":avg_by("topic_category"),"count":cnt_by("topic_category")},
    "model_metrics":{"classifier_accuracy":float(acc),"regressor_mae":float(mae),"regressor_r2":float(r2),"training_rows":int(len(X_tr)),"test_rows":int(len(X_te))}
}
joblib.dump(clf, os.path.join(ARTIFACTS,"classifier.pkl"))
joblib.dump(reg, os.path.join(ARTIFACTS,"regressor.pkl"))
joblib.dump(encoders, os.path.join(ARTIFACTS,"label_encoders.pkl"))
with open(os.path.join(ARTIFACTS,"metadata.json"),"w") as f: json.dump(metadata,f,indent=2)
print(f"✅ Done! Saved to {ARTIFACTS}")
