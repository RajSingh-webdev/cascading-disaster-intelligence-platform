from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal

from experimental_ml import predict_experimental
from disaster_pipeline import run_disaster_pipeline
from grid_engine import generate_spatial_grid
from historical_engine import get_historical_2024_summary
from live_sensor import fetch_live_telemetry


class DisasterInput(BaseModel):
    mode: Literal["live", "simulation"] = "simulation"

    rainfall_mm: float | None = Field(default=None, ge=0)
    duration_hours: float | None = Field(default=None, ge=0)
    water_level_m: float | None = Field(default=None, ge=0)


app = FastAPI(
    title="Cascading Disaster Intelligence & Spatial Risk Platform",
    description="Multi-Modal Satellite Inundation Prediction, Cascading Disruption & Resource Allocation API",
    version="2.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "platform": "Cascading Disaster Intelligence Platform (SIH 2026)",
        "status": "ONLINE",
        "endpoints": [
            "POST /api/disaster/analyze",
            "GET /api/disaster/spatial-grid",
            "GET /api/historical/bihar-2024",
            "GET /api/satellite/metadata",
            "GET /api/sensor/live",
            "POST /api/ml/experimental",
        ],
    }


@app.get("/api/sensor/live")
def get_live_sensor_data():
    """
    Fetches real-time meteorological observations and derived barrage flood parameters.
    """
    return fetch_live_telemetry()


@app.get("/api/satellite/metadata")
def get_satellite_metadata():
    """
    Returns public satellite specifications, revisit times, resolutions, and ingestion lag.
    """
    return {
        "study_region": "North Bihar Floodplain (Kosi-Gandak-Ganga basin)",
        "satellites": [
            {
                "mission": "Copernicus Sentinel-1A (SAR C-Band)",
                "agency": "ESA / ISRO NRSC Bhuvan",
                "spatial_resolution_m": 10,
                "revisit_time_days": "6 to 12 days",
                "advantages": "All-weather cloud/monsoon penetrating microwave backscatter (VV/VH)",
                "data_product": "Flood Inundation Water Extent Mask",
            },
            {
                "mission": "NASA SRTM DEM v3",
                "agency": "NASA / USGS",
                "spatial_resolution_m": 30,
                "revisit_time_days": "Static Global Topography",
                "advantages": "Digital elevation and terrain slope angle calculation",
                "data_product": "Elevation (m) and Slope (deg)",
            },
            {
                "mission": "NASA GPM IMERG (Early & Late Runs)",
                "agency": "NASA / JAXA",
                "spatial_resolution_km": 10,
                "temporal_resolution_min": 30,
                "latency_hours": 3,
                "advantages": "Multi-satellite accumulated precipitation radar & radiometer",
                "data_product": "1h, 3h, 6h, 12h, 24h Precipitation (mm)",
            },
        ],
        "pipeline_latency_ms": 850,
    }


@app.get("/api/disaster/spatial-grid")
def get_spatial_grid(
    rainfall_mm: float = Query(default=180.0, ge=0),
    water_level_m: float = Query(default=8.0, ge=0),
    grid_size: int = Query(default=8, ge=4, le=20),
    mode: str = Query(default="simulation"),
):
    """
    Generates a 2D spatial raster grid with multi-modal physical attributes.
    """
    if mode == "live":
        telemetry = fetch_live_telemetry()
        rainfall_mm = telemetry["rainfall_mm"]
        water_level_m = telemetry["water_level_m"]

    return generate_spatial_grid(
        rainfall_mm=rainfall_mm,
        water_level_m=water_level_m,
        grid_size=grid_size,
    )


@app.get("/api/historical/bihar-2024")
def get_historical_event():
    """
    Returns multi-temporal satellite snapshots for the 27 Sep 2024 Bihar flood event.
    """
    return get_historical_2024_summary()


@app.post("/api/disaster/analyze")
def analyze_disaster(data: DisasterInput):

    # SIMULATION MODE
    if data.mode == "simulation":
        if (
            data.rainfall_mm is None
            or data.duration_hours is None
            or data.water_level_m is None
        ):
            raise HTTPException(
                status_code=400,
                detail="Simulation mode requires rainfall, duration and water level.",
            )

        return run_disaster_pipeline(
            rainfall_mm=data.rainfall_mm,
            duration_hours=data.duration_hours,
            water_level_m=data.water_level_m,
        )

    # LIVE MODE — REAL METEOROLOGICAL TELEMETRY
    telemetry = fetch_live_telemetry()
    result = run_disaster_pipeline(
        rainfall_mm=telemetry["rainfall_mm"],
        duration_hours=telemetry["duration_hours"],
        water_level_m=telemetry["water_level_m"],
    )
    result["live_telemetry"] = telemetry
    return result


@app.post("/api/ml/experimental")
def experimental_ml_prediction(
    latitude: float = Query(default=25.15),
    longitude: float = Query(default=85.95),
):
    try:
        return predict_experimental(
            latitude=latitude,
            longitude=longitude,
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=500, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Experimental ML error: {error}")