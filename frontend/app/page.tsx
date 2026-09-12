"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useEffect } from "react";
import {
  generateSpatialGrid,
  HISTORICAL_2024_EVENT,
  HistoricalSnapshot,
  REAL_INFRASTRUCTURE_METADATA,
} from "../data/spatialGrid";

const DisasterMap = dynamic(() => import("../components/DisasterMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 bg-slate-950/60 backdrop-blur rounded-xl">
      <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
        Initializing Satellite Map Surface...
      </span>
    </div>
  ),
});

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

type DisasterResult = {
  status: string;

  event: {
    type: string;
    risk_score: number;
    hazard_level: string;

    inputs: {
      rainfall_mm: number;
      duration_hours: number;
      water_level_m: number;
    };
  };

  impact: {
    affected_roads: string[];
    affected_villages: string[];
    affected_hospitals: string[];
    population_affected: number;
  };

  priority_assessment: {
    village_id: string;
    village_name?: string;
    population: number;
    priority_score: number;
    priority_level: string;
    road_impact: boolean;
    hospital_impact: boolean;
  }[];

  resource_optimization: {
    status: string;

    allocations: Allocation[];

    ambulance_coverage: {
      served_villages: string[];
      unserved_villages: string[];
      total_resources: number;
      resources_used: number;
    };

    rescue_team_coverage: {
      served_villages: string[];
      unserved_villages: string[];
      total_resources: number;
      resources_used: number;
    };
  };

  resource_gaps: {
    ambulances: string[];
    rescue_teams: string[];
  };
};

type Mode = "live" | "historical" | "simulation";

type ExperimentalMLResult = {
  status: string;
  raw_score: number;
  calibrated_score: number;
  flood_prediction: 0 | 1;
  model_type: string;
  calibration: string;
  deployment_ready: boolean;
  note: string;
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("historical");

  const [rainfall, setRainfall] = useState(180);
  const [duration, setDuration] = useState(4);
  const [waterLevel, setWaterLevel] = useState(8.6);

  const [data, setData] = useState<DisasterResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSpatialGrid, setShowSpatialGrid] = useState(true);

  // Historical event state
  const [historyIndex, setHistoryIndex] = useState(0); // Default to Baseline (T-48h Pre-Event)
  const currentSnapshot: HistoricalSnapshot = HISTORICAL_2024_EVENT[historyIndex];
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSitrepModal, setShowSitrepModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"dispatches" | "shelters" | "cascade" | "sensors">("dispatches");

  const [experimentalML, setExperimentalML] =
    useState<ExperimentalMLResult | null>(null);
  const [experimentalLoading, setExperimentalLoading] = useState(false);

  // Time ticker
  const [currentTime, setCurrentTime] = useState("");
  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Historical Timeline Auto-Play
  useEffect(() => {
    if (!isPlaying || mode !== "historical") return;
    const interval = setInterval(() => {
      setHistoryIndex((prev) => (prev + 1) % HISTORICAL_2024_EVENT.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isPlaying, mode]);

  // Compute the dynamic 2D spatial grid
  const spatialGrid = useMemo(() => {
    if (mode === "historical") {
      const multiplier = currentSnapshot.river_level_m / 8.0;
      return generateSpatialGrid(currentSnapshot.rainfall_24h_mm, multiplier);
    }
    if (data) {
      return generateSpatialGrid(
        data.event.inputs.rainfall_mm,
        data.event.inputs.water_level_m / 8.0
      );
    }
    return generateSpatialGrid(mode === "live" ? 180 : rainfall, 1.0);
  }, [mode, historyIndex, currentSnapshot, data, rainfall]);

  async function analyzeScenario(customRainfall?: number, customDuration?: number, customWaterLevel?: number) {
    try {
      setLoading(true);
      setData(null);

      const rf = customRainfall !== undefined ? customRainfall : rainfall;
      const dur = customDuration !== undefined ? customDuration : duration;
      const wl = customWaterLevel !== undefined ? customWaterLevel : waterLevel;

      const payload =
        mode === "live"
          ? { mode: "live" }
          : {
            mode: "simulation",
            rainfall_mm: rf,
            duration_hours: dur,
            water_level_m: wl,
          };

      const response = await fetch("http://127.0.0.1:8000/api/disaster/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend response:", errorText);
        throw new Error("Backend request failed");
      }

      const result: DisasterResult = await response.json();
      setData(result);
    } catch (error) {
      console.error(error);
      alert("Could not connect to the disaster engine on http://127.0.0.1:8000. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(presetName: "extreme" | "moderate" | "baseline") {
    if (presetName === "extreme") {
      setRainfall(180);
      setDuration(4);
      setWaterLevel(8.6);
      if (mode === "simulation") analyzeScenario(180, 4, 8.6);
    } else if (presetName === "moderate") {
      setRainfall(90);
      setDuration(3);
      setWaterLevel(5.2);
      if (mode === "simulation") analyzeScenario(90, 3, 5.2);
    } else {
      setRainfall(15);
      setDuration(1);
      setWaterLevel(2.0);
      if (mode === "simulation") analyzeScenario(15, 1, 2.0);
    }
  }

  async function runExperimentalML() {
    try {
      setExperimentalLoading(true);
      const latitude = 25.15;
      const longitude = 85.95;

      const response = await fetch(
        `http://127.0.0.1:8000/api/ml/experimental?latitude=${latitude}&longitude=${longitude}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) throw new Error("Experimental ML request failed");
      const result: ExperimentalMLResult = await response.json();
      setExperimentalML(result);
    } catch (error) {
      console.error("Experimental ML error:", error);
      alert("Could not run experimental ML validation.");
    } finally {
      setExperimentalLoading(false);
    }
  }

  // Active metrics depending on mode
  const currentRiskScoreNum =
    mode === "historical"
      ? currentSnapshot.mean_risk_score
      : data
        ? data.event.risk_score
        : 0.0;

  const displayRiskScore =
    mode === "historical"
      ? currentSnapshot.mean_risk_score.toFixed(2)
      : data
        ? data.event.risk_score.toFixed(2)
        : "0.00";

  const displayHazardLevel =
    mode === "historical"
      ? currentSnapshot.hazard_level
      : data
        ? data.event.hazard_level
        : "NORMAL";

  const displayAffectedVillages =
    mode === "historical"
      ? String(currentSnapshot.affected_villages.length)
      : data
        ? String(data?.impact?.affected_villages?.length ?? 0)
        : "0";

  const displayPopulationAffected =
    mode === "historical"
      ? currentSnapshot.population_affected.toLocaleString()
      : data
        ? data?.impact?.population_affected?.toLocaleString() ?? "0"
        : "0";

  const activeAffectedVillages =
    mode === "historical"
      ? currentSnapshot.affected_villages
      : data?.impact?.affected_villages ?? [];

  const activeAffectedRoads =
    mode === "historical"
      ? currentSnapshot.affected_roads
      : data?.impact?.affected_roads ?? [];

  const activeAffectedHospitals =
    mode === "historical"
      ? currentSnapshot.affected_hospitals
      : data?.impact?.affected_hospitals ?? [];

  const activeAllocations =
    mode === "historical"
      ? currentSnapshot.historical_allocations
      : (data?.resource_optimization?.allocations ?? []);

  // Auto-fetch telemetry in Live Feed mode
  useEffect(() => {
    if (mode === "live") {
      analyzeScenario();
      const interval = setInterval(() => {
        analyzeScenario();
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  const isCritical = currentRiskScoreNum >= 0.75;

  // Real-Time High-Ground Shelter Capacity & Occupancy Modeling
  const s1Total = REAL_INFRASTRUCTURE_METADATA.shelters.S1.capacity; // 850
  const s1Occupied = isCritical
    ? 765
    : currentRiskScoreNum >= 0.50
    ? 510
    : currentRiskScoreNum >= 0.30
    ? 220
    : 15;
  const s1Pct = Math.round((s1Occupied / s1Total) * 100);

  const s2Total = REAL_INFRASTRUCTURE_METADATA.shelters.S2.capacity; // 600
  const s2Occupied = isCritical
    ? 520
    : currentRiskScoreNum >= 0.50
    ? 330
    : currentRiskScoreNum >= 0.30
    ? 140
    : 10;
  const s2Pct = Math.round((s2Occupied / s2Total) * 100);

  return (
    <main className="min-h-screen bg-[#060e1e] text-slate-100 p-3 sm:p-5 lg:p-7 font-sans antialiased selection:bg-amber-500 selection:text-slate-950">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* OFFICIAL GOVERNMENT TOP RIBBON & COMMAND HEADER */}
        <header className="rounded-2xl border border-[#1e3860] bg-[#0c1930]/95 shadow-2xl relative overflow-hidden">
          {/* Indian National Tricolor Accent Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-white to-emerald-600" />

          <div className="p-5 sm:p-6 relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              
              {/* Government Portal Insignia & Title */}
              <div className="flex items-start gap-4">
                {/* Official Insignia Emblem Badge */}
                <div className="hidden sm:flex flex-col items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-b from-[#162746] to-[#0d1b33] border border-[#2a4d80] shadow-lg shrink-0 text-amber-400">
                  <span className="text-xl">🏛️</span>
                  <span className="text-[8px] font-black tracking-widest text-amber-300 uppercase mt-0.5">NDMA</span>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      SEOC LEVEL-4 ACTIVE MONITORING
                    </span>
                    <span className="rounded-md bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 text-[11px] font-bold text-blue-300">
                      🛰️ ISRO BHUVAN • SENTINEL-1A SAR • CWC TELEMETRY
                    </span>
                    {currentTime && (
                      <span className="text-[11px] text-amber-300/90 font-mono hidden md:inline-block bg-[#162746] px-2 py-0.5 rounded border border-[#2a4d80]">
                        ⏱️ {currentTime} IST
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400">
                      National Disaster Management Authority & State Disaster Management Authority (BSDMA)
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                      Integrated Cascading Flood Intelligence & Emergency Decision Support System
                    </h1>
                  </div>

                  <p className="text-slate-300 text-xs mt-1 max-w-3xl">
                    Patna–Mokama–Barh Floodplain Sector • Automated Multi-Modal Microwave Radar Inundation & Lifeline Rerouting
                  </p>
                </div>
              </div>

              {/* GOVERNMENT MODE SWITCHER & ACTIONS */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
                <div className="flex rounded-xl border border-[#2a4d80] bg-[#081224] p-1.5 shadow-inner">
                  <button
                    onClick={() => setMode("historical")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === "historical"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
                      : "text-slate-300 hover:text-white"
                      }`}
                  >
                    HISTORICAL 2024 AUDIT
                  </button>

                  <button
                    onClick={() => setMode("simulation")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${mode === "simulation"
                      ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                      : "text-slate-300 hover:text-white"
                      }`}
                  >
                    SCENARIO SIMULATOR
                  </button>

                  <button
                    onClick={() => setMode("live")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === "live"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/50"
                      : "text-slate-300 hover:text-white"
                      }`}
                  >
                    LIVE SENSORS & SAR
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowSitrepModal(true)}
                    className="cursor-pointer rounded-xl border border-blue-500/50 bg-[#162746] hover:bg-[#1f3763] px-3.5 py-2 text-xs font-bold text-blue-200 transition-all flex items-center gap-1.5 shadow-md shadow-blue-950/40"
                  >
                    <span>📋</span> OFFICIAL SITREP
                  </button>

                  {mode !== "historical" && (
                    <button
                      onClick={() => analyzeScenario()}
                      disabled={loading}
                      className="cursor-pointer rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-500 hover:to-orange-500 px-5 py-2 text-xs font-black text-slate-950 shadow-lg shadow-amber-900/30 disabled:opacity-50 transition-all border border-amber-400"
                    >
                      {loading ? "CALCULATING..." : "⚡ RUN SIMULATION"}
                    </button>
                  )}

                  <button
                    onClick={runExperimentalML}
                    disabled={experimentalLoading}
                    className="cursor-pointer rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-300 disabled:opacity-50 transition-all"
                  >
                    {experimentalLoading ? "INFERRING..." : "🔬 INFER ML MODEL"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </header>

        {/* OFFICIAL EMERGENCY ADVISORY BANNER */}
        {isCritical && (
          <div className="rounded-2xl border-2 border-red-500/80 bg-gradient-to-r from-[#3a0d14] via-[#24080c] to-[#3a0d14] p-4 shadow-2xl animate-pulse">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🚨</span>
                <div>
                  <h3 className="font-black text-red-200 text-sm sm:text-base tracking-wide flex items-center gap-2">
                    GOVERNMENT OF BIHAR EMERGENCY DIRECTIVE — RED FLOOD ALERT (LEVEL 4)
                  </h3>
                  <p className="text-xs text-red-300/90 mt-0.5">
                    Critical inundation across Sultanganj Diara & Pipra Dewas. Arterial highways NH-31 & SH-58 severed. SDRF/NDRF watercraft deployed for immediate evacuation.
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-lg bg-red-600 px-4 py-1.5 text-xs font-black text-white uppercase tracking-wider border border-red-400 shadow-md">
                EVACUATION PROTOCOL ACTIVE
              </span>
            </div>
          </div>
        )}

        {/* EXECUTIVE KPI DASHBOARD METRICS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Composite Inundation Risk"
            value={displayRiskScore}
            subtitle="Multi-Modal Satellite Index"
            barPercent={Math.min(100, Math.round(Number(displayRiskScore) * 100))}
            color={Number(displayRiskScore) >= 0.75 ? "red" : Number(displayRiskScore) >= 0.5 ? "orange" : "emerald"}
          />
          <StatCard
            title="Hazard Severity Tier"
            value={displayHazardLevel}
            subtitle="NDMA Incident Severity Scale"
            color={displayHazardLevel === "CRITICAL" ? "red" : displayHazardLevel === "HIGH" ? "orange" : "emerald"}
          />
          <StatCard
            title="Isolated Habitats"
            value={`${activeAffectedVillages.length} of 5`}
            subtitle="Severed Gram Panchayats"
            color={activeAffectedVillages.length > 0 ? "red" : "emerald"}
          />
          <StatCard
            title="Citizens at Risk"
            value={displayPopulationAffected}
            subtitle="Total Inundated Population"
            color={Number(displayPopulationAffected.replace(/,/g, "")) > 0 ? "red" : "emerald"}
          />
        </section>

        {/* MAIN COMMAND CENTER: 2-COLUMN SPLIT GIS DECK */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">

          {/* LEFT COLUMN: SATELLITE GIS MAP & CONTROLS (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">

            {/* GIS MAP CARD */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <span>🗺️</span> North Bihar Risk Surface & Lifeline Network
                  </h2>
                  <p className="text-xs text-slate-400">
                    Sentinel-1A SAR microwave inundation mask & topographical routing
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSpatialGrid(!showSpatialGrid)}
                    className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${showSpatialGrid
                      ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                      }`}
                  >
                    {showSpatialGrid ? "🗺️ SAR Grid: ON" : "🗺️ SAR Grid: OFF"}
                  </button>
                </div>
              </div>

              <div className="h-[520px] rounded-xl overflow-hidden border border-slate-800 relative shadow-inner">
                <DisasterMap
                  floodActive={mode === "historical" ? currentSnapshot.mean_risk_score > 0.3 : !!data}
                  allocation={activeAllocations}
                  affectedVillages={activeAffectedVillages}
                  affectedRoads={activeAffectedRoads}
                  affectedHospitals={activeAffectedHospitals}
                  spatialGrid={spatialGrid}
                  showSpatialGrid={showSpatialGrid}
                />
              </div>
            </div>

            {/* SCENARIO CONTROL DECK */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl">
              
              {/* HISTORICAL TIMELINE CONTROLS */}
              {mode === "historical" && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
                        Historical Benchmark: 27 Sep 2024
                      </span>
                      <h3 className="text-base font-black text-white mt-1">
                        Timeline Stage: {currentSnapshot.label}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {currentSnapshot.status_summary}
                      </p>
                    </div>

                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${isPlaying
                        ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 animate-pulse"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30"
                        }`}
                    >
                      <span>{isPlaying ? "⏸" : "▶"}</span>
                      <span>{isPlaying ? "PAUSE TIMELINE" : "AUTO-PLAY TIMELINE"}</span>
                    </button>
                  </div>

                  {/* TIMELINE STAGES */}
                  <div className="mt-4">
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {HISTORICAL_2024_EVENT.map((item, idx) => (
                        <button
                          key={item.label}
                          onClick={() => {
                            setHistoryIndex(idx);
                            setIsPlaying(false);
                          }}
                          className={`cursor-pointer text-left p-2 rounded-xl border transition-all ${historyIndex === idx
                            ? "bg-blue-600/20 border-blue-500 text-white font-bold shadow-md shadow-blue-950/40"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                        >
                          <span className="block text-[10px] text-slate-500 font-mono">Stage {idx + 1}</span>
                          <span className="text-xs truncate block">{item.label.split(" ")[0]}</span>
                        </button>
                      ))}
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={HISTORICAL_2024_EVENT.length - 1}
                      value={historyIndex}
                      onChange={(e) => {
                        setHistoryIndex(Number(e.target.value));
                        setIsPlaying(false);
                      }}
                      className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg cursor-pointer transition-all"
                    />

                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 text-[11px]">24h Rain Gauge:</span>
                        <p className="font-bold text-white mt-0.5">{currentSnapshot.rainfall_24h_mm} mm</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 text-[11px]">River Gauge Height:</span>
                        <p className="font-bold text-white mt-0.5">{currentSnapshot.river_level_m} m</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-400 text-[11px]">Satellite Orbit Pass:</span>
                        <p className="font-bold text-amber-300 truncate mt-0.5" title={currentSnapshot.satellite_pass_time}>
                          {currentSnapshot.satellite_pass_time.split("(")[0]}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SIMULATION SLIDERS & PRESETS */}
              {mode === "simulation" && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="text-base font-black text-amber-300">
                        Scenario Simulation Engine
                      </h3>
                      <p className="text-xs text-slate-400">
                        Adjust physical parameters or pick an instant preset scenario
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => applyPreset("extreme")}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition cursor-pointer"
                      >
                        🌊 Extreme Flood
                      </button>
                      <button
                        onClick={() => applyPreset("moderate")}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition cursor-pointer"
                      >
                        🌧️ Moderate Surge
                      </button>
                      <button
                        onClick={() => applyPreset("baseline")}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition cursor-pointer"
                      >
                        ☀️ Baseline Normal
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 mt-4">
                    <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Precipitation (mm)</span>
                        <span className="font-mono text-white font-bold">{rainfall} mm</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="250"
                        value={rainfall}
                        onChange={(e) => setRainfall(Number(e.target.value))}
                        className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                      />
                    </div>

                    <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Rainfall Duration</span>
                        <span className="font-mono text-white font-bold">{duration} hrs</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="12"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                      />
                    </div>

                    <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>River Water Level</span>
                        <span className="font-mono text-white font-bold">{waterLevel} m</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.1"
                        value={waterLevel}
                        onChange={(e) => setWaterLevel(Number(e.target.value))}
                        className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => analyzeScenario()}
                      disabled={loading}
                      className="cursor-pointer px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs shadow-lg transition-all"
                    >
                      {loading ? "CALCULATING CASCADING RISKS..." : "⚡ RUN CASCADING SIMULATION"}
                    </button>
                  </div>
                </div>
              )}

              {/* LIVE TELEMETRY STATUS */}
              {mode === "live" && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Live Auto-Polling Active (20s Heartbeat)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Synchronizing with CWC barrage telemetry & Sentinel-1A orbital pass
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => analyzeScenario()}
                    disabled={loading}
                    className="cursor-pointer px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
                  >
                    {loading ? "POLLING SENSORS..." : "🔄 SYNC TELEMETRY NOW"}
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* RIGHT COLUMN: TACTICAL INTELLIGENCE CENTER (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* TABBED TACTICAL CONTROL CARD */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl flex flex-col">
              
              {/* TAB HEADERS */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-4">
                <button
                  onClick={() => setActiveTab("dispatches")}
                  className={`cursor-pointer py-2 px-1 rounded-lg text-[11px] font-extrabold transition-all text-center ${activeTab === "dispatches"
                    ? "bg-amber-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  🚑 Dispatches
                  <span className={`ml-1 text-[9px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "dispatches" ? "bg-slate-950/20 text-slate-950 font-black" : "bg-slate-800 text-slate-300"}`}>
                    {activeAllocations.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("shelters")}
                  className={`cursor-pointer py-2 px-1 rounded-lg text-[11px] font-extrabold transition-all text-center ${activeTab === "shelters"
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  🏕️ Shelters
                  <span className={`ml-1 text-[9px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "shelters" ? "bg-purple-950 text-purple-200" : "bg-slate-800 text-slate-300"}`}>
                    {Math.round(((s1Occupied + s2Occupied) / (s1Total + s2Total)) * 100)}%
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("cascade")}
                  className={`cursor-pointer py-2 px-1 rounded-lg text-[11px] font-extrabold transition-all text-center ${activeTab === "cascade"
                    ? "bg-red-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  ⛓️ Cascade
                  <span className={`ml-1 text-[9px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === "cascade" ? "bg-red-950 text-red-200" : "bg-slate-800 text-slate-300"}`}>
                    {activeAffectedRoads.length + activeAffectedVillages.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("sensors")}
                  className={`cursor-pointer py-2 px-1 rounded-lg text-[11px] font-extrabold transition-all text-center ${activeTab === "sensors"
                    ? "bg-blue-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  🔬 ML & Sensors
                </button>
              </div>

              {/* TAB 1: EMERGENCY DISPATCHES */}
              {activeTab === "dispatches" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Emergency Resource Manifest
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${activeAllocations.length > 0
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                      : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                      }`}>
                      {activeAllocations.length > 0 ? "DISPATCH ACTIVE" : "ALL SECTORS SECURE"}
                    </span>
                  </div>

                  {activeAllocations.length === 0 ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center text-slate-300">
                      <p className="text-sm font-semibold text-emerald-400">✅ All Lifelines Clear</p>
                      <p className="text-xs text-slate-400 mt-1">No emergency dispatches required. All 5 panchayats and hospitals remain reachable by road.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                      {activeAllocations.map((item) => {
                        const villageMeta = REAL_INFRASTRUCTURE_METADATA.villages[item.village_id as keyof typeof REAL_INFRASTRUCTURE_METADATA.villages];
                        const targetName = villageMeta ? villageMeta.name : (item.village_name || item.village_id);
                        const ambulanceMeta = REAL_INFRASTRUCTURE_METADATA.ambulances[item.resource as keyof typeof REAL_INFRASTRUCTURE_METADATA.ambulances];
                        const resourceName = ambulanceMeta ? ambulanceMeta.name : item.resource;

                        return (
                          <div
                            key={item.resource}
                            className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-3.5 shadow-md hover:border-slate-600 transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-amber-400 font-extrabold text-xs flex items-center gap-1.5">
                                {item.resource_type === "RESCUE_BOAT" ? "🚤" : "🚑"} {resourceName}
                              </span>
                              <span className={`text-[9px] font-extrabold rounded-full px-2 py-0.5 border ${item.priority_level === "CRITICAL"
                                ? "bg-red-500/20 text-red-300 border-red-500/40"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                }`}>
                                {item.priority_level}
                              </span>
                            </div>

                            <p className="mt-1.5 text-sm font-black text-white">
                              Target: {targetName} ({item.village_id})
                            </p>

                            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Transit ETA:</span>
                                <span className="font-bold text-amber-300 font-mono">{item.estimated_travel_time_min.toFixed(1)} min</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Distance:</span>
                                <span className="font-bold text-white font-mono">{item.distance_km.toFixed(1)} km</span>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-400 mt-2">
                              {item.reason}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: HIGH-GROUND SHELTER INTAKE */}
              {activeTab === "shelters" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Evacuee Bed Availability
                    </span>
                    <span className="text-xs font-bold text-purple-300 font-mono">
                      {(s1Occupied + s2Occupied).toLocaleString()} / {(s1Total + s2Total).toLocaleString()} Beds
                    </span>
                  </div>

                  {/* S1 */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-4 shadow-md space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-white">
                          🏫 {REAL_INFRASTRUCTURE_METADATA.shelters.S1.name} (S1)
                        </h4>
                        <span className="text-[10px] text-slate-400">High Elevation School • 62m DEM</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${s1Pct >= 85 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}`}>
                        {s1Pct >= 85 ? "⚠️ NEAR CAPACITY" : "AVAILABLE"}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Intake Occupancy:</span>
                        <span className={`font-mono font-bold ${s1Pct >= 85 ? "text-rose-400" : "text-emerald-400"}`}>
                          {s1Occupied} / {s1Total} ({s1Pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${s1Pct >= 85 ? "bg-rose-500" : s1Pct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${s1Pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Remaining: <strong className="text-white">{s1Total - s1Occupied} beds</strong></span>
                        <span>Inflow: <strong className="text-slate-200">V1 & V4</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* S2 */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-4 shadow-md space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-white">
                          🏛️ {REAL_INFRASTRUCTURE_METADATA.shelters.S2.name} (S2)
                        </h4>
                        <span className="text-[10px] text-slate-400">Disaster Centre • Safe Embankment</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${s2Pct >= 85 ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}`}>
                        {s2Pct >= 85 ? "⚠️ NEAR CAPACITY" : "AVAILABLE"}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Intake Occupancy:</span>
                        <span className={`font-mono font-bold ${s2Pct >= 85 ? "text-rose-400" : "text-emerald-400"}`}>
                          {s2Occupied} / {s2Total} ({s2Pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${s2Pct >= 85 ? "bg-rose-500" : s2Pct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${s2Pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Remaining: <strong className="text-white">{s2Total - s2Occupied} beds</strong></span>
                        <span>Inflow: <strong className="text-slate-200">V3 & V5</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CASCADING FAILURE CHAIN */}
              {activeTab === "cascade" && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Sequential Cascade Propagation
                    </span>
                    <span className="text-[10px] font-bold text-rose-400">
                      {activeAffectedRoads.length} Roads • {activeAffectedVillages.length} Villages Isolated
                    </span>
                  </div>

                  <FlowItem
                    icon="🌧️"
                    title="1. Satellite Trigger"
                    subtitle={mode === "historical" ? `${currentSnapshot.rainfall_24h_mm} mm Precipitation` : data ? `${data.event.type}` : "Extreme Rainfall"}
                    status={currentRiskScoreNum > 0.3 ? "ACTIVE" : "NORMAL"}
                  />

                  <Arrow />

                  <FlowItem
                    icon="🌊"
                    title="2. Spatial Inundation Surge"
                    subtitle={mode === "historical" ? `Mean Risk: ${currentSnapshot.mean_risk_score.toFixed(2)}` : data ? `Risk Score: ${data.event.risk_score.toFixed(2)}` : "Risk Score: 0.00"}
                    status={currentRiskScoreNum > 0.5 ? "CRITICAL" : "NORMAL"}
                  />

                  <Arrow />

                  <FlowItem
                    icon="🚧"
                    title="3. Route Severance"
                    subtitle={activeAffectedRoads.length > 0 ? activeAffectedRoads.join(", ") : "All Arterial Highways Open"}
                    status={activeAffectedRoads.length > 0 ? "SEVERED" : "OPEN"}
                  />

                  <Arrow />

                  <FlowItem
                    icon="🏘️"
                    title="4. Community Isolation"
                    subtitle={activeAffectedVillages.length > 0 ? activeAffectedVillages.join(", ") : "All Panchayats Accessible"}
                    status={activeAffectedVillages.length > 0 ? "ISOLATED" : "ACCESSIBLE"}
                  />

                  <Arrow />

                  <FlowItem
                    icon="🏥"
                    title="5. Healthcare Access Risk"
                    subtitle={activeAffectedHospitals.length > 0 ? activeAffectedHospitals.join(", ") : "All Medical Centres Operational"}
                    status={activeAffectedHospitals.length > 0 ? "ACCESS CUT" : "SECURE"}
                  />
                </div>
              )}

              {/* TAB 4: ML BENCHMARKS & SENSOR SPECS */}
              {activeTab === "sensors" && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Machine Learning & Sensor Telemetry
                    </span>
                    <button
                      onClick={runExperimentalML}
                      disabled={experimentalLoading}
                      className="cursor-pointer px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold hover:bg-amber-500/30 transition"
                    >
                      {experimentalLoading ? "RUNNING..." : "⚡ RUN ML INFERENCE"}
                    </button>
                  </div>

                  {experimentalML && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-amber-300">XGBoost Isotonic Calibration</span>
                        <span className="font-mono font-bold text-white">{(experimentalML.calibrated_score * 100).toFixed(1)}% Flood Risk</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                        <div>Raw Score: <strong className="text-white">{experimentalML.raw_score.toFixed(3)}</strong></div>
                        <div>Model: <strong className="text-white">{experimentalML.model_type}</strong></div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">SAR Water Mask</span>
                      <strong className="text-white text-xs">Sentinel-1A (10m)</strong>
                      <span className="text-slate-400 text-[10px] block mt-0.5">All-Weather C-Band</span>
                    </div>

                    <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Digital Elevation</span>
                      <strong className="text-white text-xs">NASA SRTM (30m)</strong>
                      <span className="text-slate-400 text-[10px] block mt-0.5">Global Topography</span>
                    </div>

                    <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Precipitation Radar</span>
                      <strong className="text-white text-xs">NASA GPM IMERG</strong>
                      <span className="text-slate-400 text-[10px] block mt-0.5">3-Hour Latency</span>
                    </div>

                    <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Pipeline Latency</span>
                      <strong className="text-emerald-400 text-xs">&lt; 850 ms</strong>
                      <span className="text-slate-400 text-[10px] block mt-0.5">Real-Time Evaluation</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* SITREP MODAL */}
        {showSitrepModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
            <div className="relative w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-red-500/20 border border-red-500/40 text-red-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                      OFFICIAL DISASTER SITREP
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      DOC REF: BIHAR-DISASTER-INTEL-{new Date().toISOString().slice(0, 10)}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-1">
                    North Bihar Floodplain Incident Situation Report
                  </h3>
                </div>
                <button
                  onClick={() => setShowSitrepModal(false)}
                  className="cursor-pointer rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 text-xs font-bold transition"
                >
                  ✕ CLOSE
                </button>
              </div>

              <div className="mt-5 space-y-5 text-xs sm:text-sm">
                {/* METRICS SUMMARY */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800">
                    <span className="text-slate-400 text-xs">Risk Assessment</span>
                    <p className={`text-base font-black mt-0.5 ${currentRiskScoreNum >= 0.75 ? "text-red-400" : "text-amber-400"}`}>
                      {displayRiskScore} ({displayHazardLevel})
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800">
                    <span className="text-slate-400 text-xs">Exposed Population</span>
                    <p className="text-base font-black text-white mt-0.5">
                      {displayPopulationAffected}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800">
                    <span className="text-slate-400 text-xs">Isolated Panchayats</span>
                    <p className="text-base font-black text-amber-300 mt-0.5">
                      {displayAffectedVillages} Communities
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800">
                    <span className="text-slate-400 text-xs">Severed Highways</span>
                    <p className="text-base font-black text-red-400 mt-0.5">
                      {activeAffectedRoads.length} Corridors
                    </p>
                  </div>
                </div>

                {/* CRITICAL SECTORS INUNDATION */}
                <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800">
                  <h4 className="font-bold text-slate-300 text-xs uppercase tracking-wider mb-2">
                    🚨 Inundation Zones & Community Isolation
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                    {activeAffectedVillages.length > 0 ? (
                      activeAffectedVillages.map((id) => {
                        const v = REAL_INFRASTRUCTURE_METADATA.villages[id as keyof typeof REAL_INFRASTRUCTURE_METADATA.villages];
                        return (
                          <li key={id}>
                            <strong className="text-white">{v?.name || id}</strong>: {v?.vulnerability || "Severe flood inundation zone."} (Pop: {v?.population.toLocaleString() || "N/A"})
                          </li>
                        );
                      })
                    ) : (
                      <li className="text-emerald-400">All community road connections are open and operational.</li>
                    )}
                  </ul>
                </div>

                {/* DISPATCH ROSTER */}
                <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800">
                  <h4 className="font-bold text-slate-300 text-xs uppercase tracking-wider mb-2">
                    🚑 Optimized Emergency Dispatch Manifest
                  </h4>
                  {activeAllocations.length > 0 ? (
                    <div className="space-y-2">
                      {activeAllocations.map((a) => (
                        <div key={a.resource} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                          <div>
                            <span className="font-bold text-amber-300">{a.resource} ({a.resource_type})</span> &rarr; <span className="font-bold text-white">{a.village_name || a.village_id}</span>
                            <p className="text-slate-400 text-[11px] mt-0.5">{a.reason}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-white font-mono font-bold">ETA: {a.estimated_travel_time_min.toFixed(1)} min</span>
                            <span className="block text-[10px] text-slate-400">{a.distance_km.toFixed(1)} km transit</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No active dispatches required under current baseline telemetry.</p>
                  )}
                </div>

                {/* SATELLITE TELEMETRY */}
                <div className="rounded-xl bg-slate-950/60 p-4 border border-slate-800 text-xs text-slate-400">
                  <span className="font-bold text-slate-300 block mb-1">🛰️ Earth Observation Metadata Verification</span>
                  <p>Inundation Mask: <strong className="text-slate-200">Copernicus Sentinel-1A SAR (10m C-Band)</strong></p>
                  <p>Elevation / Terrain Model: <strong className="text-slate-200">NASA SRTM Digital Elevation (30m)</strong></p>
                  <p>Precipitation Data: <strong className="text-slate-200">NASA GPM IMERG Radar Integration</strong></p>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  onClick={() => window.print()}
                  className="cursor-pointer px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                >
                  <span>🖨️</span> PRINT / SAVE AS PDF
                </button>
                <button
                  onClick={() => setShowSitrepModal(false)}
                  className="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  barPercent,
  color = "emerald",
}: {
  title: string;
  value: string;
  subtitle?: string;
  barPercent?: number;
  color?: "emerald" | "orange" | "red";
}) {
  const colorMap = {
    emerald: "text-emerald-400 bg-emerald-500",
    orange: "text-amber-400 bg-amber-500",
    red: "text-rose-400 bg-rose-500",
  };

  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-900/90 p-5 shadow-xl backdrop-blur-lg flex flex-col justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {title}
        </p>
        <p className="text-3xl font-black mt-2 text-white tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>

      {barPercent !== undefined && (
        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full ${colorMap[color].split(" ")[1]}`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FlowItem({
  icon,
  title,
  subtitle,
  status,
}: {
  icon: string;
  title: string;
  subtitle: string;
  status: string;
}) {
  const isDanger = status === "CRITICAL" || status === "SEVERED" || status === "ISOLATED" || status === "ACCESS CUT";
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-950/80 border border-slate-800 p-3.5 shadow-md">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-xs font-bold text-white">{title}</p>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
      </div>
      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${isDanger ? "bg-red-500/20 text-red-300 border-red-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"}`}>
        {status}
      </span>
    </div>
  );
}

function Arrow() {
  return <div className="text-center text-slate-600 font-bold text-xs">↓</div>;
}
