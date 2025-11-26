"""
Weather client for fetching current weather data from Open-Meteo API.

Provides real-time weather data for Hamburg to use in predictions.
"""

import logging
import httpx
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

HAMBURG_LAT = 53.5511
HAMBURG_LON = 9.9937
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def get_current_weather() -> Dict[str, Any]:
    """
    Fetch current weather data for Hamburg from Open-Meteo.
    
    Returns:
        Dict with weather data matching the prediction model's expected format
    """
    params = {
        "latitude": HAMBURG_LAT,
        "longitude": HAMBURG_LON,
        "current": [
            "temperature_2m",
            "precipitation",
            "wind_speed_10m",
            "weather_code",
            "relative_humidity_2m",
            "cloud_cover"
        ],
        "timezone": "Europe/Berlin"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(OPEN_METEO_URL, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()
        
        current = data.get("current", {})
        
        return {
            "temperature_c": current.get("temperature_2m", 10.0),
            "precipitation_mm": current.get("precipitation", 0.0),
            "wind_speed_kmh": current.get("wind_speed_10m", 10.0),
            "weather_code": current.get("weather_code", 0),
            "humidity_percent": current.get("relative_humidity_2m", 70.0),
            "cloud_cover_percent": current.get("cloud_cover", 50.0),
            "timestamp": datetime.now().isoformat(),
            "location": "Hamburg",
            "source": "Open-Meteo"
        }
    
    except httpx.HTTPError as e:
        logger.warning("Weather API error: %s", e)
        return {
            "temperature_c": 10.0,
            "precipitation_mm": 0.0,
            "wind_speed_kmh": 10.0,
            "weather_code": 0,
            "humidity_percent": 70.0,
            "cloud_cover_percent": 50.0,
            "timestamp": datetime.now().isoformat(),
            "location": "Hamburg",
            "source": "fallback",
            "error": str(e)
        }


def get_weather_description(code: int) -> str:
    """
    Convert WMO weather code to human-readable description.
    
    Args:
        code: WMO weather code
        
    Returns:
        Weather description string
    """
    descriptions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail"
    }
    return descriptions.get(code, "Unknown")


def get_weather_impact_level(weather_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate the expected impact of current weather on delays.
    
    Args:
        weather_data: Current weather data
        
    Returns:
        Dict with impact assessment
    """
    impact_score = 0
    factors = []
    
    # Temperature impact
    temp = weather_data.get("temperature_c", 10)
    if temp < 0:
        impact_score += 2
        factors.append("Freezing temperatures")
    elif temp < 5:
        impact_score += 1
        factors.append("Cold weather")
    elif temp > 30:
        impact_score += 1
        factors.append("Heat")
    
    # Precipitation impact
    precip = weather_data.get("precipitation_mm", 0)
    if precip > 5:
        impact_score += 3
        factors.append("Heavy precipitation")
    elif precip > 1:
        impact_score += 2
        factors.append("Moderate precipitation")
    elif precip > 0:
        impact_score += 1
        factors.append("Light precipitation")
    
    # Wind impact
    wind = weather_data.get("wind_speed_kmh", 0)
    if wind > 50:
        impact_score += 3
        factors.append("Strong winds")
    elif wind > 30:
        impact_score += 2
        factors.append("Moderate winds")
    elif wind > 20:
        impact_score += 1
        factors.append("Light winds")
    
    # Weather code impact
    code = weather_data.get("weather_code", 0)
    if code >= 95:  # Thunderstorm
        impact_score += 3
        factors.append("Thunderstorm")
    elif code >= 71:  # Snow
        impact_score += 2
        factors.append("Snow")
    elif code >= 61:  # Rain
        impact_score += 1
    elif code >= 45:  # Fog
        impact_score += 1
        factors.append("Reduced visibility")
    
    # Determine level
    if impact_score >= 6:
        level = "high"
        description = "Significant delays expected"
    elif impact_score >= 3:
        level = "medium"
        description = "Some delays possible"
    else:
        level = "low"
        description = "Normal operations expected"
    
    return {
        "level": level,
        "score": impact_score,
        "description": description,
        "factors": factors,
        "weather_description": get_weather_description(code)
    }

