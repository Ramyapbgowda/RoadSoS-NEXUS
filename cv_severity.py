"""
RoadSoS NEXUS - Computer Vision Severity AI
=============================================
Stage 2 of the pipeline (CV half): "YOLOv8 on dashcam/CCTV frames"

IMPORTANT / HONEST NOTE FOR YOUR TEAM:
Real YOLOv8 crash-severity detection needs (a) the `ultralytics` package,
(b) pretrained or fine-tuned weights on a labeled crash dataset (e.g. COCO
+ an accident-severity dataset), and (c) a GPU for real-time inference.
None of that can be produced from inside a chat — there's no dataset or
weights file to hand you that would be honest to claim as "trained".

What THIS module does instead: a real, working image-analysis heuristic
(edge density + red-channel dominance + contour count via PIL/numpy) that
produces a genuine severity score from an actual uploaded image — so your
demo is functionally real (an image goes in, a severity score comes out),
just using classical CV instead of a trained deep net.

UPGRADE PATH TO PRODUCTION:
    pip install ultralytics
    from ultralytics import YOLO
    model = YOLO("crash_severity_best.pt")   # your fine-tuned weights
    results = model(image_path)
    # map results.boxes / results.probs -> severity score
Swap the body of `assess_severity()` with the above and keep the same
return signature — nothing else in the pipeline needs to change.
"""
import io
import random
import numpy as np
from PIL import Image, ImageFilter

DETECTABLE_CLASSES = ["vehicle", "bike", "bus", "truck", "person", "helmet", "fire", "smoke"]


def _simulate_detections(edge_density: float, red_dominance: float, brightness: float, seed: int) -> list:
    """
    Simulates YOLO-style bounding box detections. Real class counts are
    influenced by the actual image signals (more edges -> more objects
    plausible; high red -> fire/smoke more likely) so it's not pure random
    noise, but this is NOT a trained detector — see module docstring.
    """
    rng = random.Random(seed)
    n_objects = 1 + int(edge_density * 6)
    detections = []
    weighted_classes = ["vehicle", "bike", "person"] * 3
    if red_dominance > 0.4:
        weighted_classes += ["fire", "smoke"]
    if brightness < 0.3:
        weighted_classes += ["vehicle"]  # low-light scenes often dominated by vehicle silhouettes

    for _ in range(min(n_objects, 8)):
        cls = rng.choice(weighted_classes + DETECTABLE_CLASSES)
        x = rng.uniform(0.05, 0.75)
        y = rng.uniform(0.05, 0.75)
        w = rng.uniform(0.1, 0.25)
        h = rng.uniform(0.1, 0.25)
        conf = round(rng.uniform(0.55, 0.97), 2)
        detections.append({"class": cls, "confidence": conf, "box": [round(x,3), round(y,3), round(w,3), round(h,3)]})
    return detections



def assess_severity(image_bytes: bytes) -> dict:
    """
    Takes raw image bytes (dashcam/CCTV frame or bystander photo).
    Returns a severity classification with a numeric confidence.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return {"severity": "UNKNOWN", "confidence": 0.0, "reason": "unreadable image"}

    img = img.resize((256, 256))
    arr = np.asarray(img).astype(float)

    # Edge density (proxy for debris/deformation chaos in the frame)
    edges = img.convert("L").filter(ImageFilter.FIND_EDGES)
    edge_arr = np.asarray(edges).astype(float)
    edge_density = edge_arr.mean() / 255.0

    # Red-channel dominance (proxy for blood/brake-light/flare signal — crude but real signal)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    red_dominance = np.clip((r.mean() - (g.mean() + b.mean()) / 2) / 255.0, 0, 1)

    # Overall scene darkness (low-light nighttime crashes are harder to triage visually)
    brightness = arr.mean() / 255.0

    # Composite severity score (weights tuned by hand — replace with a trained model's
    # output distribution once you have real labeled data)
    raw_score = 0.55 * edge_density + 0.30 * red_dominance + 0.15 * (1 - brightness)
    severity_score = round(float(raw_score) * 100, 1)

    if severity_score >= 65:
        severity = "CRITICAL"
    elif severity_score >= 40:
        severity = "SERIOUS"
    else:
        severity = "MINOR"

    seed = int(edge_density * 1000) + int(red_dominance * 1000)
    detections = _simulate_detections(edge_density, red_dominance, brightness, seed)
    estimated_injuries = sum(1 for d in detections if d["class"] == "person")
    fire_detected = any(d["class"] in ("fire", "smoke") for d in detections)

    return {
        "severity": severity,
        "confidence": severity_score,
        "signals": {
            "edge_density": round(edge_density, 3),
            "red_dominance": round(red_dominance, 3),
            "brightness": round(brightness, 3),
        },
        "detections": detections,
        "estimated_injuries": estimated_injuries,
        "fire_or_smoke_detected": fire_detected,
        "note": "heuristic CV model — swap in fine-tuned YOLOv8 weights for production",
    }
