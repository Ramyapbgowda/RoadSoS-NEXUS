"""
RoadSoS NEXUS - Digital Twin (simulation stand-in for SUMO)
==============================================================
Real SUMO integration needs the `sumo` binary, a `.net.xml` road network
file, and traffic-flow config — not producible inside this chat. This
module generates a genuine, deterministic simulated road-network state
(nodes, edges, a moving ambulance position interpolated along a route,
and traffic-light phase) that the frontend animates every poll — same
data contract SUMO's TraCI interface would hand you, so it's a real
swap-in point, not a dead end.

UPGRADE PATH TO PRODUCTION:
    pip install traci sumolib
    Run `sumo -c network.sumocfg --remote-port 8813`, then poll vehicle
    positions via `traci.vehicle.getPosition(vehID)` instead of
    `_interpolate()` below — the frontend polling contract doesn't change.
"""
import math
import time

# A small simulated road graph around a demo incident site
NODES = {
    "A": (12.9716, 77.5946), "B": (12.9634, 77.5730), "C": (12.9580, 77.6100),
    "D": (12.9500, 77.5900), "E": (12.9750, 77.6050),
}
EDGES = [("A", "C"), ("C", "B"), ("A", "E"), ("E", "D"), ("D", "B")]

TRAFFIC_LIGHTS = [
    {"id": "TL-1", "lat": 12.9650, "lon": 77.5980, "phase": "green"},
    {"id": "TL-2", "lat": 12.9550, "lon": 77.6000, "phase": "red"},
]


def _interpolate(p1, p2, t):
    return (p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t)


def get_simulation_state(incident_lat: float, incident_lon: float, hospital_lat: float, hospital_lon: float) -> dict:
    """
    Returns current simulated ambulance position along the incident->hospital
    route, plus traffic light phases, computed from wall-clock time so
    repeated polls animate smoothly without needing server-side session state.
    """
    now = time.time()
    cycle_seconds = 60  # one full incident->hospital traversal per minute, for demo pacing
    t = (now % cycle_seconds) / cycle_seconds  # 0..1

    amb_lat, amb_lon = _interpolate((incident_lat, incident_lon), (hospital_lat, hospital_lon), t)

    lights = []
    for tl in TRAFFIC_LIGHTS:
        phase_cycle = int(now // 10) % 2  # flips every 10s
        lights.append({**tl, "phase": "green" if phase_cycle == 0 else "red"})

    remaining_km = math.hypot(hospital_lat - amb_lat, hospital_lon - amb_lon) * 111  # rough km/degree
    eta_min = round(remaining_km / 40 * 60, 1)

    return {
        "ambulance_position": {"lat": amb_lat, "lon": amb_lon},
        "route_progress_pct": round(t * 100, 1),
        "eta_minutes": eta_min,
        "traffic_lights": lights,
        "nodes": NODES,
        "edges": EDGES,
    }
