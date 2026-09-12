from math import radians, sin, cos, sqrt, atan2

from cascade_engine import calculate_cascade, villages
from priority_engine import calculate_priorities


VILLAGE_NAMES = {
    "V1": "Pipra Dewas",
    "V2": "Sultanganj Diara",
    "V3": "Manjhaul Lowlands",
    "V4": "Mohanpur West",
    "V5": "Rampur Ghat Diara",
}

RESOURCE_LOCATIONS = {
    "A1": (25.1420, 85.9410),  # Barauni Staging Base
    "A2": (25.1470, 85.9610),  # Sultanganj CHC Base
    "A3": (25.1355, 85.9495),  # Sadar Hospital Base
    "R1": (25.1440, 85.9430),  # SDRF Flood Rescue Team 1
    "R2": (25.1510, 85.9580),  # NDRF Flood Rescue Team 2
}

VILLAGE_LOCATIONS = {
    "V1": (25.1480, 85.9428),  # Pipra Dewas
    "V2": (25.1595, 85.9572),  # Sultanganj Diara
    "V3": (25.1370, 85.9515),  # Manjhaul Lowlands
    "V4": (25.1495, 85.9395),  # Mohanpur West
    "V5": (25.1480, 85.9580),  # Rampur Ghat Diara (Dense Town Settlement West of A2)
}

AMBULANCES = ["A1", "A2", "A3"]
RESCUE_TEAMS = ["R1", "R2"]

AVERAGE_AMBULANCE_SPEED_KMPH = 40.0
AVERAGE_RESCUE_SPEED_KMPH = 30.0
ROAD_DETOUR_FACTOR = 1.5


def calculate_distance_km(
    point1: tuple[float, float],
    point2: tuple[float, float],
) -> float:
    lat1, lon1 = point1
    lat2, lon2 = point2

    earth_radius_km = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earth_radius_km * c


def estimate_travel_time(
    distance_km: float,
    average_speed_kmph: float,
    road_impact: bool,
) -> float:
    if average_speed_kmph <= 0:
        raise ValueError("Average speed must be greater than zero.")

    adjusted_distance = distance_km
    if road_impact:
        adjusted_distance *= ROAD_DETOUR_FACTOR

    return (adjusted_distance / average_speed_kmph) * 60.0


def calculate_assignment_cost(
    resource_id: str,
    village: dict,
    average_speed_kmph: float,
) -> dict:
    village_id = village["village_id"]

    if resource_id not in RESOURCE_LOCATIONS:
        raise ValueError(f"Location missing for resource '{resource_id}'.")

    if village_id not in VILLAGE_LOCATIONS:
        raise ValueError(f"Location missing for village '{village_id}'.")

    distance_km = calculate_distance_km(
        RESOURCE_LOCATIONS[resource_id],
        VILLAGE_LOCATIONS[village_id],
    )

    travel_time_min = estimate_travel_time(
        distance_km=distance_km,
        average_speed_kmph=average_speed_kmph,
        road_impact=village["road_impact"],
    )

    priority_component = village["priority_score"] * 100
    time_penalty = travel_time_min * 0.5
    assignment_score = priority_component - time_penalty

    return {
        "resource": resource_id,
        "village_id": village_id,
        "village_name": VILLAGE_NAMES.get(village_id, village_id),
        "distance_km": round(distance_km, 2),
        "travel_time_min": round(travel_time_min, 2),
        "assignment_score": round(assignment_score, 2),
    }


def allocate_resources(
    priorities: list[dict],
    resources: list[str],
    average_speed_kmph: float,
) -> list[dict]:
    if not priorities or not resources:
        return []

    remaining_villages = {
        village["village_id"]: village for village in priorities
    }

    allocations = []

    for resource_id in resources:
        if not remaining_villages:
            break

        candidates = [
            calculate_assignment_cost(
                resource_id=resource_id,
                village=village,
                average_speed_kmph=average_speed_kmph,
            )
            for village in remaining_villages.values()
        ]

        candidates.sort(
            key=lambda item: item["assignment_score"],
            reverse=True,
        )

        best = candidates[0]
        village = remaining_villages.pop(best["village_id"])
        village_name = VILLAGE_NAMES.get(best["village_id"], best["village_id"])

        resource_type = (
            "AMBULANCE"
            if resource_id.startswith("A")
            else "RESCUE_BOAT"
        )

        allocations.append({
            "resource": best["resource"],
            "resource_type": resource_type,
            "village_id": best["village_id"],
            "village_name": village_name,
            "priority_score": village["priority_score"],
            "priority_level": village["priority_level"],
            "population": village["population"],
            "distance_km": best["distance_km"],
            "estimated_travel_time_min": best["travel_time_min"],
            "assignment_score": best["assignment_score"],
            "reason": (
                f"{village['priority_level']} priority at {village_name}, "
                f"{village['population']:,} people exposed, "
                f"estimated travel time: {best['travel_time_min']} min"
            ),
        })

    return allocations


def optimize_resources(priorities: list[dict]) -> dict:
    ambulance_allocations = allocate_resources(
        priorities=priorities,
        resources=AMBULANCES,
        average_speed_kmph=AVERAGE_AMBULANCE_SPEED_KMPH,
    )

    rescue_allocations = allocate_resources(
        priorities=priorities,
        resources=RESCUE_TEAMS,
        average_speed_kmph=AVERAGE_RESCUE_SPEED_KMPH,
    )

    ambulance_covered = {
        allocation["village_id"]
        for allocation in ambulance_allocations
    }

    rescue_covered = {
        allocation["village_id"]
        for allocation in rescue_allocations
    }

    all_villages = {
        village["village_id"]: village for village in priorities
    }

    ambulance_unserved = [
        f"{vid} ({VILLAGE_NAMES.get(vid, vid)})"
        for vid in sorted(set(all_villages.keys()) - ambulance_covered)
    ]
    rescue_unserved = [
        f"{vid} ({VILLAGE_NAMES.get(vid, vid)})"
        for vid in sorted(set(all_villages.keys()) - rescue_covered)
    ]

    allocations = ambulance_allocations + rescue_allocations

    return {
        "status": "OPTIMIZED",
        "allocations": allocations,
        "ambulance_coverage": {
            "served_villages": [f"{vid} ({VILLAGE_NAMES.get(vid, vid)})" for vid in sorted(ambulance_covered)],
            "unserved_villages": ambulance_unserved,
            "total_resources": len(AMBULANCES),
            "resources_used": len(ambulance_allocations),
        },
        "rescue_team_coverage": {
            "served_villages": [f"{vid} ({VILLAGE_NAMES.get(vid, vid)})" for vid in sorted(rescue_covered)],
            "unserved_villages": rescue_unserved,
            "total_resources": len(RESCUE_TEAMS),
            "resources_used": len(rescue_allocations),
        },
    }


if __name__ == "__main__":
    cascade_result = calculate_cascade(0.90)
    priorities = calculate_priorities(cascade_result)
    result = optimize_resources(priorities)

    print("\n========== REAL BIHAR RESOURCE OPTIMIZATION ==========")
    for allocation in result["allocations"]:
        print(
            f"{allocation['resource']} ({allocation['resource_type']}) -> "
            f"{allocation['village_name']} ({allocation['village_id']}) | "
            f"Distance: {allocation['distance_km']} km | "
            f"ETA: {allocation['estimated_travel_time_min']} min"
        )
