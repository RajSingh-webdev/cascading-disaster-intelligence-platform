"""
live_sensor.py — Real Telemetry Ingestion Engine
=================================================
Fetches live meteorological data from Open-Meteo (https://open-meteo.com/)
for the Barauni/Sultanganj study region (Bihar) and derives flood risk
parameters using physics-informed equations.

API: Open-Meteo (FREE, no API key required)
Lat/Lon: 25.148°N, 85.950°E (Barauni, Begusarai district, Bihar)
"""

import time
import requests
from datetime import datetime, timezone

# Study region centroid — Barauni, Begusarai
STUDY_LAT = 25.148
STUDY_LON = 85.950

# Physics constants for Ganga-Kosi floodplain (Bihar)
# Barauni barrage baseline: ~8m MSL
BARRAGE_BASELINE_WATER_LEVEL_M = 3.5   # Dry season normal
DANGER_LEVEL_M = 8.5                    # CWC Barauni danger level
WARNING_LEVEL_M = 7.0                   # CWC warning level

# Rainfall → water-level rise coefficient for this floodplain
# Based on Bihar flood hydrology: every 50mm/6h raises level ~1m
RAINFALL_TO_LEVEL_COEFF = 0.022  # m per mm of accumulated rain

# In-memory cache to prevent blocking or rate-limiting
_CACHE_DATA = None
_CACHE_TIMESTAMP = 0
_CACHE_TTL_SECONDS = 30


def fetch_live_telemetry() -> dict:
    """
    Fetch real-time meteorological data from Open-Meteo for the study region.

    Returns a dict with derived flood parameters and raw sensor readings.
    Uses a 30-second in-memory cache for ultra-fast response times.
    Falls back to a clearly-labelled demo set if the API is unreachable.
    """
    global _CACHE_DATA, _CACHE_TIMESTAMP

    now = time.time()
    if _CACHE_DATA is not None and (now - _CACHE_TIMESTAMP) < _CACHE_TTL_SECONDS:
        return _CACHE_DATA

    try:
        # --- 1. Fetch current conditions ---
        current_url = "https://api.open-meteo.com/v1/forecast"
        current_params = {
            "latitude": STUDY_LAT,
            "longitude": STUDY_LON,
            "current": "precipitation,rain,temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
            "timezone": "Asia/Kolkata",
        }
        current_resp = requests.get(current_url, params=current_params, timeout=3.5)
        current_resp.raise_for_status()
        current_data = current_resp.json().get("current", {})

        # --- 2. Fetch last 6 hours of hourly precipitation ---
        hourly_params = {
            "latitude": STUDY_LAT,
            "longitude": STUDY_LON,
            "hourly": "precipitation",
            "past_hours": 6,
            "forecast_hours": 0,
            "timezone": "Asia/Kolkata",
        }
        hourly_resp = requests.get(current_url, params=hourly_params, timeout=8)
        hourly_resp.raise_for_status()
        hourly = hourly_resp.json().get("hourly", {})
        precip_series = hourly.get("precipitation", [0.0])

        # --- 3. Derive flood parameters ---
        # Accumulated rainfall over last 6h (mm)
        rain_6h_mm = round(sum(precip_series), 1)

        # Current hour rainfall (mm)
        current_rain_mm = round(current_data.get("precipitation", 0.0), 1)

        # Duration: hours with non-zero rainfall in last 6h
        rainy_hours = sum(1 for p in precip_series if p > 0.1)
        duration_hours = max(rainy_hours, 1) if rain_6h_mm > 0 else 1.0

        # Physics-based water level estimate
        # If it's dry season (low rain), use baseline; scale up with rain
        derived_water_level = round(
            BARRAGE_BASELINE_WATER_LEVEL_M + (rain_6h_mm * RAINFALL_TO_LEVEL_COEFF),
            2
        )
        # Monsoon season bias: if humidity > 80%, add 0.5m (pre-saturation)
        humidity = current_data.get("relative_humidity_2m", 60)
        if humidity > 80:
            derived_water_level += 0.5

        derived_water_level = round(min(derived_water_level, 12.0), 2)

        # Flood risk tier from water level
        if derived_water_level >= DANGER_LEVEL_M:
            alert_level = "DANGER"
        elif derived_water_level >= WARNING_LEVEL_M:
            alert_level = "WARNING"
        else:
            alert_level = "NORMAL"

        payload = {
            "data_source": "open-meteo-live",
            "source_label": "Open-Meteo API (Real IMD-calibrated NWP)",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "study_region": "Barauni-Sultanganj, Begusarai, Bihar",
            "coordinates": {"lat": STUDY_LAT, "lon": STUDY_LON},
            # Derived pipeline inputs
            "rainfall_mm": rain_6h_mm,
            "duration_hours": float(duration_hours),
            "water_level_m": derived_water_level,
            # Raw sensor readings
            "sensor_readings": {
                "current_rain_mm_per_hr": current_rain_mm,
                "accumulated_rain_6h_mm": rain_6h_mm,
                "temperature_c": current_data.get("temperature_2m"),
                "humidity_pct": humidity,
                "wind_speed_kmh": current_data.get("wind_speed_10m"),
                "weather_code": current_data.get("weather_code"),
            },
            # CWC barrage status
            "barrage_status": {
                "estimated_level_m": derived_water_level,
                "danger_level_m": DANGER_LEVEL_M,
                "warning_level_m": WARNING_LEVEL_M,
                "alert_level": alert_level,
            },
            "is_live": True,
        }
        _CACHE_DATA = payload
        _CACHE_TIMESTAMP = time.time()
        return payload

    except Exception as exc:
        # Fallback: return clearly-labelled demo data so UI never crashes
        fallback_payload = {
            "data_source": "fallback-demo",
            "source_label": "Demo Mode (API unavailable)",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "study_region": "Barauni-Sultanganj, Begusarai, Bihar",
            "coordinates": {"lat": STUDY_LAT, "lon": STUDY_LON},
            "rainfall_mm": 180.0,
            "duration_hours": 4.0,
            "water_level_m": 8.0,
            "sensor_readings": {
                "current_rain_mm_per_hr": 22.5,
                "accumulated_rain_6h_mm": 180.0,
                "temperature_c": 27.0,
                "humidity_pct": 95,
                "wind_speed_kmh": 14.0,
                "weather_code": 65,
            },
            "barrage_status": {
                "estimated_level_m": 8.0,
                "danger_level_m": DANGER_LEVEL_M,
                "warning_level_m": WARNING_LEVEL_M,
                "alert_level": "DANGER",
            },
            "is_live": False,
            "fallback_reason": str(exc),
        }
        _CACHE_DATA = fallback_payload
        _CACHE_TIMESTAMP = time.time()
        return fallback_payload
