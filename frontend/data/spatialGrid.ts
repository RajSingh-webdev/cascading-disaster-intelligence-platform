export type SpatialGridCell = {
  id: string;
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
  center: [number, number];
  elevation_m: number;
  slope_deg: number;
  distance_to_river_m: number;
  sar_water_fraction: number;
  risk_score: number;
  risk_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
};

export type HistoricalAllocation = {
  resource: string;
  resource_type: "AMBULANCE" | "RESCUE_BOAT";
  village_id: string;
  village_name: string;
  priority_score: number;
  priority_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  population: number;
  distance_km: number;
  estimated_travel_time_min: number;
  assignment_score: number;
  reason: string;
};

export type HistoricalSnapshot = {
  timestamp: string;
  label: string;
  rainfall_24h_mm: number;
  river_level_m: number;
  mean_risk_score: number;
  hazard_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  affected_roads: string[];
  affected_villages: string[];
  affected_hospitals: string[];
  population_affected: number;
  satellite_pass_time: string;
  status_summary: string;
  historical_allocations: HistoricalAllocation[];
};

export const REAL_INFRASTRUCTURE_METADATA = {
  villages: {
    V1: {
      name: "Pipra Dewas",
      type: "Diara Riparian Panchayat",
      population: 5420,
      vulnerability: "Low-lying riparian settlement near river embankment",
    },
    V2: {
      name: "Sultanganj Diara",
      type: "Island Settlement",
      population: 7850,
      vulnerability: "Severely flood-prone island; total road cutoff during surges",
    },
    V3: {
      name: "Manjhaul Lowlands",
      type: "Wetland Basin Panchayat",
      population: 4200,
      vulnerability: "Surrounds wetland basin; vulnerable to protracted waterlogging",
    },
    V4: {
      name: "Mohanpur West",
      type: "Riparian Wetland Panchayat",
      population: 3600,
      vulnerability: "Pond basin settlement; vulnerable to western embankment breach",
    },
    V5: {
      name: "Rampur Ghat Diara",
      type: "Riverfront Diara Settlement",
      population: 4850,
      vulnerability: "Ghat-side residential cluster near Ambulance A2 base; severed by causeway flood",
    },
  },
  hospitals: {
    H1: {
      name: "Barauni Primary Health Centre (PHC)",
      type: "Sub-Divisional PHC",
      capacity: 60,
      role: "Immediate triage and emergency medical stabilization",
    },
    H2: {
      name: "Sadar District Hospital (Begusarai)",
      type: "Main Referral Hospital",
      capacity: 180,
      role: "Critical ICU, trauma, surgical & flood referral centre",
    },
    H3: {
      name: "Sultanganj Community Health Centre (CHC)",
      type: "Rural Health Centre",
      capacity: 80,
      role: "Flood rescue staging & mobile medical camp dispatch",
    },
  },
  shelters: {
    S1: {
      name: "Rajkiya Uchh Vidyalaya Relief Camp",
      capacity: 850,
      type: "High-Ground Concrete Multi-Story School",
    },
    S2: {
      name: "Panchayat Bhawan Disaster Centre",
      capacity: 600,
      type: "Administrative Relief Distribution Hub",
    },
  },
  roads: {
    R1: {
      name: "NH-31 Flood Embankment Link",
      type: "National Highway Link",
      significance: "Connects Barauni PHC to Pipra Dewas",
    },
    R2: {
      name: "SH-58 Diara Access Corridor",
      type: "State Highway Corridor",
      significance: "Arterial route to Sultanganj Diara and Sadar Hospital",
    },
    R3: {
      name: "MDR-14 Rural Embankment Bypass",
      type: "Major District Road",
      significance: "Bypass route connecting Manjhaul Lowlands",
    },
    R4: {
      name: "Pond Embankment Rural Link",
      type: "Rural Connectivity Link",
      significance: "Connects Mohanpur West settlement to Relief Camp S1",
    },
    R5: {
      name: "Sultanganj Ghat Causeway",
      type: "Riverfront Embankment Link",
      significance: "Connects Rampur Ghat Diara to Ambulance A2 Base and CHC Sultanganj",
    },
  },
  ambulances: {
    A1: { name: "ALS Ambulance A1 (Barauni Base)", type: "Advanced Life Support" },
    A2: { name: "ALS Ambulance A2 (Sultanganj CHC Base)", type: "Advanced Life Support" },
    A3: { name: "BLS Ambulance A3 (Sadar Hospital Base)", type: "Basic Life Support" },
  },
};

// Generates a 2D spatial raster grid of risk across the study bounding box
export function generateSpatialGrid(
  baseRainfall: number,
  waterLevelMultiplier: number = 1.0
): SpatialGridCell[] {
  const minLat = 25.130;
  const maxLat = 25.166;
  const minLon = 85.932;
  const maxLon = 85.968;

  const latSteps = 8;
  const lonSteps = 8;
  const latDelta = (maxLat - minLat) / latSteps;
  const lonDelta = (maxLon - minLon) / lonSteps;

  const riverCenterLat = 25.158;
  const riverCenterLon = 85.952;

  const cells: SpatialGridCell[] = [];

  for (let i = 0; i < latSteps; i++) {
    for (let j = 0; j < lonSteps; j++) {
      const south = minLat + i * latDelta;
      const north = south + latDelta;
      const west = minLon + j * lonDelta;
      const east = west + lonDelta;

      const centerLat = (south + north) / 2;
      const centerLon = (west + east) / 2;

      // Distance to river calculation (approximate in meters)
      const distLat = (centerLat - riverCenterLat) * 111000;
      const distLon = (centerLon - riverCenterLon) * 111000 * Math.cos((centerLat * Math.PI) / 180);
      const distanceToRiver = Math.max(80, Math.sqrt(distLat * distLat + distLon * distLon));

      // Elevation gradient: lower near river (approx 38m to 65m)
      const elevation = Math.round(38 + Math.min(27, distanceToRiver / 120));
      const slope = Number((0.2 + (distanceToRiver / 3000) * 1.5).toFixed(2));

      // Physical risk calculation based on rainfall, river proximity and elevation
      const rainFactor = Math.min(baseRainfall / 180, 1.0);
      const proxFactor = Math.max(0, 1.0 - distanceToRiver / 2500);
      const elevFactor = Math.max(0, 1.0 - (elevation - 38) / 27);

      const rawRisk =
        (0.45 * rainFactor + 0.35 * proxFactor + 0.20 * elevFactor) * waterLevelMultiplier;

      const riskScore = Number(Math.min(0.98, Math.max(0.05, rawRisk)).toFixed(2));

      // SAR water fraction proxy
      const sarWaterFraction = Number(Math.min(0.95, Math.max(0.02, riskScore * 0.92)).toFixed(2));

      let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
      if (riskScore >= 0.75) riskLevel = "CRITICAL";
      else if (riskScore >= 0.5) riskLevel = "HIGH";
      else if (riskScore >= 0.3) riskLevel = "MODERATE";

      cells.push({
        id: `grid_${i}_${j}`,
        bounds: [
          [south, west],
          [north, east],
        ],
        center: [centerLat, centerLon],
        elevation_m: elevation,
        slope_deg: slope,
        distance_to_river_m: Math.round(distanceToRiver),
        sar_water_fraction: sarWaterFraction,
        risk_score: riskScore,
        risk_level: riskLevel,
      });
    }
  }

  return cells;
}

// Historical validation sequence for the 27 Sep 2024 Bihar flood event
export const HISTORICAL_2024_EVENT: HistoricalSnapshot[] = [
  {
    timestamp: "2024-09-25T06:00:00Z",
    label: "T-48h (Pre-Event Baseline)",
    rainfall_24h_mm: 14.2,
    river_level_m: 2.1,
    mean_risk_score: 0.16,
    hazard_level: "LOW",
    affected_roads: [],
    affected_villages: [],
    affected_hospitals: [],
    population_affected: 0,
    satellite_pass_time: "Sentinel-1A Orbit 2341 (05:42 UTC)",
    status_summary: "Normal seasonal flow. NH-31 and SH-58 open. Background SAR backscatter.",
    historical_allocations: [],
  },
  {
    timestamp: "2024-09-26T14:00:00Z",
    label: "T-24h (Monsoon Inflow Surge)",
    rainfall_24h_mm: 78.5,
    river_level_m: 5.4,
    mean_risk_score: 0.52,
    hazard_level: "HIGH",
    affected_roads: ["R1"],
    affected_villages: ["V1"],
    affected_hospitals: ["H1"],
    population_affected: 5420,
    satellite_pass_time: "GPM IMERG Early Run (12:30 UTC)",
    status_summary: "Precipitation surge detected. NH-31 embankment submerged; Pipra Dewas (5,420 pop) isolated.",
    historical_allocations: [
      {
        resource: "A1",
        resource_type: "AMBULANCE",
        village_id: "V1",
        village_name: "Pipra Dewas",
        priority_score: 0.71,
        priority_level: "HIGH",
        population: 5420,
        distance_km: 0.8,
        estimated_travel_time_min: 12,
        assignment_score: 0.74,
        reason: "Pipra Dewas isolated by NH-31 submergence. A1 (Barauni Base) dispatched via embankment bypass for medical triage.",
      },
    ],
  },
  {
    timestamp: "2024-09-27T18:00:00Z",
    label: "T-0 (Peak Flood Inundation)",
    rainfall_24h_mm: 184.0,
    river_level_m: 8.6,
    mean_risk_score: 0.89,
    hazard_level: "CRITICAL",
    affected_roads: ["R1", "R2", "R3", "R4", "R5"],
    affected_villages: ["V1", "V2", "V3", "V4", "V5"],
    affected_hospitals: ["H1", "H2"],
    population_affected: 25920,
    satellite_pass_time: "NRSC Sentinel-1A SAR Inundation Map (17:15 UTC)",
    status_summary: "Catastrophic river surge. All arterial roads & causeways severed. Sultanganj, Pipra Dewas, Mohanpur & Rampur cut off.",
    historical_allocations: [
      {
        resource: "A1",
        resource_type: "AMBULANCE",
        village_id: "V1",
        village_name: "Pipra Dewas",
        priority_score: 0.91,
        priority_level: "CRITICAL",
        population: 5420,
        distance_km: 0.8,
        estimated_travel_time_min: 18,
        assignment_score: 0.88,
        reason: "CRITICAL: Pipra Dewas completely inundated. A1 (Barauni ALS) primary medical evacuation — NH-31 submerged, boat access only.",
      },
      {
        resource: "A2",
        resource_type: "RESCUE_BOAT",
        village_id: "V2",
        village_name: "Sultanganj Diara",
        priority_score: 0.95,
        priority_level: "CRITICAL",
        population: 7850,
        distance_km: 2.1,
        estimated_travel_time_min: 35,
        assignment_score: 0.92,
        reason: "CRITICAL: Sultanganj Diara island fully surrounded. Rescue boat A2 (Sultanganj CHC) deployed for mass evacuation of 7,850 residents.",
      },
      {
        resource: "A3",
        resource_type: "RESCUE_BOAT",
        village_id: "V3",
        village_name: "Manjhaul Lowlands",
        priority_score: 0.78,
        priority_level: "HIGH",
        population: 4200,
        distance_km: 1.4,
        estimated_travel_time_min: 22,
        assignment_score: 0.80,
        reason: "HIGH: Manjhaul Lowlands waterlogged. A3 (Sadar Base BLS) dispatched for medical supply delivery and patient extraction via MDR-14.",
      },
      {
        resource: "SDRF-1",
        resource_type: "RESCUE_BOAT",
        village_id: "V4",
        village_name: "Mohanpur West",
        priority_score: 0.86,
        priority_level: "CRITICAL",
        population: 3600,
        distance_km: 0.9,
        estimated_travel_time_min: 15,
        assignment_score: 0.87,
        reason: "CRITICAL: Mohanpur West pond embankment breached. SDRF boat dispatched to evacuate 3,600 residents to Relief Camp S1.",
      },
      {
        resource: "NDRF-2",
        resource_type: "RESCUE_BOAT",
        village_id: "V5",
        village_name: "Rampur Ghat Diara",
        priority_score: 0.89,
        priority_level: "CRITICAL",
        population: 4850,
        distance_km: 0.4,
        estimated_travel_time_min: 10,
        assignment_score: 0.90,
        reason: "CRITICAL: Rampur Ghat Diara causeway overtopped. NDRF flood rescue craft dispatched from A2 Base for immediate triage.",
      },
    ],
  },
  {
    timestamp: "2024-09-28T12:00:00Z",
    label: "T+24h (Water Recession & Recovery)",
    rainfall_24h_mm: 32.0,
    river_level_m: 6.1,
    mean_risk_score: 0.62,
    hazard_level: "HIGH",
    affected_roads: ["R1", "R2"],
    affected_villages: ["V1", "V2"],
    affected_hospitals: ["H1"],
    population_affected: 13270,
    satellite_pass_time: "Sentinel-2 MSI Optical Cloud-Free Composite",
    status_summary: "Floodwaters gradually receding. MDR-14 reopened to Manjhaul. Relief staging active at Rajkiya Uchh Vidyalaya.",
    historical_allocations: [
      {
        resource: "A1",
        resource_type: "AMBULANCE",
        village_id: "V1",
        village_name: "Pipra Dewas",
        priority_score: 0.74,
        priority_level: "HIGH",
        population: 5420,
        distance_km: 0.8,
        estimated_travel_time_min: 14,
        assignment_score: 0.77,
        reason: "HIGH: Pipra Dewas still partially inundated. A1 continuing medical evacuation and injury triage.",
      },
      {
        resource: "A2",
        resource_type: "RESCUE_BOAT",
        village_id: "V2",
        village_name: "Sultanganj Diara",
        priority_score: 0.81,
        priority_level: "HIGH",
        population: 7850,
        distance_km: 2.1,
        estimated_travel_time_min: 28,
        assignment_score: 0.83,
        reason: "HIGH: Sultanganj Diara island partially accessible. A2 rescue boat deployed for final evacuation and relief supply staging.",
      },
    ],
  },
];
