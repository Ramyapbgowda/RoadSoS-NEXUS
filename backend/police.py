"""
RoadSoS NEXUS - Police Module
================================
Nearest police station lookup + simulated patrol dispatch.
Same honesty pattern as hospitals.py — real haversine geo-logic,
seeded directory data, simulated live dispatch state.
"""
import math
import random

POLICE_STATIONS = [
    {"name": "Koramangala Traffic Police Station", "lat": 12.9352, "lon": 77.6146, "contact": "+91-80-2553-3100"},
    {"name": "Jayanagar Traffic Police Station", "lat": 12.9250, "lon": 77.5938, "contact": "+91-80-2664-1400"},
    {"name": "Whitefield Traffic Police Station", "lat": 12.9698, "lon": 77.7500, "contact": "+91-80-2841-2000"},
    {"name": "Indiranagar Traffic Police Station", "lat": 12.9719, "lon": 77.6412, "contact": "+91-80-2525-1500"},
    {"name": "Electronic City Traffic Police Station", "lat": 12.8452, "lon": 77.6602, "contact": "+91-80-2783-2200"},
]


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_nearest_station(lat: float, lon: float) -> dict:
    best = min(POLICE_STATIONS, key=lambda p: _haversine_km(lat, lon, p["lat"], p["lon"]))
    dist = round(_haversine_km(lat, lon, best["lat"], best["lon"]), 2)
    eta_min = round(dist / 35 * 60 + 2, 1)  # ~35km/h avg + prep
    rng = random.Random(best["name"] + str(int(lat * 100)))
    return {
        **best,
        "distance_km": dist,
        "eta_minutes": eta_min,
        "patrol_dispatched": True,
        "patrol_unit": f"PCR-{rng.randint(100,999)}",
    }
