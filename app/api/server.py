"""
FastAPI server for delay predictions.

Provides REST API endpoints for the Next.js dashboard.

Run with: uvicorn app.api.server:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
import json

from .predictor import DelayPredictor, create_features_from_transport_weather

# Initialize FastAPI app
app = FastAPI(
    title="Hamburg Transit Delay Predictor",
    description="Predict public transport delays based on weather and time features",
    version="1.0.0"
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
        "endpoints": {
            "predict": "/predict",
            "predict_combined": "/predict/combined",
            "model_info": "/model/info",
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

