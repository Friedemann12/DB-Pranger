"""
Delay Prediction API.

Loads trained models and provides prediction functions.
Can be used standalone or integrated with a web framework.
"""

import json
import joblib
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Union


class DelayPredictor:
    """
    Delay prediction service using trained ML models.
    
    Usage:
        predictor = DelayPredictor("path/to/model/dir")
        
        # Predict delay in minutes
        delay = predictor.predict_delay(features)
        
        # Predict if delayed (binary)
        is_delayed = predictor.predict_is_delayed(features)
    """
    
    def __init__(self, model_dir: str):
        """
        Initialize predictor with trained models.
        
        Args:
            model_dir: Directory containing .pkl model files and config
        """
        self.model_dir = Path(model_dir)
        self.regressor = None
        self.classifier = None
        self.feature_config = None
        self.reg_metadata = None
        self.clf_metadata = None
        
        self._load_models()
    
    def _load_models(self):
        """Load models and configuration."""
        # Load feature config
        config_path = self.model_dir / "feature_config.json"
        if config_path.exists():
            with open(config_path) as f:
                self.feature_config = json.load(f)
        else:
            raise FileNotFoundError(f"Feature config not found: {config_path}")
        
        # Load regression model
        reg_path = self.model_dir / "delay_regressor.pkl"
        if reg_path.exists():
            self.regressor = joblib.load(reg_path)
            
            meta_path = self.model_dir / "delay_regressor_metadata.json"
            if meta_path.exists():
                with open(meta_path) as f:
                    self.reg_metadata = json.load(f)
        
        # Load classification model
        clf_path = self.model_dir / "delay_classifier.pkl"
        if clf_path.exists():
            self.classifier = joblib.load(clf_path)
            
            meta_path = self.model_dir / "delay_classifier_metadata.json"
            if meta_path.exists():
                with open(meta_path) as f:
                    self.clf_metadata = json.load(f)
        
        if self.regressor is None and self.classifier is None:
            raise FileNotFoundError(f"No models found in {self.model_dir}")
        
        print(f"Loaded models from {self.model_dir}")
        if self.regressor:
            print(f"  - Regressor: MAE={self.reg_metadata.get('metrics', {}).get('mae', 'N/A'):.2f} min")
        if self.classifier:
            print(f"  - Classifier: F1={self.clf_metadata.get('metrics', {}).get('f1', 'N/A'):.3f}")
    
    def _prepare_features(self, raw_features: Dict) -> np.ndarray:
        """
        Prepare feature vector from raw input.
        
        Expected raw_features:
        {
            "line": "6",
            "vehicle_type": "METROBUS",
            "line_type": "BUS",
            "direction": "U Borgweg",
            "hour_of_day": 8,
            "day_of_week": 2,  # 1=Sunday, 7=Saturday
            "temperature_c": 10.5,
            "precipitation_mm": 0.0,
            "wind_speed_kmh": 15.0,
            "weather_code": 3,
            "humidity_percent": 80,
            "cloud_cover_percent": 50
        }
        """
        feature_cols = self.feature_config["feature_columns"]
        
        # Calculate derived features
        hour = raw_features.get("hour_of_day", 12)
        day = raw_features.get("day_of_week", 3)
        
        is_rush_hour = 1 if (7 <= hour <= 9) or (16 <= hour <= 19) else 0
        is_weekend = 1 if day in [1, 7] else 0
        
        # Build feature vector
        features = []
        
        for col in feature_cols:
            if col == "is_rush_hour":
                features.append(is_rush_hour)
            elif col == "is_weekend":
                features.append(is_weekend)
            elif col.endswith("_idx"):
                # Categorical index - use simple hash mapping for now
                # In production, you'd use the same StringIndexer from training
                base_col = col.replace("_idx", "")
                val = raw_features.get(base_col, "unknown")
                features.append(hash(val) % 100)  # Simple hash encoding
            else:
                features.append(raw_features.get(col, 0))
        
        return np.array(features).reshape(1, -1)
    
    def predict_delay(self, features: Dict) -> float:
        """
        Predict delay in minutes.
        
        Args:
            features: Dictionary of feature values
            
        Returns:
            Predicted delay in minutes
        """
        if self.regressor is None:
            raise RuntimeError("Regression model not loaded")
        
        X = self._prepare_features(features)
        prediction = self.regressor.predict(X)[0]
        
        # Ensure non-negative
        return max(0.0, float(prediction))
    
    def predict_is_delayed(self, features: Dict) -> Dict:
        """
        Predict if transport will be delayed.
        
        Args:
            features: Dictionary of feature values
            
        Returns:
            Dict with prediction and probability
        """
        if self.classifier is None:
            raise RuntimeError("Classification model not loaded")
        
        X = self._prepare_features(features)
        prediction = self.classifier.predict(X)[0]
        probabilities = self.classifier.predict_proba(X)[0]
        
        threshold = self.clf_metadata.get("metrics", {}).get("delay_threshold", 2)
        
        return {
            "is_delayed": bool(prediction),
            "probability_delayed": float(probabilities[1]),
            "probability_on_time": float(probabilities[0]),
            "threshold_minutes": threshold
        }
    
    def predict_full(self, features: Dict) -> Dict:
        """
        Get both regression and classification predictions.
        
        Args:
            features: Dictionary of feature values
            
        Returns:
            Dict with all predictions and metadata
        """
        result = {
            "input_features": features,
            "timestamp": datetime.now().isoformat()
        }
        
        if self.regressor:
            result["predicted_delay_minutes"] = self.predict_delay(features)
        
        if self.classifier:
            result["classification"] = self.predict_is_delayed(features)
        
        return result
    
    def predict_batch(self, feature_list: List[Dict]) -> List[Dict]:
        """
        Predict for multiple inputs.
        
        Args:
            feature_list: List of feature dictionaries
            
        Returns:
            List of prediction results
        """
        return [self.predict_full(f) for f in feature_list]
    
    def get_model_info(self) -> Dict:
        """Get information about loaded models."""
        return {
            "model_dir": str(self.model_dir),
            "regressor": {
                "loaded": self.regressor is not None,
                "metrics": self.reg_metadata.get("metrics") if self.reg_metadata else None,
                "training_date": self.reg_metadata.get("training_date") if self.reg_metadata else None
            },
            "classifier": {
                "loaded": self.classifier is not None,
                "metrics": self.clf_metadata.get("metrics") if self.clf_metadata else None,
                "training_date": self.clf_metadata.get("training_date") if self.clf_metadata else None
            },
            "feature_columns": self.feature_config.get("feature_columns") if self.feature_config else None
        }


def create_features_from_transport_weather(
    transport_data: Dict,
    weather_data: Dict,
    timestamp: Optional[int] = None
) -> Dict:
    """
    Helper to create prediction features from raw transport and weather data.
    
    Args:
        transport_data: Journey/segment data from Geofox API
        weather_data: Weather data from Open-Meteo
        timestamp: Unix timestamp (default: from transport data)
        
    Returns:
        Feature dictionary ready for prediction
    """
    # Extract from transport data
    line = transport_data.get("line", {}).get("name", "unknown")
    vehicle_type = transport_data.get("vehicleType", "unknown")
    line_type = transport_data.get("line", {}).get("type", {}).get("simpleType", "unknown")
    direction = transport_data.get("line", {}).get("direction", "unknown")
    
    # Get timestamp
    if timestamp is None:
        segments = transport_data.get("segments", [])
        if segments:
            timestamp = segments[0].get("startDateTime", int(datetime.now().timestamp()))
        else:
            timestamp = int(datetime.now().timestamp())
    
    # Extract time features
    dt = datetime.fromtimestamp(timestamp)
    hour_of_day = dt.hour
    day_of_week = dt.isoweekday()  # 1=Monday, 7=Sunday
    # Convert to Spark's dayofweek (1=Sunday, 7=Saturday)
    day_of_week_spark = (day_of_week % 7) + 1
    
    return {
        "line": line,
        "vehicle_type": vehicle_type,
        "line_type": line_type,
        "direction": direction,
        "hour_of_day": hour_of_day,
        "day_of_week": day_of_week_spark,
        "temperature_c": weather_data.get("temperature_c", 10.0),
        "precipitation_mm": weather_data.get("precipitation_mm", 0.0),
        "wind_speed_kmh": weather_data.get("wind_speed_kmh", 10.0),
        "weather_code": weather_data.get("weather_code", 0),
        "humidity_percent": weather_data.get("humidity_percent", 70),
        "cloud_cover_percent": weather_data.get("cloud_cover_percent", 50)
    }


# Simple test/demo
if __name__ == "__main__":
    import sys
    
    # Default model directory
    model_dir = Path(__file__).parent.parent / "model"
    
    if len(sys.argv) > 1:
        model_dir = Path(sys.argv[1])
    
    print("="*60)
    print("Delay Predictor - Demo")
    print("="*60)
    
    # Check if models exist
    if not (model_dir / "delay_regressor.pkl").exists():
        print(f"\nNo trained models found in {model_dir}")
        print("Run train_model.py first to train the models.")
        print("\nDemo with mock prediction:")
        
        # Mock example
        example_features = {
            "line": "6",
            "vehicle_type": "METROBUS",
            "line_type": "BUS",
            "direction": "U Borgweg",
            "hour_of_day": 8,
            "day_of_week": 2,
            "temperature_c": 5.0,
            "precipitation_mm": 2.5,
            "wind_speed_kmh": 25.0,
            "weather_code": 61,
            "humidity_percent": 85,
            "cloud_cover_percent": 90
        }
        print(f"\nExample input features:")
        print(json.dumps(example_features, indent=2))
        sys.exit(0)
    
    # Load predictor
    predictor = DelayPredictor(str(model_dir))
    
    # Example prediction
    example_features = {
        "line": "6",
        "vehicle_type": "METROBUS",
        "line_type": "BUS",
        "direction": "U Borgweg",
        "hour_of_day": 8,  # Rush hour
        "day_of_week": 2,  # Monday
        "temperature_c": 5.0,
        "precipitation_mm": 2.5,  # Light rain
        "wind_speed_kmh": 25.0,
        "weather_code": 61,  # Light rain
        "humidity_percent": 85,
        "cloud_cover_percent": 90
    }
    
    print("\nExample prediction:")
    print(f"Input: {json.dumps(example_features, indent=2)}")
    
    result = predictor.predict_full(example_features)
    print(f"\nPrediction:")
    print(json.dumps(result, indent=2, default=str))
    
    print("\nModel info:")
    print(json.dumps(predictor.get_model_info(), indent=2, default=str))

