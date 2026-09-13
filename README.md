# 🌊 Cascading Disaster Intelligence & Emergency Response Platform

**An AI-driven decision-support command system for multi-hazard cascading prediction, infrastructure vulnerability assessment, and algorithmic emergency dispatch.**

---

## 📌 Executive Summary

Disasters in flood-prone river basins (such as Bihar's Ganga-Kosi-Gandak belt) are rarely isolated events. Severe precipitation causes barrage overflows, which trigger road breaches, isolate rural health centers, cut off diara villages, and exhaust rescue capacities.

This platform replaces fragmented manual disaster response with an **end-to-end cascading intelligence pipeline**:
1. **Physical & ML Hazard Prediction:** Multi-horizon rainfall & terrain physics feeding a calibrated **XGBoost** model.
2. **Cascading Failure Graph:** Evaluates second- and third-order network disruptions (roads -> hospitals -> power/shelters).
3. **Operations Research (OR-Tools) Optimization:** Mathematical dispatch of emergency boats & ambulances minimizing response ETA.
4. **Live & Historical Intelligence:** Live Open-Meteo telemetry integration alongside a replayable verified 2024 Bihar flood timeline.
5. **Interactive Tactical GIS Command Center:** High-resolution Esri satellite rasterization with instant NDMA-compliant SITREP generation.

---

## 📊 Data Accuracy, ML Specs & Model Performance

### 1. Machine Learning Model Architecture
- **Algorithm:** Calibrated Extreme Gradient Boosting (`XGBClassifier`) with **Isotonic Probability Calibration**.
- **Training Event:** Bihar 2022 Monsoon Inundation Dataset (`BIHAR_2022_09_02`).
- **Validation & Test Event:** September 2024 Bihar Floods (`BIHAR_2024_09_27`).
- **Decision Threshold:** Calibrated score >= 0.0127 for proactive early flood hazard detection.

### 2. Feature Vectors (8 Physics & Hydrology Inputs)
| Feature Name | Description | Source / Sensor |
|---|---|---|
| `rainfall_1h_mm` | 1-Hour Cumulative Precipitation | Automated Weather Stations (AWS) |
| `rainfall_3h_mm` | 3-Hour Cumulative Precipitation | AWS Radar / Open-Meteo |
| `rainfall_6h_mm` | 6-Hour Cumulative Precipitation | AWS / Satellite Radar |
| `rainfall_12h_mm` | 12-Hour Cumulative Precipitation | AWS / CWC Hydrological |
| `rainfall_24h_mm` | 24-Hour Cumulative Precipitation | AWS / IMD Gridded Rainfall |
| `elevation_m` | Surface Height above Mean Sea Level | SRTM / ALOS 30m Digital Elevation Model |
| `slope_deg` | Terrain Slope Gradient | Derived DEM Terrain Analysis |
| `distance_to_river_m`| Euclidean Distance to River Embankment | Survey of India / OSM Hydrology Lines |

### 3. Model Accuracy & Calibration Reliability
- **Isotonic Calibration:** Raw probability scores are mapped through monotonic regression to ensure true empirical probability (preventing overconfident or underconfident disaster warnings).
- **Physical Consistency Rules:** Incorporates non-linear river stage thresholds (CWC Warning Level: `7.0m`, Danger Level: `8.5m`, Embankment Overtopping: `>9.0m`).
- **Spatial Resolution:** 10-meter Synthetic Aperture Radar (SAR) simulation grid cells.

---

## 🔑 API Keys & External Services

| Service | Purpose | Authentication / Key Required? |
|---|---|---|
| **Open-Meteo API** | Real-time weather, precipitation, humidity & wind | **100% Free — NO API KEY NEEDED** |
| **Esri World Imagery** | High-resolution satellite basemap layer | **Public Tile Server — NO API KEY NEEDED** |
| **OpenStreetMap** | Cartographic road network & vector tiles | **Open Access — NO API KEY NEEDED** |
| **Google OR-Tools** | Linear programming resource allocation solver | **Local Offline Engine — NO API KEY NEEDED** |

> 💡 **Zero Dependency Overhead:** The entire platform can run in an air-gapped or offline emergency operations center (EOC) with no cloud subscriptions or rate-limiting API keys.

---

## 🏗️ System Architecture

### Backend Components (`/backend`)
1. **`main.py`**: FastAPI server exposing endpoints for analysis, historical replay, live telemetry, and ML calibration diagnostics.
2. **`hazard_engine.py`**: Calculates compound environmental hazard indices using weighted hydrological formulations.
3. **`cascade_engine.py`**: Simulates interdependent infrastructure network collapse (road cut-offs, isolated primary health centers).
4. **`priority_engine.py`**: Evaluates multi-criteria vulnerability scoring based on affected population density and medical isolation.
5. **`resource_optimizer.py`**: Employs Google OR-Tools to solve the Constrained Vehicle Routing / Assignment problem minimizing travel time and unmet demand.
6. **`live_sensor.py`**: Ingests real-time telemetry from Open-Meteo with local in-memory caching.
7. **`predict_physical_calibrated.py`**: Loads the production XGBoost model with Isotonic Regression artifacts.

### Frontend Components (`/frontend`)
1. **`app/page.tsx`**: High-tech Tactical Intelligence Center dashboard with live mode switching, historical timeline scrubber, what-if parameter sliders, telemetry feeds, and emergency SITREP generator.
2. **`components/DisasterMap.tsx`**: Dynamic Leaflet GIS interface featuring satellite tile switching, 10m SAR risk raster cells, road connectivity polylines, animated dispatch vectors, and multi-touch trackpad/touchscreen gestures.
3. **`data/spatialGrid.ts`**: Geospatial vector definitions, village coordinates, hospital status data, and 2024 Bihar flood timeline snapshots.

---

## ⚡ Quick Start & Run Guide

### 1. Start the Backend (FastAPI)
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000 --host 127.0.0.1 --reload
```
- API Endpoint: `http://127.0.0.1:8000`
- Interactive API Docs: `http://127.0.0.1:8000/docs`

### 2. Start the Frontend (Next.js)
```powershell
cd frontend
npm run dev
```
- Web Application: `http://localhost:3000`

---

## 📑 Core API Endpoints

- `POST /api/disaster/analyze`: Executes the full pipeline simulation.
- `GET /api/disaster/live`: Fetches real-time sensor telemetry and derived hazard index from Open-Meteo.
- `GET /api/disaster/historical/{index}`: Fetches verified historical snapshots from the September 2024 Bihar flood event.
- `POST /api/ml/predict-experimental`: Returns raw vs. calibrated probabilities and model confidence diagnostics.

---

## 🛡️ License & Acknowledgements
- Designed for **Smart India Hackathon (SIH)**.
- Base geospatial layers provided by Esri ArcGIS Online and OpenStreetMap contributors.
- Hydrological standards informed by Central Water Commission (CWC) and National Disaster Management Authority (NDMA) guidelines.
