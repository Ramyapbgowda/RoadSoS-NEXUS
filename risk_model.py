"""
RoadSoS NEXUS - Accident Risk Prediction Engine
=================================================
Stage 3 of the pipeline: "Risk Analysis (Edge AI + Prediction)"

This is a REAL, working, trained model — a logistic regression implemented
in pure numpy (no sklearn/xgboost dependency needed to run offline/edge).

UPGRADE PATH TO PRODUCTION (as pitched: "XGBoost + LSTM on 12 variables"):
  1. Replace `FEATURES` below with your real 12 variables (road geometry,
     weather, traffic density, time-of-day, historical accident count, etc.)
  2. Swap `train()` / `predict()` for `xgboost.XGBClassifier` (tabular risk
     score) feeding into a `torch`/`keras` LSTM for the time-series risk
     heatmap (5-min rolling window mentioned in the deck).
  3. Keep this same function signature (`predict_risk(features: dict) -> dict`)
     so the rest of the pipeline (app.py, agents.py) doesn't need to change.

This module trains itself on synthetic-but-realistic data on first run and
caches the weights to disk, so it works completely offline.
"""
import json
import os
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "risk_model_weights.json")

# The 12 variables mirrored from the pitch deck's "XGBoost+LSTM on 12 variables"
FEATURES = [
    "speed_limit_kmph",       # road speed limit
    "curve_sharpness",        # 0-1, higher = sharper curve
    "traffic_density",        # 0-1, vehicles per segment
    "is_night",               # 0/1
    "is_raining",             # 0/1
    "visibility_km",          # visibility distance
    "road_surface_quality",   # 0-1, higher = better
    "historical_accidents_90d",  # count in last 90 days at this segment
    "is_highway",             # 0/1
    "pedestrian_density",     # 0-1
    "has_streetlights",       # 0/1
    "is_weekend",             # 0/1
]


def _synthetic_training_set(n=4000, seed=42):
    """Generates a synthetic-but-domain-realistic dataset to bootstrap the model."""
    rng = np.random.default_rng(seed)
    X = np.column_stack([
        rng.uniform(30, 120, n),      # speed_limit_kmph
        rng.uniform(0, 1, n),         # curve_sharpness
        rng.uniform(0, 1, n),         # traffic_density
        rng.integers(0, 2, n),        # is_night
        rng.integers(0, 2, n),        # is_raining
        rng.uniform(0.05, 5, n),      # visibility_km
        rng.uniform(0, 1, n),         # road_surface_quality
        rng.poisson(3, n),            # historical_accidents_90d
        rng.integers(0, 2, n),        # is_highway
        rng.uniform(0, 1, n),         # pedestrian_density
        rng.integers(0, 2, n),        # has_streetlights
        rng.integers(0, 2, n),        # is_weekend
    ])
    # Hand-crafted realistic risk function -> ground truth labels
    z = (
        0.02 * X[:, 0]
        + 3.0 * X[:, 1]
        + 2.0 * X[:, 2]
        + 1.2 * X[:, 3]
        + 1.5 * X[:, 4]
        - 0.8 * X[:, 5]
        - 2.0 * X[:, 6]
        + 0.25 * X[:, 7]
        + 0.5 * X[:, 8]
        + 1.0 * X[:, 9]
        - 1.0 * X[:, 10]
        + 0.3 * X[:, 11]
        - 6.0
    )
    prob = 1 / (1 + np.exp(-z))
    y = (rng.uniform(0, 1, n) < prob).astype(float)
    return X, y


def _normalize(X, mean, std):
    return (X - mean) / (std + 1e-8)


def train(save=True):
    X, y = _synthetic_training_set()
    mean, std = X.mean(axis=0), X.std(axis=0)
    Xn = _normalize(X, mean, std)
    Xb = np.column_stack([np.ones(len(Xn)), Xn])  # bias term

    weights = np.zeros(Xb.shape[1])
    lr, epochs = 0.1, 2000
    n = len(y)
    for _ in range(epochs):
        z = Xb @ weights
        pred = 1 / (1 + np.exp(-z))
        grad = Xb.T @ (pred - y) / n
        weights -= lr * grad

    model = {"weights": weights.tolist(), "mean": mean.tolist(), "std": std.tolist(), "features": FEATURES}
    if save:
        with open(MODEL_PATH, "w") as f:
            json.dump(model, f)
    return model


def _load_or_train():
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH) as f:
            return json.load(f)
    return train(save=True)


_MODEL = _load_or_train()


def predict_risk(feature_values: dict) -> dict:
    """
    feature_values: dict with keys matching FEATURES (missing keys default sensibly).
    Returns risk score 0-100, band (LOW/MEDIUM/HIGH/CRITICAL), and top contributing factors.
    """
    defaults = {
        "speed_limit_kmph": 60, "curve_sharpness": 0.3, "traffic_density": 0.4,
        "is_night": 0, "is_raining": 0, "visibility_km": 3.0,
        "road_surface_quality": 0.7, "historical_accidents_90d": 2,
        "is_highway": 0, "pedestrian_density": 0.3, "has_streetlights": 1, "is_weekend": 0,
    }
    row = np.array([[feature_values.get(f, defaults[f]) for f in FEATURES]], dtype=float)
    mean, std = np.array(_MODEL["mean"]), np.array(_MODEL["std"])
    rown = _normalize(row, mean, std)
    rowb = np.column_stack([np.ones(len(rown)), rown])
    weights = np.array(_MODEL["weights"])
    z = float((rowb @ weights).item())
    prob = 1 / (1 + np.exp(-z))
    score = round(float(prob) * 100, 1)

    if score >= 75:
        band = "CRITICAL"
    elif score >= 50:
        band = "HIGH"
    elif score >= 25:
        band = "MEDIUM"
    else:
        band = "LOW"

    # crude per-feature contribution for explainability (|weight * normalized value|)
    contribs = np.abs(weights[1:] * rown[0])
    top_idx = np.argsort(-contribs)[:3]
    top_factors = [FEATURES[i] for i in top_idx]

    return {"risk_score": score, "risk_band": band, "top_factors": top_factors}


if __name__ == "__main__":
    train()
    print("Trained. Example prediction:")
    print(predict_risk({"is_night": 1, "is_raining": 1, "curve_sharpness": 0.8, "historical_accidents_90d": 9}))
