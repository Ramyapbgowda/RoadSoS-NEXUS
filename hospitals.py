"""
Hospital directory + nearest-hospital lookup (haversine distance).
Seeded with a small sample of real-world-style hospitals for demo purposes.
UPGRADE PATH: replace HOSPITALS with a live feed from a hospital-bed API /
government Health ID registry, or a PostGIS query as pitched in the deck.
"""
import math
import random

HOSPITALS = [
    {"name": "St. John's Medical College Hospital", "lat": 12.9279, "lon": 77.6271, "trauma_center": True,
     "total_beds": 45, "icu_beds": 8, "blood_bank": True, "doctors_on_call": 6},
    {"name": "Victoria Hospital (BMCRI)", "lat": 12.9634, "lon": 77.5730, "trauma_center": True,
     "total_beds": 60, "icu_beds": 12, "blood_bank": True, "doctors_on_call": 9},
    {"name": "Manipal Hospital Old Airport Road", "lat": 12.9581, "lon": 77.6480, "trauma_center": True,
     "total_beds": 30, "icu_beds": 6, "blood_bank": True, "doctors_on_call": 5},
    {"name": "Fortis Hospital Bannerghatta Road", "lat": 12.8845, "lon": 77.5955, "trauma_center": False,
     "total_beds": 20, "icu_beds": 3, "blood_bank": False, "doctors_on_call": 3},
    {"name": "Apollo Hospital Bannerghatta Road", "lat": 12.8988, "lon": 77.5980, "trauma_center": True,
     "total_beds": 35, "icu_beds": 7, "blood_bank": True, "doctors_on_call": 7},
    {"name": "Narayana Health City", "lat": 12.8080, "lon": 77.6180, "trauma_center": True,
     "total_beds": 50, "icu_beds": 10, "blood_bank": True, "doctors_on_call": 8},
    {"name": "Sagar Hospital Jayanagar", "lat": 12.9250, "lon": 77.5850, "trauma_center": False,
     "total_beds": 18, "icu_beds": 2, "blood_bank": False, "doctors_on_call": 2},
]

BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _live_availability(h):
    """Deterministic-ish 'live' bed availability so the demo shows realistic churn without a real feed."""
    rng = random.Random(h["name"])  # stable per-hospital, still varies across calls slightly
    beds_free = rng.randint(1, max(1, h["total_beds"] // 3))
    icu_free = rng.randint(0, max(1, h["icu_beds"] // 2))
    blood_stock = {bg: rng.randint(0, 20) for bg in BLOOD_GROUPS} if h["blood_bank"] else {}
    return beds_free, icu_free, blood_stock


def find_nearest_hospital(lat: float, lon: float, require_trauma_center: bool = False) -> dict:
    candidates = [h for h in HOSPITALS if (not require_trauma_center or h["trauma_center"])]
    best = min(candidates, key=lambda h: _haversine_km(lat, lon, h["lat"], h["lon"]))
    dist = round(_haversine_km(lat, lon, best["lat"], best["lon"]), 2)
    beds_free, icu_free, blood_stock = _live_availability(best)
    return {**best, "distance_km": dist, "beds_available": beds_free,
            "icu_available": icu_free, "blood_stock": blood_stock}


def list_hospitals_near(lat: float, lon: float, radius_km: float = 15, limit: int = 10) -> list:
    out = []
    for h in HOSPITALS:
        d = _haversine_km(lat, lon, h["lat"], h["lon"])
        if d <= radius_km:
            beds_free, icu_free, blood_stock = _live_availability(h)
            out.append({**h, "distance_km": round(d, 2), "beds_available": beds_free,
                        "icu_available": icu_free, "blood_stock": blood_stock})
    out.sort(key=lambda h: h["distance_km"])
    return out[:limit]

