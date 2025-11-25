"""
Weather data producer using Open-Meteo API.
Collects weather data for Hamburg to correlate with transport delays.

Open-Meteo is free, no API key required.
- Current/Forecast: https://api.open-meteo.com/v1/forecast
- Historical: https://archive-api.open-meteo.com/v1/archive
"""

import requests
import json
import time
from datetime import datetime, timedelta
from pathlib import Path

# Hamburg coordinates
HAMBURG_LAT = 53.55
HAMBURG_LON = 9.99

# API endpoints
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive"

# Weather variables to collect
WEATHER_VARIABLES = [
    "temperature_2m",
    "precipitation",
    "wind_speed_10m",
    "weather_code",
    "relative_humidity_2m",
    "cloud_cover"
]


def fetch_current_weather():
    """Fetch current weather conditions for Hamburg."""
    params = {
        "latitude": HAMBURG_LAT,
        "longitude": HAMBURG_LON,
        "current": ",".join(WEATHER_VARIABLES),
        "timezone": "Europe/Berlin"
    }
    
    try:
        response = requests.get(FORECAST_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        current = data.get("current", {})
        
        return {
            "timestamp_iso": current.get("time"),
            "timestamp_unix": int(datetime.fromisoformat(current.get("time")).timestamp()) if current.get("time") else None,
            "temperature_c": current.get("temperature_2m"),
            "precipitation_mm": current.get("precipitation"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "weather_code": current.get("weather_code"),
            "humidity_percent": current.get("relative_humidity_2m"),
            "cloud_cover_percent": current.get("cloud_cover"),
            "location": {"lat": HAMBURG_LAT, "lon": HAMBURG_LON, "city": "Hamburg"}
        }
    except Exception as e:
        print(f"[!] Error fetching current weather: {e}")
        return None


def fetch_historical_weather(date_str: str):
    """
    Fetch historical weather data for a specific date.
    
    Args:
        date_str: Date in format 'YYYY-MM-DD'
    
    Returns:
        List of hourly weather records for that day
    """
    params = {
        "latitude": HAMBURG_LAT,
        "longitude": HAMBURG_LON,
        "start_date": date_str,
        "end_date": date_str,
        "hourly": ",".join(WEATHER_VARIABLES),
        "timezone": "Europe/Berlin"
    }
    
    try:
        response = requests.get(HISTORICAL_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        
        records = []
        for i, time_str in enumerate(times):
            record = {
                "timestamp_iso": time_str,
                "timestamp_unix": int(datetime.fromisoformat(time_str).timestamp()),
                "temperature_c": hourly.get("temperature_2m", [None])[i] if i < len(hourly.get("temperature_2m", [])) else None,
                "precipitation_mm": hourly.get("precipitation", [None])[i] if i < len(hourly.get("precipitation", [])) else None,
                "wind_speed_kmh": hourly.get("wind_speed_10m", [None])[i] if i < len(hourly.get("wind_speed_10m", [])) else None,
                "weather_code": hourly.get("weather_code", [None])[i] if i < len(hourly.get("weather_code", [])) else None,
                "humidity_percent": hourly.get("relative_humidity_2m", [None])[i] if i < len(hourly.get("relative_humidity_2m", [])) else None,
                "cloud_cover_percent": hourly.get("cloud_cover", [None])[i] if i < len(hourly.get("cloud_cover", [])) else None,
                "location": {"lat": HAMBURG_LAT, "lon": HAMBURG_LON, "city": "Hamburg"}
            }
            records.append(record)
        
        return records
    except Exception as e:
        print(f"[!] Error fetching historical weather for {date_str}: {e}")
        return []


def save_weather_record(record: dict, filename: str):
    """Append a weather record to JSONL file."""
    with open(filename, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")


def backfill_weather(start_date: str, end_date: str = None):
    """
    Backfill historical weather data for a date range.
    Useful for getting weather data to match existing transport data.
    
    Args:
        start_date: Start date 'YYYY-MM-DD'
        end_date: End date 'YYYY-MM-DD' (default: today)
    """
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        filename = f"weather_{date_str}.jsonl"
        
        print(f"Fetching weather for {date_str}...")
        records = fetch_historical_weather(date_str)
        
        for record in records:
            save_weather_record(record, filename)
        
        print(f"  -> Saved {len(records)} hourly records to {filename}")
        
        current += timedelta(days=1)
        time.sleep(0.5)  # Be nice to the API


def run_continuous_collection(interval_seconds: int = 300):
    """
    Continuously collect current weather data.
    
    Args:
        interval_seconds: How often to fetch (default: 5 minutes)
    """
    filename = f"weather_{datetime.now().strftime('%Y-%m-%d')}.jsonl"
    print(f"Starting continuous weather collection to {filename}")
    print(f"Interval: {interval_seconds} seconds")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            # Check if we need a new file (new day)
            current_date = datetime.now().strftime('%Y-%m-%d')
            expected_filename = f"weather_{current_date}.jsonl"
            if filename != expected_filename:
                filename = expected_filename
                print(f"\n[New day] Switching to {filename}")
            
            # Fetch and save
            record = fetch_current_weather()
            if record:
                save_weather_record(record, filename)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                      f"Temp: {record['temperature_c']}°C, "
                      f"Rain: {record['precipitation_mm']}mm, "
                      f"Wind: {record['wind_speed_kmh']}km/h, "
                      f"Code: {record['weather_code']}")
            
            time.sleep(interval_seconds)
            
    except KeyboardInterrupt:
        print("\n\nWeather collection stopped.")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "backfill":
            # Usage: python weather_producer.py backfill 2025-11-20 2025-11-25
            start = sys.argv[2] if len(sys.argv) > 2 else (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
            end = sys.argv[3] if len(sys.argv) > 3 else None
            backfill_weather(start, end)
        elif sys.argv[1] == "current":
            # Just fetch once
            record = fetch_current_weather()
            if record:
                print(json.dumps(record, indent=2))
    else:
        # Default: continuous collection
        run_continuous_collection(interval_seconds=5)

