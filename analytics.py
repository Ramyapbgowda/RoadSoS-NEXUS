"""
RoadSoS NEXUS - Analytics Module
===================================
Real SQL aggregation over the incidents table — every number here is
computed from actual stored incidents, not hardcoded. On a fresh database
these will legitimately show zeros/empty until incidents are submitted;
that's correct behavior, not a bug (see README for demo-seeding tips).
"""
from datetime import datetime, timedelta
from database import get_connection


def get_dashboard_stats() -> dict:
    conn = get_connection()
    today = datetime.utcnow().strftime("%Y-%m-%d")

    total = conn.execute("SELECT COUNT(*) FROM incidents").fetchone()[0]
    today_count = conn.execute(
        "SELECT COUNT(*) FROM incidents WHERE created_at LIKE ?", (f"{today}%",)
    ).fetchone()[0]

    avg_eta = conn.execute("SELECT AVG(eta_minutes) FROM incidents").fetchone()[0] or 0

    severity_rows = conn.execute(
        "SELECT severity, COUNT(*) FROM incidents GROUP BY severity"
    ).fetchall()
    severity_dist = {row[0] or "UNKNOWN": row[1] for row in severity_rows}

    lang_rows = conn.execute(
        "SELECT detected_language, COUNT(*) FROM incidents GROUP BY detected_language"
    ).fetchall()
    language_usage = {row[0] or "unknown": row[1] for row in lang_rows}

    risk_rows = conn.execute(
        "SELECT risk_band, COUNT(*) FROM incidents GROUP BY risk_band"
    ).fetchall()
    risk_dist = {row[0] or "UNKNOWN": row[1] for row in risk_rows}

    hospital_rows = conn.execute(
        "SELECT hospital, COUNT(*), AVG(eta_minutes) FROM incidents GROUP BY hospital"
    ).fetchall()
    hospital_stats = [
        {"hospital": row[0], "incidents": row[1], "avg_eta": round(row[2] or 0, 1)}
        for row in hospital_rows
    ]

    # simple lives-saveable estimate based on the deck's 58%->79% Golden Hour survival delta
    lives_saveable_estimate = round(total * 0.21, 1)

    conn.close()
    return {
        "total_incidents": total,
        "incidents_today": today_count,
        "avg_response_eta_minutes": round(avg_eta, 1),
        "severity_distribution": severity_dist,
        "risk_distribution": risk_dist,
        "language_usage": language_usage,
        "hospital_stats": hospital_stats,
        "lives_saveable_estimate": lives_saveable_estimate,
        "prediction_accuracy_note": "N/A on synthetic-trained model until validated against real labeled incidents",
    }


def get_incidents_last_n_days(n=7) -> list:
    conn = get_connection()
    cutoff = (datetime.utcnow() - timedelta(days=n)).isoformat()
    rows = conn.execute(
        "SELECT substr(created_at,1,10) as day, COUNT(*) FROM incidents "
        "WHERE created_at >= ? GROUP BY day ORDER BY day", (cutoff,)
    ).fetchall()
    conn.close()
    return [{"day": row[0], "count": row[1]} for row in rows]
