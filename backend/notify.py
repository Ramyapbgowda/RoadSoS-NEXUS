"""
RoadSoS NEXUS - Pre-Arrival Alert System
===========================================
Stage 5 (alert half) + Breakthrough II from the deck: "Pre-Arrival Alert &
Hospital Bed Reservation" via Twilio/MSG91.

No real SMS/WhatsApp account is wired up here (that needs your own Twilio/
MSG91 API keys) — instead this logs every alert to `alerts_log.jsonl` so you
can SHOW the exact payload that would be sent, in the video pitch or a live
demo, without needing paid credentials.

UPGRADE PATH TO PRODUCTION:
    pip install twilio
    from twilio.rest import Client
    client = Client(TWILIO_SID, TWILIO_AUTH_TOKEN)
    client.messages.create(to=phone, from_=TWILIO_NUMBER, body=message)
Replace the body of `_dispatch_message()` below with the above — the rest
of this file (message construction, logging) stays the same.
"""
import json
import os
from datetime import datetime

LOG_PATH = os.path.join(os.path.dirname(__file__), "alerts_log.jsonl")


def _dispatch_message(channel: str, to: str, message: str):
    """Simulated send — logs the alert. Swap for real Twilio/MSG91 call in production."""
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "channel": channel,
        "to": to,
        "message": message,
    }
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")
    print(f"[SIMULATED {channel.upper()}] -> {to}: {message}")
    return entry


def send_family_alert(incident: dict, dispatch_info: dict):
    contact = incident.get("emergency_contact", "+91-9999999999")
    msg = (
        f"RoadSoS Alert: Your contact was in an incident near "
        f"({incident['lat']:.4f}, {incident['lon']:.4f}). "
        f"Ambulance dispatched to {dispatch_info.get('hospital', 'nearest hospital')}, "
        f"ETA {dispatch_info.get('eta_minutes', '?')} min. Live tracking: "
        f"https://roadsos.app/track/{incident['incident_id']}"
    )
    return _dispatch_message("sms+whatsapp", contact, msg)


def send_hospital_alert(incident: dict, triage_info: dict, dispatch_info: dict):
    hospital = dispatch_info.get("hospital", "Nearest Hospital")
    msg = (
        f"INCOMING TRAUMA — {incident['incident_id']} | "
        f"Urgency: {triage_info.get('urgency', 'UNKNOWN')} | "
        f"Prebook: {', '.join(triage_info.get('resources_prebooked', []))} | "
        f"ETA {dispatch_info.get('eta_minutes', '?')} min"
    )
    return _dispatch_message("hospital-api", hospital, msg)


def send_family_call(incident: dict):
    contact = incident.get("emergency_contact", "+91-9999999999")
    msg = f"Automated voice call placed to {contact} regarding incident {incident['incident_id']}."
    return _dispatch_message("voice-call", contact, msg)


def get_notification_timeline(incident_id: str) -> list:
    """Reads back every alert logged for a given incident, in order — powers the UI timeline."""
    if not os.path.exists(LOG_PATH):
        return []
    events = []
    with open(LOG_PATH) as f:
        for line in f:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if incident_id in entry.get("message", ""):
                events.append(entry)
    return events



def dispatch_ambulance(incident_id: str, hospital: str):
    msg = f"Ambulance dispatched for {incident_id}, routing to {hospital}."
    return _dispatch_message("dispatch-system", "fleet-control", msg)
