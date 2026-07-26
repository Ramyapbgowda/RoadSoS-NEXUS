"""
RoadSoS NEXUS - Crowdsourced Hazard Mapping
==============================================
Breakthrough III from the deck: potholes/waterlogging/debris reports,
classified and geo-indexed, feeding the Route Agent.

Real, working: SQLite storage + haversine radius queries + simple keyword-
based hazard-type classification (functions as a genuine, if lightweight,
stand-in for the pitched IndicBERT NLP classifier).

UPGRADE PATH TO PRODUCTION:
    - Swap keyword classifier below for a fine-tuned IndicBERT text-classification
      pipeline (`transformers.pipeline("text-classification", model=...)`)
    - Swap SQLite table for PostGIS with a real spatial index (`ST_DWithin`)
    - Swap the manual federated-averaging in federated.py for real Flower FL
      client/server rounds across multiple device nodes
"""
import math
import sqlite3
import time
from datetime import datetime

DB_PATH = None  # set by database.py at import time


HAZARD_KEYWORDS = {
    "pothole": ["pothole", "gaddha", "hole", "gड्ढा"],
    "waterlogging": ["waterlogging", "flood", "water", "paani"],
    "debris": ["debris", "rubble", "fallen tree", "landslide", "rockfall"],
    "accident_residue": ["glass", "oil spill", "wreckage"],
}


def classify_hazard_text(text: str) -> str:
    text_l = (text or "").lower()
    for hazard_type, keywords in HAZARD_KEYWORDS.items():
        if any(kw in text_l for kw in keywords):
            return hazard_type
    return "unclassified"


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def report_hazard(conn: sqlite3.Connection, lat: float, lon: float, description: str):
    hazard_type = classify_hazard_text(description)
    ts = datetime.utcnow().isoformat() + "Z"
    conn.execute(
        "INSERT INTO hazards (lat, lon, description, hazard_type, reported_at, expires_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (lat, lon, description, hazard_type, ts, time.time() + 3 * 3600),  # hazards expire after 3h
    )
    conn.commit()
    return {"hazard_type": hazard_type, "reported_at": ts}


def get_active_hazards(lat: float, lon: float, radius_km: float = 2.0, conn: sqlite3.Connection = None):
    from database import get_connection
    own_conn = conn is None
    conn = conn or get_connection()
    rows = conn.execute(
        "SELECT lat, lon, description, hazard_type, reported_at FROM hazards WHERE expires_at > ?",
        (time.time(),),
    ).fetchall()
    nearby = [
        {"lat": r[0], "lon": r[1], "description": r[2], "hazard_type": r[3], "reported_at": r[4]}
        for r in rows if _haversine_km(lat, lon, r[0], r[1]) <= radius_km
    ]
    if own_conn:
        conn.close()
    return nearby
