"""
ML Model Training for Delay Prediction.

Uses PySpark for data loading and preprocessing, then trains with scikit-learn.
This hybrid approach works well for prototype/medium datasets.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, when
from pyspark.ml.feature import StringIndexer, VectorAssembler
from pyspark.ml import Pipeline

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score, 
    classification_report
)
import joblib
from pathlib import Path
from datetime import datetime

from delay_pipeline import create_spark_session, create_ml_dataset


def prepare_features_spark(df):
    """
    Use Spark ML to encode categorical features.
    Returns DataFrame with encoded features.
    """
    # String indexers for categorical columns
    categorical_cols = ["line", "vehicle_type", "line_type", "direction"]
    indexers = []
    indexed_cols = []
    
    for col_name in categorical_cols:
        # Check if column has non-null values
        indexer = StringIndexer(
            inputCol=col_name, 
            outputCol=f"{col_name}_idx",
            handleInvalid="keep"
        )
        indexers.append(indexer)
        indexed_cols.append(f"{col_name}_idx")
    
    # Build pipeline
    pipeline = Pipeline(stages=indexers)
    
    # Fit and transform
    model = pipeline.fit(df)
    encoded_df = model.transform(df)
    
    return encoded_df, indexed_cols


def spark_to_pandas_ml(spark_df, feature_cols, target_col):
    """
    Convert Spark DataFrame to pandas for sklearn training.
    Handles null values and prepares X, y arrays.
    """
    # Select only needed columns and drop nulls
    ml_df = spark_df.select(*feature_cols, target_col).dropna()
    
    # Convert to pandas
    pdf = ml_df.toPandas()
    
    X = pdf[feature_cols].values
    y = pdf[target_col].values
    
    return X, y, pdf


def train_regression_model(X_train, y_train, X_test, y_test):
    """
    Train a RandomForestRegressor to predict delay in minutes.
    """
    print("\n" + "="*50)
    print("Training REGRESSION model (predicting delay minutes)")
    print("="*50)
    
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    
    # Predictions
    y_pred = model.predict(X_test)
    
    # Metrics
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    print(f"\nRegression Results:")
    print(f"  MAE:  {mae:.2f} minutes")
    print(f"  RMSE: {rmse:.2f} minutes")
    print(f"  R²:   {r2:.3f}")
    
    return model, {"mae": mae, "rmse": rmse, "r2": r2}


def train_classification_model(X_train, y_train, X_test, y_test, delay_threshold=2):
    """
    Train a RandomForestClassifier to predict if delayed (delay > threshold).
    """
    print("\n" + "="*50)
    print(f"Training CLASSIFICATION model (delay > {delay_threshold} min)")
    print("="*50)
    
    # Convert to binary classification
    y_train_class = (y_train > delay_threshold).astype(int)
    y_test_class = (y_test > delay_threshold).astype(int)
    
    print(f"Class distribution (train):")
    print(f"  Not delayed: {np.sum(y_train_class == 0)}")
    print(f"  Delayed:     {np.sum(y_train_class == 1)}")
    
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced"  # Handle imbalanced classes
    )
    
    model.fit(X_train, y_train_class)
    
    # Predictions
    y_pred = model.predict(X_test)
    
    # Metrics
    accuracy = accuracy_score(y_test_class, y_pred)
    precision = precision_score(y_test_class, y_pred, zero_division=0)
    recall = recall_score(y_test_class, y_pred, zero_division=0)
    f1 = f1_score(y_test_class, y_pred, zero_division=0)
    
    print(f"\nClassification Results:")
    print(f"  Accuracy:  {accuracy:.3f}")
    print(f"  Precision: {precision:.3f}")
    print(f"  Recall:    {recall:.3f}")
    print(f"  F1 Score:  {f1:.3f}")
    print(f"\nClassification Report:")
    print(classification_report(y_test_class, y_pred, 
                                target_names=["On Time", "Delayed"]))
    
    return model, {
        "accuracy": accuracy, 
        "precision": precision, 
        "recall": recall, 
        "f1": f1,
        "delay_threshold": delay_threshold
    }


def get_feature_importance(model, feature_names):
    """Extract and display feature importances."""
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]
    
    print("\nFeature Importances:")
    for i, idx in enumerate(indices[:10]):  # Top 10
        print(f"  {i+1}. {feature_names[idx]}: {importances[idx]:.4f}")
    
    return dict(zip(feature_names, importances))


def save_model(model, model_path: str, metadata: dict = None):
    """Save trained model and metadata."""
    Path(model_path).parent.mkdir(parents=True, exist_ok=True)
    
    # Save model
    joblib.dump(model, model_path)
    print(f"\nModel saved to: {model_path}")
    
    # Save metadata
    if metadata:
        metadata_path = model_path.replace(".pkl", "_metadata.json")
        import json
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2, default=str)
        print(f"Metadata saved to: {metadata_path}")


def run_training_pipeline(transport_path: str, weather_path: str, model_output_dir: str):
    """
    Complete training pipeline:
    1. Load and join data with Spark
    2. Prepare features
    3. Train both regression and classification models
    4. Save models
    """
    print("="*60)
    print("Delay Prediction - Model Training")
    print("="*60)
    print(f"Transport data: {transport_path}")
    print(f"Weather data:   {weather_path}")
    print(f"Model output:   {model_output_dir}")
    print("="*60)
    
    # Create Spark session
    spark = create_spark_session("DelayModelTraining")
    
    try:
        # 1. Create ML dataset
        print("\n[1/5] Creating ML dataset...")
        ml_df = create_ml_dataset(spark, transport_path, weather_path)
        
        # Check data size
        count = ml_df.count()
        print(f"Total records: {count}")
        
        if count < 100:
            print("\nWARNING: Very small dataset. Model may not be reliable.")
            print("Consider collecting more data before training.")
        
        # 2. Encode categorical features
        print("\n[2/5] Encoding categorical features...")
        encoded_df, indexed_cols = prepare_features_spark(ml_df)
        
        # 3. Define feature columns
        numeric_features = [
            "hour_of_day", "day_of_week", "is_rush_hour", "is_weekend",
            "temperature_c", "precipitation_mm", "wind_speed_kmh", 
            "weather_code", "humidity_percent", "cloud_cover_percent"
        ]
        
        feature_cols = numeric_features + indexed_cols
        target_col = "delay_minutes"
        
        print(f"Features: {feature_cols}")
        print(f"Target: {target_col}")
        
        # 4. Convert to pandas for sklearn
        print("\n[3/5] Converting to pandas...")
        X, y, pdf = spark_to_pandas_ml(encoded_df, feature_cols, target_col)
        
        print(f"Final dataset shape: X={X.shape}, y={y.shape}")
        print(f"Delay statistics:")
        print(f"  Mean: {np.mean(y):.2f} min")
        print(f"  Std:  {np.std(y):.2f} min")
        print(f"  Max:  {np.max(y):.2f} min")
        
        # 5. Train/test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        print(f"\nTrain size: {len(X_train)}, Test size: {len(X_test)}")
        
        # 6. Train models
        print("\n[4/5] Training models...")
        
        # Regression model
        reg_model, reg_metrics = train_regression_model(
            X_train, y_train, X_test, y_test
        )
        reg_importance = get_feature_importance(reg_model, feature_cols)
        
        # Classification model
        clf_model, clf_metrics = train_classification_model(
            X_train, y_train, X_test, y_test, delay_threshold=2
        )
        clf_importance = get_feature_importance(clf_model, feature_cols)
        
        # 7. Save models
        print("\n[5/5] Saving models...")
        
        Path(model_output_dir).mkdir(parents=True, exist_ok=True)
        
        # Regression model
        reg_metadata = {
            "model_type": "RandomForestRegressor",
            "feature_columns": feature_cols,
            "target": target_col,
            "metrics": reg_metrics,
            "feature_importance": reg_importance,
            "training_date": datetime.now().isoformat(),
            "training_samples": len(X_train),
            "test_samples": len(X_test)
        }
        save_model(
            reg_model, 
            f"{model_output_dir}/delay_regressor.pkl",
            reg_metadata
        )
        
        # Classification model
        clf_metadata = {
            "model_type": "RandomForestClassifier",
            "feature_columns": feature_cols,
            "target": f"delay > {clf_metrics['delay_threshold']} min",
            "metrics": clf_metrics,
            "feature_importance": clf_importance,
            "training_date": datetime.now().isoformat(),
            "training_samples": len(X_train),
            "test_samples": len(X_test)
        }
        save_model(
            clf_model,
            f"{model_output_dir}/delay_classifier.pkl",
            clf_metadata
        )
        
        # Save feature columns for prediction
        import json
        with open(f"{model_output_dir}/feature_config.json", "w") as f:
            json.dump({
                "feature_columns": feature_cols,
                "numeric_features": numeric_features,
                "categorical_columns": ["line", "vehicle_type", "line_type", "direction"],
                "indexed_columns": indexed_cols
            }, f, indent=2)
        
        print("\n" + "="*60)
        print("Training complete!")
        print("="*60)
        
        return reg_model, clf_model
        
    finally:
        spark.stop()


if __name__ == "__main__":
    import sys
    
    # Default paths
    data_dir = Path(__file__).parent.parent / "data_ingestion"
    model_dir = Path(__file__).parent.parent / "model"
    
    transport_path = str(data_dir / "geofox_grid_*.jsonl")
    weather_path = str(data_dir / "weather_*.jsonl")
    model_output_dir = str(model_dir)
    
    # Allow overriding via command line
    if len(sys.argv) > 1:
        transport_path = sys.argv[1]
    if len(sys.argv) > 2:
        weather_path = sys.argv[2]
    if len(sys.argv) > 3:
        model_output_dir = sys.argv[3]
    
    run_training_pipeline(transport_path, weather_path, model_output_dir)

