"""
RoadSoS NEXUS - Main Application (v2 — full dashboard backend)
==================================================================
Run with:  python app.py
Then open: http://localhost:5000
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, request, jsonify, send_from_directory, Response

from database import init_db, save_incident, list_incidents, delete_incident, get_connection
from risk_model import predict_risk
from cv_severity import assess_severity
from language import respond as language_respond, detect_language
from agents import orchestrate, new_incident_id
from hazard_map import report_hazard, get_active_hazards
from hospitals import find_nearest_hospital, list_hospitals_near
from police import find_nearest_station
from notify import send_family_call, get_notification_timeline
from federated import simulate_federated_round
from digital_twin import get_simulation_state
from analytics import get_dashboard_stats, get_incidents_last_n_days
from export import incidents_to_csv, incidents_to_pdf_bytes
import numpy as np

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
init_db()


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


# ---------------------------------------------------------------- INCIDENT
@app.route("/api/incident", methods=["POST"])
def create_incident():
    start = time.time()

    image_bytes = None
    if request.files.get("image"):
        image_bytes = request.files["image"].read()

    data = request.form if request.form else (request.get_json(silent=True) or {})

    try:
        lat = float(data.get("lat"))
        lon = float(data.get("lon"))
    except (TypeError, ValueError):
        return jsonify({"error": "lat and lon are required and must be numeric"}), 400

    reported_text = data.get("reported_text", "")
    emergency_contact = data.get("emergency_contact", "+91-9999999999")
    vehicle_type = data.get("vehicle_type", "unknown")
    num_victims = int(data.get("num_victims", 1))
    weather = data.get("weather", "clear")
    road_condition = data.get("road_condition", "dry")

    incident_id = new_incident_id()

    lang_result = language_respond(reported_text)

    if image_bytes:
        cv_result = assess_severity(image_bytes)
    else:
        cv_result = {"severity": "SERIOUS", "confidence": 50.0, "detections": [],
                      "estimated_injuries": num_victims, "fire_or_smoke_detected": False,
                      "note": "no image supplied, using default"}

    risk_features = {
        "is_night": int(data.get("is_night", 0)),
        "is_raining": int(data.get("is_raining", 0)) or (1 if weather == "rain" else 0),
        "curve_sharpness": float(data.get("curve_sharpness", 0.3)),
        "historical_accidents_90d": int(data.get("historical_accidents_90d", 2)),
        "road_surface_quality": 0.3 if road_condition in ("wet", "damaged") else 0.7,
    }
    risk_result = predict_risk(risk_features)

    incident = {
        "incident_id": incident_id,
        "lat": lat, "lon": lon,
        "reported_text": reported_text,
        "emergency_contact": emergency_contact,
        "num_victims": num_victims,
        "is_raining": risk_features["is_raining"],
        "detected_language": lang_result["detected_language"],
        "cv_result": cv_result,
        "risk_result": risk_result,
    }

    orchestration_result = orchestrate(incident)
    send_family_call(incident)

    total_latency_ms = round((time.time() - start) * 1000, 1)

    record = {
        "incident_id": incident_id,
        "lat": lat, "lon": lon,
        "reported_text": reported_text,
        "detected_language": lang_result["detected_language"],
        "severity": cv_result["severity"],
        "risk_band": risk_result["risk_band"],
        "risk_score": risk_result["risk_score"],
        "urgency": orchestration_result["agents"]["Triage"]["urgency"],
        "hospital": orchestration_result["agents"]["Dispatch"]["hospital"],
        "eta_minutes": orchestration_result["agents"]["Dispatch"]["eta_minutes"],
        "vehicle_type": vehicle_type,
        "num_victims": num_victims,
        "weather": weather,
        "road_condition": road_condition,
        "emergency_contact": emergency_contact,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    save_incident(record)

    return jsonify({
        "incident_id": incident_id,
        "pipeline_latency_ms": total_latency_ms,
        "language": lang_result,
        "cv_severity": cv_result,
        "risk_analysis": risk_result,
        "orchestration": orchestration_result,
        "lat": lat, "lon": lon,
    })


@app.route("/api/incidents", methods=["GET"])
def get_incidents():
    search = request.args.get("search")
    severity = request.args.get("severity")
    risk_band = request.args.get("risk_band")
    limit = int(request.args.get("limit", 50))
    return jsonify(list_incidents(limit=limit, search=search, severity=severity, risk_band=risk_band))


@app.route("/api/incidents/<incident_id>", methods=["DELETE"])
def remove_incident(incident_id):
    ok = delete_incident(incident_id)
    return jsonify({"deleted": ok})


@app.route("/api/incidents/export.csv", methods=["GET"])
def export_csv():
    rows = list_incidents(limit=10000)
    csv_text = incidents_to_csv(rows)
    return Response(csv_text, mimetype="text/csv",
                     headers={"Content-Disposition": "attachment; filename=incidents.csv"})


@app.route("/api/incidents/export.pdf", methods=["GET"])
def export_pdf():
    rows = list_incidents(limit=40)
    pdf_bytes = incidents_to_pdf_bytes(rows)
    return Response(pdf_bytes, mimetype="application/pdf",
                     headers={"Content-Disposition": "attachment; filename=incidents.pdf"})


# ---------------------------------------------------------------- HAZARDS
@app.route("/api/hazard", methods=["POST"])
def create_hazard():
    data = request.get_json(force=True)
    conn = get_connection()
    result = report_hazard(conn, float(data["lat"]), float(data["lon"]), data.get("description", ""))
    conn.close()
    return jsonify(result)


@app.route("/api/hazards", methods=["GET"])
def get_hazards():
    lat = float(request.args.get("lat", 12.9716))
    lon = float(request.args.get("lon", 77.5946))
    radius = float(request.args.get("radius_km", 10))
    return jsonify(get_active_hazards(lat, lon, radius))


# ---------------------------------------------------------------- HOSPITALS / POLICE
@app.route("/api/hospitals", methods=["GET"])
def hospitals_near():
    lat = float(request.args.get("lat", 12.9716))
    lon = float(request.args.get("lon", 77.5946))
    radius = float(request.args.get("radius_km", 15))
    return jsonify(list_hospitals_near(lat, lon, radius))


@app.route("/api/police/nearest", methods=["GET"])
def police_nearest():
    lat = float(request.args.get("lat", 12.9716))
    lon = float(request.args.get("lon", 77.5946))
    return jsonify(find_nearest_station(lat, lon))


# ---------------------------------------------------------------- NOTIFICATIONS
@app.route("/api/notifications/<incident_id>", methods=["GET"])
def notifications_timeline(incident_id):
    return jsonify(get_notification_timeline(incident_id))


# ---------------------------------------------------------------- DIGITAL TWIN
@app.route("/api/digital-twin", methods=["GET"])
def digital_twin():
    inc_lat = float(request.args.get("incident_lat", 12.9716))
    inc_lon = float(request.args.get("incident_lon", 77.5946))
    hosp_lat = float(request.args.get("hospital_lat", 12.9634))
    hosp_lon = float(request.args.get("hospital_lon", 77.5730))
    return jsonify(get_simulation_state(inc_lat, inc_lon, hosp_lat, hosp_lon))


# ---------------------------------------------------------------- FEDERATED LEARNING
@app.route("/api/federated/simulate", methods=["POST"])
def federated_simulate():
    dummy_global = np.random.randn(13)
    result = simulate_federated_round(dummy_global)
    result["new_global_weights"] = result["new_global_weights"].tolist()
    return jsonify(result)


# ---------------------------------------------------------------- ANALYTICS
@app.route("/api/analytics/dashboard", methods=["GET"])
def analytics_dashboard():
    return jsonify(get_dashboard_stats())


@app.route("/api/analytics/timeline", methods=["GET"])
def analytics_timeline():
    days = int(request.args.get("days", 7))
    return jsonify(get_incidents_last_n_days(days))


# ---------------------------------------------------------------- VOICE / LANGUAGE
@app.route("/api/language/detect", methods=["POST"])
def language_detect():
    data = request.get_json(force=True)
    text = data.get("text", "")
    return jsonify(language_respond(text))


if __name__ == "__main__":
    print("=" * 60)
    print("RoadSoS NEXUS backend running at http://localhost:5000")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
