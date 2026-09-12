from dataclasses import dataclass
from typing import List, Dict, Any


@dataclass
class Road:
    id: str
    name: str
    risk_threshold: float
    connected_village: str
    connected_hospital: str


@dataclass
class Village:
    id: str
    name: str
    population: int


@dataclass
class Hospital:
    id: str
    name: str
    capacity: int


roads: List[Road] = [
    Road(
        id="R1",
        name="NH-31 Flood Embankment Link",
        risk_threshold=0.50,
        connected_village="V1",
        connected_hospital="H1",
    ),
    Road(
        id="R2",
        name="SH-58 Diara Access Corridor",
        risk_threshold=0.65,
        connected_village="V2",
        connected_hospital="H2",
    ),
    Road(
        id="R3",
        name="MDR-14 Rural Embankment Bypass",
        risk_threshold=0.75,
        connected_village="V3",
        connected_hospital="H2",
    ),
    Road(
        id="R4",
        name="Pond Embankment Rural Link",
        risk_threshold=0.60,
        connected_village="V4",
        connected_hospital="H1",
    ),
    Road(
        id="R5",
        name="Sultanganj Ghat Causeway",
        risk_threshold=0.70,
        connected_village="V5",
        connected_hospital="H3",
    ),
]

villages: List[Village] = [
    Village(id="V1", name="Pipra Dewas", population=5420),
    Village(id="V2", name="Sultanganj Diara", population=7850),
    Village(id="V3", name="Manjhaul Lowlands", population=4200),
    Village(id="V4", name="Mohanpur West", population=3600),
    Village(id="V5", name="Rampur Ghat Diara", population=4850),
]

hospitals: List[Hospital] = [
    Hospital(id="H1", name="Barauni Primary Health Centre (PHC)", capacity=60),
    Hospital(id="H2", name="Sadar District Hospital (Begusarai)", capacity=180),
    Hospital(id="H3", name="Sultanganj Community Health Centre (CHC)", capacity=80),
]


def calculate_cascade(risk_score: float) -> Dict[str, Any]:
    affected_roads = []
    affected_villages = []
    affected_hospitals = []

    for road in roads:
        if risk_score >= road.risk_threshold:
            affected_roads.append(road.id)

            if road.connected_village not in affected_villages:
                affected_villages.append(road.connected_village)

            if road.connected_hospital not in affected_hospitals:
                affected_hospitals.append(road.connected_hospital)

    population_affected = sum(
        village.population
        for village in villages
        if village.id in affected_villages
    )

    return {
        "risk_score": risk_score,
        "affected_roads": affected_roads,
        "affected_villages": affected_villages,
        "affected_hospitals": affected_hospitals,
        "population_affected": population_affected,
        "details": {
            "villages": [
                {"id": v.id, "name": v.name, "population": v.population, "status": "ISOLATED" if v.id in affected_villages else "ACCESSIBLE"}
                for v in villages
            ],
            "hospitals": [
                {"id": h.id, "name": h.name, "capacity": h.capacity, "status": "ACCESS_SEVERED" if h.id in affected_hospitals else "OPERATIONAL"}
                for h in hospitals
            ],
            "roads": [
                {"id": r.id, "name": r.name, "status": "SUBMERGED_BLOCKED" if r.id in affected_roads else "CLEAR"}
                for r in roads
            ],
        }
    }


if __name__ == "__main__":
    result = calculate_cascade(0.90)
    print("\n--- CASCADING IMPACT ANALYSIS (REAL BIHAR INFRASTRUCTURE) ---")
    print(f"Risk Score: {result['risk_score']:.2f}")
    print("Affected Roads:", result["affected_roads"])
    print("Affected Villages:", result["affected_villages"])
    print("Affected Hospitals:", result["affected_hospitals"])
    print("Population Affected:", result["population_affected"])
