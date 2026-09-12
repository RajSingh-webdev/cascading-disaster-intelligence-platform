"use client";

import { useState } from "react";
import {
    MapContainer,
    TileLayer,
    Circle,
    CircleMarker,
    Polyline,
    Rectangle,
    Popup,
    Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { SpatialGridCell, REAL_INFRASTRUCTURE_METADATA } from "../data/spatialGrid";

type Allocation = {
    resource: string;
    resource_type: string;
    village_id: string;
    village_name?: string;
    priority_score: number;
    priority_level: string;
    population: number;
    distance_km: number;
    estimated_travel_time_min: number;
    assignment_score: number;
    reason: string;
};

type Props = {
    floodActive: boolean;
    allocation: Allocation[];
    affectedVillages: string[];
    affectedRoads: string[];
    affectedHospitals: string[];
    spatialGrid?: SpatialGridCell[];
    showSpatialGrid?: boolean;
};

const BASEMAPS = {
    satellite: {
        name: "🛰️ Real Satellite",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "&copy; Esri, Maxar, Earthstar Geographics, CNES/Airbus DS, USGS, and the GIS User Community",
    },
    dark: {
        name: "🌑 Tactical Dark",
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    },
    osm: {
        name: "🗺️ Street Map",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: "&copy; OpenStreetMap contributors",
    },
};

const villages = {
    V1: [25.1480, 85.9428] as [number, number], // Pipra Dewas (Dense Linear Settlement Cluster)
    V2: [25.1595, 85.9572] as [number, number], // Sultanganj Diara (Dense Village Settlement North-East)
    V3: [25.1370, 85.9515] as [number, number], // Manjhaul Lowlands (Central Town Settlement)
    V4: [25.1495, 85.9395] as [number, number], // Mohanpur West (Pond Riparian Settlement)
    V5: [25.1480, 85.9580] as [number, number], // Rampur Ghat Diara (Dense Settlement West of A2)
};

const hospitals = {
    H1: [25.1498, 85.9438] as [number, number], // Barauni PHC
    H2: [25.1610, 85.9580] as [number, number], // Sadar District Hospital
    H3: [25.1395, 85.9542] as [number, number], // CHC Sultanganj
};

const shelters = {
    S1: [25.1520, 85.9410] as [number, number],
    S2: [25.1385, 85.9530] as [number, number],
};

const ambulances = {
    A1: [25.1420, 85.9410] as [number, number],
    A2: [25.1470, 85.9610] as [number, number],
    A3: [25.1355, 85.9495] as [number, number],
};

const roads = {
    R1: [
        [25.1420, 85.9410], // Ambulance A1 (Barauni Base)
        [25.1450, 85.9420], // Approach Corridor
        [25.1480, 85.9428], // Village V1 (Pipra Dewas Settlement)
        [25.1498, 85.9438], // Hospital H1 (Barauni PHC)
        [25.1520, 85.9410], // Shelter S1 (Rajkiya Uchh Vidyalaya)
    ] as [number, number][],

    R2: [
        [25.1520, 85.9410], // Shelter S1 Junction
        [25.1540, 85.9480], // SH-58 Embankment Corridor
        [25.1570, 85.9530], // Approach to Diara
        [25.1595, 85.9572], // Village V2 (Sultanganj Diara Settlement)
        [25.1610, 85.9580], // Hospital H2 (Sadar District Hospital)
        [25.1540, 85.9600], // River Causeway Link
        [25.1470, 85.9610], // Ambulance A2 (Sultanganj Base)
    ] as [number, number][],

    R3: [
        [25.1355, 85.9495], // Ambulance A3 (Sadar Base)
        [25.1370, 85.9515], // Village V3 (Manjhaul Lowlands Settlement)
        [25.1385, 85.9530], // Shelter S2 (Panchayat Bhawan Disaster Centre)
        [25.1395, 85.9542], // Hospital H3 (CHC Sultanganj)
        [25.1435, 85.9580], // MDR-14 Embankment Bypass
        [25.1470, 85.9610], // Ambulance A2 Base Junction
    ] as [number, number][],

    R4: [
        [25.1420, 85.9410], // Ambulance A1 (Barauni Base)
        [25.1460, 85.9400], // Western Pond Corridor
        [25.1495, 85.9395], // Village V4 (Mohanpur West Settlement)
        [25.1520, 85.9410], // Shelter S1 (Rajkiya Uchh Vidyalaya)
    ] as [number, number][],

    R5: [
        [25.1470, 85.9610], // Ambulance A2 (Sultanganj Base)
        [25.1480, 85.9580], // Village V5 (Rampur Ghat Diara Settlement)
        [25.1440, 85.9560], // Riverbank Causeway Access
        [25.1395, 85.9542], // Hospital H3 (CHC Sultanganj)
    ] as [number, number][],
};

function getGridColor(score: number): { fill: string; stroke: string; opacity: number } {
    if (score >= 0.75) {
        return { fill: "#dc2626", stroke: "#ef4444", opacity: 0.50 };
    }
    if (score >= 0.50) {
        return { fill: "#ea580c", stroke: "#f97316", opacity: 0.40 };
    }
    if (score >= 0.30) {
        return { fill: "#ca8a04", stroke: "#eab308", opacity: 0.30 };
    }
    return { fill: "#059669", stroke: "#10b981", opacity: 0.20 };
}

export default function DisasterMap({
    floodActive,
    allocation,
    affectedVillages,
    affectedRoads,
    affectedHospitals,
    spatialGrid = [],
    showSpatialGrid = true,
}: Props) {
    const [basemapKey, setBasemapKey] = useState<keyof typeof BASEMAPS>("satellite");

    const isVillageAffected = (id: string) => affectedVillages.includes(id);
    const isRoadAffected = (id: string) => affectedRoads.includes(id);
    const isHospitalAffected = (id: string) => affectedHospitals.includes(id);

    const resourceRoutes = floodActive
        ? allocation
            .filter((item) => item.resource_type === "AMBULANCE" || item.resource_type === "RESCUE_BOAT")
            .map((item) => ({
                resource: item.resource,
                from: ambulances[item.resource as keyof typeof ambulances],
                to: villages[item.village_id as keyof typeof villages],
                priority: item.priority_level,
                score: item.priority_score,
                reason: item.reason,
            }))
            .filter((route) => route.from && route.to)
        : [];

    const activeBasemap = BASEMAPS[basemapKey];

    return (
        <div className="relative h-full w-full">
            {/* BASEMAP LAYER SWITCHER */}
            <div className="absolute top-3 right-3 z-[1000] flex gap-1 rounded-xl border border-slate-700/80 bg-slate-950/85 p-1 backdrop-blur shadow-xl">
                {(Object.keys(BASEMAPS) as Array<keyof typeof BASEMAPS>).map((key) => (
                    <button
                        key={key}
                        onClick={() => setBasemapKey(key)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${basemapKey === key
                            ? "bg-blue-600 text-white shadow"
                            : "text-slate-400 hover:text-white"
                            }`}
                    >
                        {BASEMAPS[key].name}
                    </button>
                ))}
            </div>

            <MapContainer
                center={[25.148, 85.950]}
                zoom={14}
                scrollWheelZoom
                className="h-full w-full rounded-xl z-0"
            >
                <TileLayer
                    key={basemapKey}
                    attribution={activeBasemap.attribution}
                    url={activeBasemap.url}
                />

                {/* 2D SPATIAL RISK RASTER GRID */}
                {showSpatialGrid &&
                    spatialGrid.map((cell) => {
                        const style = getGridColor(cell.risk_score);
                        return (
                            <Rectangle
                                key={cell.id}
                                bounds={cell.bounds}
                                pathOptions={{
                                    fillColor: style.fill,
                                    fillOpacity: style.opacity,
                                    color: style.stroke,
                                    weight: 1.5,
                                }}
                            >
                                <Popup>
                                    <div className="text-xs space-y-1.5 p-1 text-slate-100">
                                        <p className="font-extrabold text-white border-b border-slate-700/80 pb-1 flex items-center justify-between">
                                            <span>Cell: {cell.id}</span>
                                            <span className="font-mono text-[10px] text-slate-400">SAR 10m Raster</span>
                                        </p>
                                        <p className="text-slate-200">
                                            Risk Status: <span className={`font-bold ${cell.risk_level === "CRITICAL" ? "text-rose-400" : cell.risk_level === "HIGH" ? "text-amber-400" : "text-emerald-400"}`}>{cell.risk_level} ({cell.risk_score})</span>
                                        </p>
                                        <p className="text-slate-300">
                                            SAR Inundation: <span className="font-semibold text-white">{(cell.sar_water_fraction * 100).toFixed(0)}%</span>
                                        </p>
                                        <p className="text-slate-300">
                                            Elevation: <span className="font-semibold text-white">{cell.elevation_m}m</span> | Slope: <span className="font-semibold text-white">{cell.slope_deg}°</span>
                                        </p>
                                        <p className="text-slate-300">
                                            Distance to River: <span className="font-semibold text-white">{cell.distance_to_river_m}m</span>
                                        </p>
                                    </div>
                                </Popup>
                            </Rectangle>
                        );
                    })}

                {/* REAL ROADS & HIGHWAYS */}
                <Polyline
                    positions={roads.R1}
                    pathOptions={{
                        color: isRoadAffected("R1") ? "#ef4444" : "#10b981",
                        weight: isRoadAffected("R1") ? 6 : 3.5,
                        opacity: isRoadAffected("R1") ? 0.95 : 0.75,
                        dashArray: isRoadAffected("R1") ? "8 8" : undefined,
                    }}
                >
                    <Tooltip sticky direction="top">
                        {REAL_INFRASTRUCTURE_METADATA.roads.R1.name} {isRoadAffected("R1") ? "⚠️ SUBMERGED" : "✅ OPEN"}
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-white text-sm">{REAL_INFRASTRUCTURE_METADATA.roads.R1.name} (R1)</strong>
                            <br />
                            <span className="text-slate-400 text-[11px] block mt-0.5">{REAL_INFRASTRUCTURE_METADATA.roads.R1.significance}</span>
                            <div className="mt-1.5 pt-1 border-t border-slate-700/80">
                                Status:{" "}
                                <span className={isRoadAffected("R1") ? "font-black text-rose-400" : "font-bold text-emerald-400"}>
                                    {isRoadAffected("R1") ? "SUBMERGED & SEVERED" : "OPEN / CLEAR"}
                                </span>
                            </div>
                        </div>
                    </Popup>
                </Polyline>

                <Polyline
                    positions={roads.R2}
                    pathOptions={{
                        color: isRoadAffected("R2") ? "#ef4444" : "#10b981",
                        weight: isRoadAffected("R2") ? 6 : 3.5,
                        opacity: isRoadAffected("R2") ? 0.95 : 0.75,
                        dashArray: isRoadAffected("R2") ? "8 8" : undefined,
                    }}
                >
                    <Tooltip sticky direction="top">
                        {REAL_INFRASTRUCTURE_METADATA.roads.R2.name} {isRoadAffected("R2") ? "⚠️ SUBMERGED" : "✅ OPEN"}
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-white text-sm">{REAL_INFRASTRUCTURE_METADATA.roads.R2.name} (R2)</strong>
                            <br />
                            <span className="text-slate-400 text-[11px] block mt-0.5">{REAL_INFRASTRUCTURE_METADATA.roads.R2.significance}</span>
                            <div className="mt-1.5 pt-1 border-t border-slate-700/80">
                                Status:{" "}
                                <span className={isRoadAffected("R2") ? "font-black text-rose-400" : "font-bold text-emerald-400"}>
                                    {isRoadAffected("R2") ? "SUBMERGED & SEVERED" : "OPEN / CLEAR"}
                                </span>
                            </div>
                        </div>
                    </Popup>
                </Polyline>

                <Polyline
                    positions={roads.R3}
                    pathOptions={{
                        color: isRoadAffected("R3") ? "#ef4444" : "#10b981",
                        weight: isRoadAffected("R3") ? 6 : 3.5,
                        opacity: isRoadAffected("R3") ? 0.95 : 0.75,
                        dashArray: isRoadAffected("R3") ? "8 8" : undefined,
                    }}
                >
                    <Tooltip sticky direction="top">
                        {REAL_INFRASTRUCTURE_METADATA.roads.R3.name} {isRoadAffected("R3") ? "⚠️ SUBMERGED" : "✅ OPEN"}
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-white text-sm">{REAL_INFRASTRUCTURE_METADATA.roads.R3.name} (R3)</strong>
                            <br />
                            <span className="text-slate-400 text-[11px] block mt-0.5">{REAL_INFRASTRUCTURE_METADATA.roads.R3.significance}</span>
                            <div className="mt-1.5 pt-1 border-t border-slate-700/80">
                                Status:{" "}
                                <span className={isRoadAffected("R3") ? "font-black text-rose-400" : "font-bold text-emerald-400"}>
                                    {isRoadAffected("R3") ? "SUBMERGED & SEVERED" : "OPEN / CLEAR"}
                                </span>
                            </div>
                        </div>
                    </Popup>
                </Polyline>

                <Polyline
                    positions={roads.R4}
                    pathOptions={{
                        color: isRoadAffected("R4") ? "#ef4444" : "#10b981",
                        weight: isRoadAffected("R4") ? 6 : 3.5,
                        opacity: isRoadAffected("R4") ? 0.95 : 0.75,
                        dashArray: isRoadAffected("R4") ? "8 8" : undefined,
                    }}
                >
                    <Tooltip sticky direction="top">
                        {REAL_INFRASTRUCTURE_METADATA.roads.R4.name} {isRoadAffected("R4") ? "⚠️ SUBMERGED" : "✅ OPEN"}
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-white text-sm">{REAL_INFRASTRUCTURE_METADATA.roads.R4.name} (R4)</strong>
                            <br />
                            <span className="text-slate-400 text-[11px] block mt-0.5">{REAL_INFRASTRUCTURE_METADATA.roads.R4.significance}</span>
                            <div className="mt-1.5 pt-1 border-t border-slate-700/80">
                                Status:{" "}
                                <span className={isRoadAffected("R4") ? "font-black text-rose-400" : "font-bold text-emerald-400"}>
                                    {isRoadAffected("R4") ? "SUBMERGED & SEVERED" : "OPEN / CLEAR"}
                                </span>
                            </div>
                        </div>
                    </Popup>
                </Polyline>

                <Polyline
                    positions={roads.R5}
                    pathOptions={{
                        color: isRoadAffected("R5") ? "#ef4444" : "#10b981",
                        weight: isRoadAffected("R5") ? 6 : 3.5,
                        opacity: isRoadAffected("R5") ? 0.95 : 0.75,
                        dashArray: isRoadAffected("R5") ? "8 8" : undefined,
                    }}
                >
                    <Tooltip sticky direction="top">
                        {REAL_INFRASTRUCTURE_METADATA.roads.R5.name} {isRoadAffected("R5") ? "⚠️ SUBMERGED" : "✅ OPEN"}
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-white text-sm">{REAL_INFRASTRUCTURE_METADATA.roads.R5.name} (R5)</strong>
                            <br />
                            <span className="text-slate-400 text-[11px] block mt-0.5">{REAL_INFRASTRUCTURE_METADATA.roads.R5.significance}</span>
                            <div className="mt-1.5 pt-1 border-t border-slate-700/80">
                                Status:{" "}
                                <span className={isRoadAffected("R5") ? "font-black text-rose-400" : "font-bold text-emerald-400"}>
                                    {isRoadAffected("R5") ? "SUBMERGED & SEVERED" : "OPEN / CLEAR"}
                                </span>
                            </div>
                        </div>
                    </Popup>
                </Polyline>

                {/* RESOURCE DEPLOYMENT ROUTES */}
                {resourceRoutes.map((route) => (
                    <Polyline
                        key={route.resource}
                        positions={[route.from, route.to]}
                        pathOptions={{
                            color: "#fbbf24",
                            weight: 5,
                            opacity: 0.95,
                            dashArray: "8 8",
                        }}
                    >
                        <Popup>
                            <div className="text-xs p-1 text-slate-100">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1">
                                    <strong className="text-amber-300">🚑 {route.resource} Dispatch</strong>
                                    <span className="font-extrabold text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                                        {route.priority} (Score: {route.score.toFixed(2)})
                                    </span>
                                </div>
                                <p className="text-slate-300 mt-1.5 text-[11px] leading-relaxed">
                                    {route.reason}
                                </p>
                            </div>
                        </Popup>
                    </Polyline>
                ))}

                {/* DYNAMIC FLOOD INUNDATION RADIUS (RENDERED UNDER POIS, NON-INTERACTIVE SO CLICKS PASS THROUGH) */}
                {(Object.keys(villages) as Array<keyof typeof villages>).map((villageId) => {
                    const center = villages[villageId];
                    const isAffected = isVillageAffected(villageId) && floodActive;
                    if (!isAffected) return null;

                    return (
                        <Circle
                            key={`flood_zone_${villageId}`}
                            center={center}
                            radius={villageId === "V2" ? 380 : villageId === "V3" ? 320 : 300}
                            pathOptions={{
                                color: "#ef4444",
                                fillColor: "#dc2626",
                                fillOpacity: 0.32,
                                weight: 2.5,
                                dashArray: "5 5",
                                interactive: false, // Prevents intercepting clicks to hospitals/villages underneath
                            }}
                        />
                    );
                })}

                {/* REAL RELIEF SHELTERS */}
                {(() => {
                    const s1Total = REAL_INFRASTRUCTURE_METADATA.shelters.S1.capacity;
                    const s1Occupied = floodActive ? (affectedVillages.length >= 3 ? 765 : affectedVillages.length >= 1 ? 510 : 220) : 15;
                    const s1Pct = Math.round((s1Occupied / s1Total) * 100);

                    const s2Total = REAL_INFRASTRUCTURE_METADATA.shelters.S2.capacity;
                    const s2Occupied = floodActive ? (affectedVillages.length >= 3 ? 520 : affectedVillages.length >= 1 ? 330 : 140) : 10;
                    const s2Pct = Math.round((s2Occupied / s2Total) * 100);

                    return (
                        <>
                            <CircleMarker
                                center={shelters.S1}
                                radius={10}
                                pathOptions={{
                                    color: s1Pct >= 85 ? "#f43f5e" : "#c084fc",
                                    fillColor: s1Pct >= 85 ? "#e11d48" : "#9333ea",
                                    fillOpacity: 0.95,
                                    weight: 2.5,
                                }}
                            >
                                <Tooltip permanent direction="top">
                                    Relief Camp S1 ({s1Pct}%)
                                </Tooltip>
                                <Popup>
                                    <div className="text-xs p-1 text-slate-100 min-w-[210px]">
                                        <strong className="text-purple-300 text-sm">🏕️ {REAL_INFRASTRUCTURE_METADATA.shelters.S1.name}</strong>
                                        <br />
                                        <span className="text-slate-400 text-[11px] block mt-0.5">{REAL_INFRASTRUCTURE_METADATA.shelters.S1.type}</span>
                                        
                                        <div className="mt-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-400">Intake Occupancy:</span>
                                                <span className={`font-black ${s1Pct >= 85 ? "text-rose-400" : s1Pct >= 50 ? "text-amber-400" : "text-emerald-400"}`}>
                                                    {s1Occupied} / {s1Total} ({s1Pct}%)
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 rounded-full ${s1Pct >= 85 ? "bg-rose-500" : s1Pct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                    style={{ width: `${s1Pct}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                                                <span>Remaining: <strong className="text-white">{s1Total - s1Occupied} beds</strong></span>
                                                <span className={`font-bold ${s1Pct >= 85 ? "text-rose-400" : "text-emerald-400"}`}>
                                                    {s1Pct >= 85 ? "⚠️ NEAR CAPACITY" : "AVAILABLE"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>

                            <CircleMarker
                                center={shelters.S2}
                                radius={10}
                                pathOptions={{
                                    color: s2Pct >= 85 ? "#f43f5e" : "#c084fc",
                                    fillColor: s2Pct >= 85 ? "#e11d48" : "#9333ea",
                                    fillOpacity: 0.95,
                                    weight: 2.5,
                                }}
                            >
                                <Tooltip permanent direction="top">
                                    Disaster Centre S2 ({s2Pct}%)
                                </Tooltip>
                                <Popup>
                                    <div className="text-xs p-1 text-slate-100 min-w-[210px]">
                                        <strong className="text-purple-300 text-sm">🏕️ {REAL_INFRASTRUCTURE_METADATA.shelters.S2.name}</strong>
                                        <br />
                                        <span className="text-slate-400 text-[11px] block mt-0.5">{REAL_INFRASTRUCTURE_METADATA.shelters.S2.type}</span>
                                        
                                        <div className="mt-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-slate-400">Intake Occupancy:</span>
                                                <span className={`font-black ${s2Pct >= 85 ? "text-rose-400" : s2Pct >= 50 ? "text-amber-400" : "text-emerald-400"}`}>
                                                    {s2Occupied} / {s2Total} ({s2Pct}%)
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 rounded-full ${s2Pct >= 85 ? "bg-rose-500" : s2Pct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                    style={{ width: `${s2Pct}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                                                <span>Remaining: <strong className="text-white">{s2Total - s2Occupied} beds</strong></span>
                                                <span className={`font-bold ${s2Pct >= 85 ? "text-rose-400" : "text-emerald-400"}`}>
                                                    {s2Pct >= 85 ? "⚠️ NEAR CAPACITY" : "AVAILABLE"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        </>
                    );
                })()}

                {/* AMBULANCES / RESCUE BASES */}
                <CircleMarker
                    center={ambulances.A1}
                    radius={8}
                    pathOptions={{
                        color: "#f59e0b",
                        fillColor: "#fbbf24",
                        fillOpacity: 1,
                        weight: 2,
                    }}
                >
                    <Tooltip permanent direction="bottom">
                        Ambulance A1
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-amber-300 text-sm">🚑 {REAL_INFRASTRUCTURE_METADATA.ambulances.A1.name}</strong>
                            <br />
                            <span className="text-slate-300">Type: <span className="font-semibold text-white">{REAL_INFRASTRUCTURE_METADATA.ambulances.A1.type}</span></span>
                            <br />
                            <span className="text-emerald-400 font-semibold text-[11px] block mt-0.5">● Ready for Immediate Dispatch</span>
                        </div>
                    </Popup>
                </CircleMarker>

                <CircleMarker
                    center={ambulances.A2}
                    radius={8}
                    pathOptions={{
                        color: "#f59e0b",
                        fillColor: "#fbbf24",
                        fillOpacity: 1,
                        weight: 2,
                    }}
                >
                    <Tooltip permanent direction="bottom">
                        Ambulance A2
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-amber-300 text-sm">🚑 {REAL_INFRASTRUCTURE_METADATA.ambulances.A2.name}</strong>
                            <br />
                            <span className="text-slate-300">Type: <span className="font-semibold text-white">{REAL_INFRASTRUCTURE_METADATA.ambulances.A2.type}</span></span>
                            <br />
                            <span className="text-emerald-400 font-semibold text-[11px] block mt-0.5">● Ready for Immediate Dispatch</span>
                        </div>
                    </Popup>
                </CircleMarker>

                <CircleMarker
                    center={ambulances.A3}
                    radius={8}
                    pathOptions={{
                        color: "#f59e0b",
                        fillColor: "#fbbf24",
                        fillOpacity: 1,
                        weight: 2,
                    }}
                >
                    <Tooltip permanent direction="bottom">
                        Ambulance A3
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-amber-300 text-sm">🚑 {REAL_INFRASTRUCTURE_METADATA.ambulances.A3.name}</strong>
                            <br />
                            <span className="text-slate-300">Type: <span className="font-semibold text-white">{REAL_INFRASTRUCTURE_METADATA.ambulances.A3.type}</span></span>
                            <br />
                            <span className="text-emerald-400 font-semibold text-[11px] block mt-0.5">● Ready for Immediate Dispatch</span>
                        </div>
                    </Popup>
                </CircleMarker>

                {/* VILLAGE SETTLEMENT MARKERS */}
                {(Object.keys(villages) as Array<keyof typeof villages>).map((villageId) => {
                    const center = villages[villageId];
                    const meta = REAL_INFRASTRUCTURE_METADATA.villages[villageId];
                    const isAffected = isVillageAffected(villageId) && floodActive;

                    return (
                        <CircleMarker
                            key={`village_marker_${villageId}`}
                            center={center}
                            radius={isAffected ? 11 : 9}
                            pathOptions={{
                                color: isAffected ? "#ef4444" : "#0284c7",
                                fillColor: isAffected ? "#dc2626" : "#38bdf8",
                                fillOpacity: 0.95,
                                weight: 2.5,
                            }}
                        >
                            <Tooltip permanent direction="top">
                                {meta.name}
                            </Tooltip>
                            <Popup>
                                <div className="text-xs p-1 text-slate-100">
                                    <strong className="text-white text-sm">🏘️ {meta.name} ({villageId})</strong>
                                    <br />
                                    <span className="text-slate-300">Panchayat Type: <span className="font-semibold text-white">{meta.type}</span></span>
                                    <br />
                                    <span className="text-slate-300">Population Exposed: <strong className="text-amber-300">{meta.population.toLocaleString()}</strong></span>
                                    <br />
                                    <span className="text-slate-400 text-[11px] block mt-0.5">{meta.vulnerability}</span>
                                    <div className="mt-1.5 pt-1 border-t border-slate-700/80">
                                        Status:{" "}
                                        <span className={isAffected ? "font-black text-rose-400" : "font-bold text-emerald-400"}>
                                            {isAffected ? "⚠️ ACTIVE INUNDATION ZONE — ROAD CUTOFF" : "✅ NORMAL ACCESS — NO FLOODING"}
                                        </span>
                                    </div>
                                </div>
                            </Popup>
                        </CircleMarker>
                    );
                })}

                {/* REAL HOSPITALS (RENDERED ON TOP LAYER FOR MAXIMUM CLICKABILITY) */}
                <CircleMarker
                    center={hospitals.H1}
                    radius={12}
                    pathOptions={{
                        color: isHospitalAffected("H1") ? "#f97316" : "#16a34a",
                        fillColor: isHospitalAffected("H1") ? "#ea580c" : "#22c55e",
                        fillOpacity: 1,
                        weight: 3,
                    }}
                >
                    <Tooltip permanent direction="top">
                        PHC Barauni
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-white text-sm">🏥 {REAL_INFRASTRUCTURE_METADATA.hospitals.H1.name}</strong>
                            <br />
                            <span className="text-slate-300">Capacity: <strong className="text-white">{REAL_INFRASTRUCTURE_METADATA.hospitals.H1.capacity} Beds</strong></span>
                            <br />
                            <span className="text-slate-400 text-[11px] block mt-0.5">{REAL_INFRASTRUCTURE_METADATA.hospitals.H1.role}</span>
                            {isHospitalAffected("H1") && (
                                <p className="font-bold text-rose-400 mt-1.5 p-1 rounded bg-rose-950/60 border border-rose-800/80">⚠️ ROAD ACCESS CUT OFF (NH-31 SUBMERGED)</p>
                            )}
                        </div>
                    </Popup>
                </CircleMarker>

                <CircleMarker
                    center={hospitals.H2}
                    radius={13}
                    pathOptions={{
                        color: isHospitalAffected("H2") ? "#f97316" : "#16a34a",
                        fillColor: isHospitalAffected("H2") ? "#ea580c" : "#22c55e",
                        fillOpacity: 1,
                        weight: 3,
                    }}
                >
                    <Tooltip permanent direction="top">
                        Sadar Hospital
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-white text-sm">🏥 {REAL_INFRASTRUCTURE_METADATA.hospitals.H2.name}</strong>
                            <br />
                            <span className="text-slate-300">Capacity: <strong className="text-white">{REAL_INFRASTRUCTURE_METADATA.hospitals.H2.capacity} Beds</strong> (ICU & Trauma)</span>
                            <br />
                            <span className="text-slate-400 text-[11px] block mt-0.5">{REAL_INFRASTRUCTURE_METADATA.hospitals.H2.role}</span>
                            {isHospitalAffected("H2") && (
                                <p className="font-bold text-rose-400 mt-1.5 p-1 rounded bg-rose-950/60 border border-rose-800/80">⚠️ ROAD ACCESS CUT OFF (SH-58 SUBMERGED)</p>
                            )}
                        </div>
                    </Popup>
                </CircleMarker>

                <CircleMarker
                    center={hospitals.H3}
                    radius={12}
                    pathOptions={{
                        color: isHospitalAffected("H3") ? "#f97316" : "#16a34a",
                        fillColor: isHospitalAffected("H3") ? "#ea580c" : "#22c55e",
                        fillOpacity: 1,
                        weight: 3,
                    }}
                >
                    <Tooltip permanent direction="top">
                        CHC Sultanganj
                    </Tooltip>
                    <Popup>
                        <div className="text-xs p-1 text-slate-100">
                            <strong className="text-white text-sm">🏥 {REAL_INFRASTRUCTURE_METADATA.hospitals.H3.name}</strong>
                            <br />
                            <span className="text-slate-300">Capacity: <strong className="text-white">{REAL_INFRASTRUCTURE_METADATA.hospitals.H3.capacity} Beds</strong></span>
                            <br />
                            <span className="text-slate-400 text-[11px] block mt-0.5">{REAL_INFRASTRUCTURE_METADATA.hospitals.H3.role}</span>
                        </div>
                    </Popup>
                </CircleMarker>
            </MapContainer>

            {/* MAP LEGEND OVERLAY */}
            <div className="absolute bottom-3 left-3 z-[1000] rounded-xl border border-slate-700/90 bg-slate-950/90 p-3 text-xs text-white backdrop-blur shadow-2xl">
                <p className="font-semibold text-slate-300 mb-2">Map Legend</p>
                <div className="space-y-1.5">
                    <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Grid Risk</p>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded bg-red-600 inline-block border border-red-400"></span>
                        <span>Critical Inundation (&ge; 0.75)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded bg-orange-600 inline-block border border-orange-400"></span>
                        <span>High Risk (0.50 - 0.74)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded bg-yellow-600 inline-block border border-yellow-400"></span>
                        <span>Moderate Risk (0.30 - 0.49)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded bg-emerald-600 inline-block border border-emerald-400"></span>
                        <span>Low Risk (&lt; 0.30)</span>
                    </div>
                    <hr className="border-slate-700/60 my-1" />
                    <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Markers</p>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block border border-emerald-300"></span>
                        <span>Hospital (Accessible)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-orange-500 inline-block border border-orange-300"></span>
                        <span>Hospital (Road Cut Off)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-sky-400 inline-block border border-sky-300"></span>
                        <span>Village / Settlement</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-amber-400 inline-block border border-amber-300"></span>
                        <span>Ambulance Base</span>
                    </div>
                </div>
            </div>
        </div>
    );
}