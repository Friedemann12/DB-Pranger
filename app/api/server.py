"""
FastAPI server for delay predictions.

Provides REST API endpoints for the Next.js dashboard.

Run with: uvicorn app.api.server:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
from datetime import datetime
import json

from .predictor import DelayPredictor, create_features_from_transport_weather
from .history import get_history_manager
from .weather_client import get_current_weather, get_weather_impact_level
from .segments import get_segments_with_coordinates

# Initialize FastAPI app
app = FastAPI(
    title="Hamburg Transit Delay Predictor",
    description="Predict public transport delays based on weather and time features",
    version="1.0.0"
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://dashboard:3000",  # Docker container name
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global predictor instance (lazy loaded)
_predictor: Optional[DelayPredictor] = None


def get_predictor() -> DelayPredictor:
    """Get or create predictor instance."""
    global _predictor
    if _predictor is None:
        model_dir = Path(__file__).parent.parent / "model"
        if not (model_dir / "delay_regressor.pkl").exists():
            raise HTTPException(
                status_code=503,
                detail="Models not trained yet. Run train_model.py first."
            )
        _predictor = DelayPredictor(str(model_dir))
    return _predictor


# Request/Response models
class PredictionFeatures(BaseModel):
    """Input features for prediction."""
    line: str = "6"
    vehicle_type: str = "METROBUS"
    line_type: str = "BUS"
    direction: str = "unknown"
    hour_of_day: int = 12
    day_of_week: int = 3
    temperature_c: float = 10.0
    precipitation_mm: float = 0.0
    wind_speed_kmh: float = 10.0
    weather_code: int = 0
    humidity_percent: float = 70.0
    cloud_cover_percent: float = 50.0


class PredictionResponse(BaseModel):
    """Prediction response."""
    predicted_delay_minutes: Optional[float] = None
    classification: Optional[Dict[str, Any]] = None
    input_features: Dict[str, Any]
    timestamp: str


class TransportJourney(BaseModel):
    """Transport journey data from Geofox."""
    journeyID: Optional[str] = None
    line: Dict[str, Any]
    vehicleType: str
    segments: Optional[List[Dict[str, Any]]] = None


class WeatherData(BaseModel):
    """Weather data from Open-Meteo."""
    temperature_c: float = 10.0
    precipitation_mm: float = 0.0
    wind_speed_kmh: float = 10.0
    weather_code: int = 0
    humidity_percent: float = 70.0
    cloud_cover_percent: float = 50.0


class CombinedPredictionRequest(BaseModel):
    """Combined transport and weather data for prediction."""
    transport: TransportJourney
    weather: WeatherData
    timestamp: Optional[int] = None


# API Endpoints

@app.get("/")
async def root():
    """Health check and API info."""
    return {
        "service": "Hamburg Transit Delay Predictor",
        "status": "running",
        "version": "1.0.0",
        "endpoints": {
            "prediction": {
                "predict": "/predict",
                "predict_combined": "/predict/combined",
                "predict_batch": "/predict/batch"
            },
            "model": {
                "info": "/model/info",
                "features": "/model/features"
            },
            "history": {
                "journeys": "/history/journeys",
                "delays": "/history/delays",
                "journeys_by_line": "/history/journeys-by-line?line=U3",
                "journey_detail": "/history/journey/{journey_id}"
            },
            "statistics": {
                "overview": "/stats/overview",
                "by_line": "/stats/by-line",
                "heatmap": "/stats/heatmap",
                "segments": "/stats/segments"
            },
            "live": {
                "current": "/live/current",
                "weather": "/weather/current"
            },
            "health": "/health"
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    try:
        predictor = get_predictor()
        return {
            "status": "healthy",
            "models_loaded": True,
            "model_info": predictor.get_model_info()
        }
    except HTTPException as e:
        return {
            "status": "unhealthy",
            "models_loaded": False,
            "error": e.detail
        }


@app.post("/predict", response_model=PredictionResponse)
async def predict(features: PredictionFeatures):
    """
    Predict delay from feature values.
    
    Returns predicted delay in minutes and binary classification.
    """
    predictor = get_predictor()
    
    result = predictor.predict_full(features.model_dump())
    
    return PredictionResponse(
        predicted_delay_minutes=result.get("predicted_delay_minutes"),
        classification=result.get("classification"),
        input_features=result.get("input_features"),
        timestamp=result.get("timestamp")
    )


@app.post("/predict/combined")
async def predict_combined(request: CombinedPredictionRequest):
    """
    Predict delay from raw transport and weather data.
    
    Automatically extracts features from the combined data.
    """
    predictor = get_predictor()
    
    # Convert to feature dict
    features = create_features_from_transport_weather(
        transport_data=request.transport.model_dump(),
        weather_data=request.weather.model_dump(),
        timestamp=request.timestamp
    )
    
    result = predictor.predict_full(features)
    
    return {
        "predicted_delay_minutes": result.get("predicted_delay_minutes"),
        "classification": result.get("classification"),
        "extracted_features": features,
        "timestamp": result.get("timestamp")
    }


@app.post("/predict/batch")
async def predict_batch(feature_list: List[PredictionFeatures]):
    """Batch prediction for multiple journeys."""
    predictor = get_predictor()
    
    results = predictor.predict_batch([f.model_dump() for f in feature_list])
    
    return {"predictions": results, "count": len(results)}


@app.get("/model/info")
async def model_info():
    """Get information about the loaded models."""
    predictor = get_predictor()
    return predictor.get_model_info()


@app.get("/model/features")
async def model_features():
    """Get the feature schema expected by the model."""
    return {
        "features": {
            "line": "Transit line name (e.g., '6', 'U3')",
            "vehicle_type": "Vehicle type (METROBUS, U_BAHN, etc.)",
            "line_type": "Line type (BUS, TRAIN)",
            "direction": "Line direction",
            "hour_of_day": "Hour (0-23)",
            "day_of_week": "Day of week (1=Sunday, 7=Saturday)",
            "temperature_c": "Temperature in Celsius",
            "precipitation_mm": "Precipitation in mm",
            "wind_speed_kmh": "Wind speed in km/h",
            "weather_code": "WMO weather code",
            "humidity_percent": "Relative humidity %",
            "cloud_cover_percent": "Cloud cover %"
        },
        "example": PredictionFeatures().model_dump()
    }


# ============================================================================
# History & Statistics Endpoints
# ============================================================================

@app.get("/history/journeys")
async def get_history_journeys(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    line: Optional[str] = None,
    vehicle_type: Optional[str] = None
):
    """
    Get historical journey data with pagination.
    
    - **limit**: Number of journeys to return (max 1000)
    - **offset**: Pagination offset
    - **line**: Filter by line name (e.g., 'U3', '6')
    - **vehicle_type**: Filter by vehicle type (e.g., 'U_BAHN', 'METROBUS')
    """
    history = get_history_manager()
    return history.get_all_journeys(
        limit=limit,
        offset=offset,
        line=line,
        vehicle_type=vehicle_type
    )


@app.get("/history/delays")
async def get_history_delays(
    hours: int = Query(24, ge=1, le=168),
    bucket_minutes: int = Query(60, ge=15, le=360)
):
    """
    Get aggregated delay data over time.
    
    - **hours**: How many hours of history to return
    - **bucket_minutes**: Size of time buckets in minutes
    """
    history = get_history_manager()
    return {
        "data": history.get_delays_over_time(hours=hours, bucket_minutes=bucket_minutes),
        "hours": hours,
        "bucket_minutes": bucket_minutes
    }


@app.get("/stats/overview")
async def get_stats_overview():
    """
    Get overall dashboard statistics.
    
    Returns aggregated metrics for all historical data.
    """
    history = get_history_manager()
    stats = history.get_delay_stats()
    lines = history.get_unique_lines()
    
    return {
        **stats,
        "active_lines": len(lines),
        "lines": lines,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/stats/by-line")
async def get_stats_by_line():
    """
    Get delay statistics grouped by transit line.
    
    Returns per-line metrics including average delay and status.
    """
    history = get_history_manager()
    return {
        "lines": history.get_stats_by_line(),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/stats/heatmap")
async def get_stats_heatmap():
    """
    Get delay data aggregated by hour and day of week.
    
    Returns a grid for heatmap visualization:
    - X-axis: Hour (0-23)
    - Y-axis: Day of week (1=Sunday to 7=Saturday)
    
    Useful for identifying patterns like rush hour delays.
    """
    history = get_history_manager()
    return {
        "data": history.get_heatmap_data(),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/stats/segments")
async def get_stats_segments(
    limit: int = Query(100, ge=1, le=500),
    sort_by: str = Query("avg_delay", regex="^(avg_delay|max_delay|total_delay)$")
):
    """
    Get delay statistics aggregated by route segment.
    
    Returns segments (start station -> end station) with:
    - Average and max delay
    - Total trips on this segment
    - List of lines using this segment
    - GPS coordinates for map visualization
    
    - **limit**: Maximum number of segments to return (default 100, max 500)
    - **sort_by**: Sort metric - 'avg_delay' (default), 'max_delay', or 'total_delay'
    """
    history = get_history_manager()
    
    # Get aggregated segment data from Spark
    segments = history.get_segments_with_delay(limit=limit, sort_by=sort_by)
    
    # Enrich with coordinates for map visualization
    segments_with_coords = get_segments_with_coordinates(segments)
    
    return {
        "segments": segments_with_coords,
        "total": len(segments_with_coords),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/history/journeys-by-line")
async def get_journeys_by_line(
    line: str = Query(..., description="Line name (e.g., 'U3', '6')"),
    limit: int = Query(50, ge=1, le=200)
):
    """
    Get all journeys for a specific line.
    
    Returns journeys with aggregated segment data for carousel display.
    - **line**: Line name (required)
    - **limit**: Maximum number of journeys to return
    """
    history = get_history_manager()
    return history.get_journeys_by_line(line=line, limit=limit)


@app.get("/history/journey/{journey_id}")
async def get_journey_detail(journey_id: str):
    """
    Get detailed segment information for a specific journey.
    
    Returns all segments with delay information for the detail view.
    """
    history = get_history_manager()
    result = history.get_journey_segments(journey_id)
    
    if not result.get("segments"):
        raise HTTPException(
            status_code=404,
            detail=f"Journey {journey_id} not found"
        )
    
    return result


# ============================================================================
# Live Data Endpoints
# ============================================================================

@app.get("/weather/current")
async def get_weather():
    """
    Get current weather data for Hamburg.
    
    Fetches real-time weather from Open-Meteo API.
    """
    weather = await get_current_weather()
    impact = get_weather_impact_level(weather)
    
    return {
        "weather": weather,
        "impact": impact
    }


@app.get("/live/current")
async def get_live_predictions():
    """
    Get live predictions for current conditions.
    
    Combines current weather with time features to predict delays
    for all known lines.
    """
    # Get current weather
    weather = await get_current_weather()
    impact = get_weather_impact_level(weather)
    
    # Get current time features
    now = datetime.now()
    hour_of_day = now.hour
    day_of_week = (now.isoweekday() % 7) + 1  # Convert to Spark format
    
    # Get all lines from history
    history = get_history_manager()
    lines = history.get_unique_lines()
    
    # Try to get predictor (may not be available if models not trained)
    predictions = []
    try:
        predictor = get_predictor()
        
        for line_info in lines[:10]:  # Limit to top 10 lines
            features = {
                "line": line_info["name"],
                "vehicle_type": line_info["vehicle_type"] or "METROBUS",
                "line_type": line_info["line_type"] or "BUS",
                "direction": line_info["direction"] or "unknown",
                "hour_of_day": hour_of_day,
                "day_of_week": day_of_week,
                "temperature_c": weather["temperature_c"],
                "precipitation_mm": weather["precipitation_mm"],
                "wind_speed_kmh": weather["wind_speed_kmh"],
                "weather_code": weather["weather_code"],
                "humidity_percent": weather["humidity_percent"],
                "cloud_cover_percent": weather["cloud_cover_percent"]
            }
            
            result = predictor.predict_full(features)
            predictions.append({
                "line": line_info["name"],
                "vehicle_type": line_info["vehicle_type"],
                "predicted_delay_minutes": result.get("predicted_delay_minutes"),
                "classification": result.get("classification"),
                "direction": line_info["direction"]
            })
        
        # Sort by predicted delay
        predictions.sort(
            key=lambda x: x.get("predicted_delay_minutes") or 0,
            reverse=True
        )
        
    except HTTPException:
        # Models not available - return empty predictions
        predictions = []
    
    return {
        "predictions": predictions,
        "weather": weather,
        "weather_impact": impact,
        "time_features": {
            "hour_of_day": hour_of_day,
            "day_of_week": day_of_week,
            "is_rush_hour": (7 <= hour_of_day <= 9) or (16 <= hour_of_day <= 19),
            "is_weekend": day_of_week in [1, 7]
        },
        "timestamp": now.isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

