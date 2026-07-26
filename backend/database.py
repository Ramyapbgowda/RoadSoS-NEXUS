"""
SQLite database setup for RoadSoS NEXUS (offline-capable, matches the deck's
"SQLite (offline)" stack entry). Swap for PostgreSQL + Redis in production
by changing only the connection function below.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "nexus.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    return conn


def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            incident_id TEXT PRIMARY KEY,
            lat REAL, lon REAL,
            reported_text TEXT,
            detected_language TEXT,
            severity TEXT,
            risk_band REAL DEFAULT 0,
            risk_score REAL,
            urgency TEXT,
            hospital TEXT,
            eta_minutes REAL,
            vehicle_type TEXT,
            num_victims INTEGER,
            weather TEXT,
            road_condition TEXT,
            emergency_contact TEXT,
            created_at TEXT
        )
    """)
    # Backfill columns for DBs created before this schema version (safe no-op if already present)
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(incidents)")}
    for col, coltype in [
        ("risk_score", "REAL"), ("vehicle_type", "TEXT"), ("num_victims", "INTEGER"),
        ("weather", "TEXT"), ("road_condition", "TEXT"), ("emergency_contact", "TEXT"),
    ]:
        if col not in existing_cols:
            conn.execute(f"ALTER TABLE incidents ADD COLUMN {col} {coltype}")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS hazards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL, lon REAL,
            description TEXT,
            hazard_type TEXT,
            reported_at TEXT,
            expires_at REAL
        )
    """)
    conn.commit()
    conn.close()


def save_incident(record: dict):
    conn = get_connection()
    conn.execute(
        """INSERT OR REPLACE INTO incidents
           (incident_id, lat, lon, reported_text, detected_language, severity,
            risk_band, risk_score, urgency, hospital, eta_minutes, vehicle_type,
            num_victims, weather, road_condition, emergency_contact, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            record["incident_id"], record["lat"], record["lon"], record.get("reported_text", ""),
            record.get("detected_language", ""), record.get("severity", ""),
            record.get("risk_band", ""), record.get("risk_score", 0), record.get("urgency", ""),
            record.get("hospital", ""), record.get("eta_minutes", 0),
            record.get("vehicle_type", "unknown"), record.get("num_victims", 1),
            record.get("weather", "clear"), record.get("road_condition", "dry"),
            record.get("emergency_contact", ""),
            record["created_at"],
        ),
    )
    conn.commit()
    conn.close()


def list_incidents(limit=50, search=None, severity=None, risk_band=None):
    conn = get_connection()
    query = "SELECT * FROM incidents WHERE 1=1"
    params = []
    if search:
        query += " AND (incident_id LIKE ? OR reported_text LIKE ? OR hospital LIKE ?)"
        params += [f"%{search}%"] * 3
    if severity:
        query += " AND severity = ?"
        params.append(severity)
    if risk_band:
        query += " AND risk_band = ?"
        params.append(risk_band)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(query, params).fetchall()
    cols = [d[0] for d in conn.execute("SELECT * FROM incidents LIMIT 0").description]
    conn.close()
    return [dict(zip(cols, r)) for r in rows]


def delete_incident(incident_id: str) -> bool:
    conn = get_connection()
    cur = conn.execute("DELETE FROM incidents WHERE incident_id = ?", (incident_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted
