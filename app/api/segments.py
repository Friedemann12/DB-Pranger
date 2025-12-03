"""
Segment coordinate enrichment module.

Fetches station coordinates from HVV Geofox API and enriches
segment data with GPS coordinates for map visualization.
"""

import os
import json
import logging
import requests
import hmac
import hashlib
import base64
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

GTI_USER = os.getenv("GTI_USER")
GTI_PASSWORD = os.getenv("GTI_PASSWORD")
API_URL = "https://gti.geofox.de/gti/public/listStations"
CACHE_FILE = "app/api/cache/stations_cache.json"

_station_lookup: Optional[Dict] = None


def get_signature(body_payload: dict, password: str) -> str:
    """Generate HMAC-SHA1 signature for Geofox API authentication."""
    key = bytes(password, "utf-8")
    message = bytes(json.dumps(body_payload, separators=(",", ":")), "utf-8")
    hashed = hmac.new(key, message, hashlib.sha1)
    return base64.b64encode(hashed.digest()).decode("utf-8")


def fetch_all_stations() -> Dict:
    """Fetch all stations from HVV Geofox API."""
    logger.info("Fetching station directory from HVV...")

    payload = {"version": 62, "coordinateType": "EPSG_4326"}

    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json",
        "geofox-auth-user": GTI_USER,
        "geofox-auth-signature": get_signature(payload, GTI_PASSWORD),
        "geofox-auth-type": "HmacSHA1",
    }

    try:
        response = requests.post(
            API_URL,
            data=json.dumps(payload, separators=(",", ":")),
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        if data.get("returnCode") != "OK":
            logger.error("HVV API error: %s", data.get("errorText"))
            return {}

        station_map = {}
        for station in data.get("stations", []):
            if "coordinate" in station:
                station_map[station["id"]] = {
                    "name": station["name"],
                    "lat": station["coordinate"]["y"],
                    "lon": station["coordinate"]["x"],
                }

        logger.info("Successfully loaded %d stations", len(station_map))
        return station_map

    except Exception as e:
        logger.error("Failed to load stations: %s", e)
        return {}


def get_station_lookup(cache_file: str = CACHE_FILE) -> Dict:
    """
    Get station lookup dictionary from cache or API.

    Uses singleton pattern - loads once and caches in memory.
    Returns dict mapping station ID to {name, lat, lon}.
    """
    global _station_lookup

    if _station_lookup is not None:
        return _station_lookup

    if os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            _station_lookup = json.load(f)
            logger.info("Loaded %d stations from cache", len(_station_lookup))
            return _station_lookup

    _station_lookup = fetch_all_stations()

    if _station_lookup:
        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(_station_lookup, f)
        logger.info("Saved stations cache: %s", cache_file)

    return _station_lookup


def get_coordinates_for_station_key(station_key: str, station_lookup: Dict) -> Dict:
    """
    Get coordinates for a station key.

    Station keys from segments look like "Master:80950".
    We try multiple formats to find a match in the lookup.

    Returns dict with lat, lon or None values if not found.
    """
    if not station_key:
        return {"lat": None, "lon": None}

    if station_key in station_lookup:
        station = station_lookup[station_key]
        return {"lat": station["lat"], "lon": station["lon"]}

    if ":" in station_key:
        short_key = station_key.split(":")[-1]
        if short_key in station_lookup:
            station = station_lookup[short_key]
            return {"lat": station["lat"], "lon": station["lon"]}

    for sid, station in station_lookup.items():
        if station_key in sid or sid in station_key:
            return {"lat": station["lat"], "lon": station["lon"]}

    return {"lat": None, "lon": None}


def enrich_segments_with_coordinates(
    segments: List[Dict], station_lookup: Optional[Dict] = None
) -> List[Dict]:
    """
    Enrich segment data with start and end station coordinates.

    Takes a list of segment dicts (from get_segments_with_delay) and adds
    lat/lon coordinates for start and end stations.

    Args:
        segments: List of segment dicts with start_station_key and end_station_key
        station_lookup: Optional pre-loaded station lookup dict

    Returns:
        List of enriched segment dicts with coordinates added
    """
    if station_lookup is None:
        station_lookup = get_station_lookup()

    enriched = []
    for segment in segments:
        start_coords = get_coordinates_for_station_key(
            segment.get("start_station_key", ""), station_lookup
        )
        end_coords = get_coordinates_for_station_key(
            segment.get("end_station_key", ""), station_lookup
        )

        enriched_segment = {
            **segment,
            "start_lat": start_coords["lat"],
            "start_lon": start_coords["lon"],
            "end_lat": end_coords["lat"],
            "end_lon": end_coords["lon"],
        }
        enriched.append(enriched_segment)

    return enriched


def get_segments_with_coordinates(segments: List[Dict]) -> List[Dict]:
    """
    Filter and return only segments that have valid coordinates for both endpoints.

    This is useful for map visualization where we need both start and end coordinates.
    """
    station_lookup = get_station_lookup()
    enriched = enrich_segments_with_coordinates(segments, station_lookup)

    valid_segments = [
        seg
        for seg in enriched
        if seg["start_lat"] is not None
        and seg["start_lon"] is not None
        and seg["end_lat"] is not None
        and seg["end_lon"] is not None
    ]

    return valid_segments

