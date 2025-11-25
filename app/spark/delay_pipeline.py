"""
PySpark pipeline for processing transport and weather data.
Flattens nested JSONL, joins datasets, and prepares features for ML.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    explode, col, from_unixtime, hour, dayofweek, 
    when, floor, lit, concat_ws
)
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, 
    LongType, DoubleType, BooleanType, ArrayType
)
from pathlib import Path


def create_spark_session(app_name: str = "DelayPredictor") -> SparkSession:
    """Create and return a SparkSession."""
    return SparkSession.builder \
        .appName(app_name) \
        .config("spark.sql.legacy.timeParserPolicy", "LEGACY") \
        .getOrCreate()


def get_transport_schema():
    """Define schema for transport JSONL data."""
    segment_schema = StructType([
        StructField("startStopPointKey", StringType(), True),
        StructField("endStopPointKey", StringType(), True),
        StructField("startStationName", StringType(), True),
        StructField("startStationKey", StringType(), True),
        StructField("startDateTime", LongType(), True),
        StructField("endStationName", StringType(), True),
        StructField("endStationKey", StringType(), True),
        StructField("endDateTime", LongType(), True),
        StructField("destination", StringType(), True),
        StructField("realtimeDelay", IntegerType(), True),
        StructField("isFirst", BooleanType(), True),
        StructField("isLast", BooleanType(), True)
    ])
    
    line_type_schema = StructType([
        StructField("simpleType", StringType(), True),
        StructField("model", StringType(), True)
    ])
    
    line_schema = StructType([
        StructField("name", StringType(), True),
        StructField("direction", StringType(), True),
        StructField("origin", StringType(), True),
        StructField("type", line_type_schema, True),
        StructField("id", StringType(), True)
    ])
    
    journey_schema = StructType([
        StructField("journeyID", StringType(), True),
        StructField("line", line_schema, True),
        StructField("vehicleType", StringType(), True),
        StructField("realtime", BooleanType(), True),
        StructField("segments", ArrayType(segment_schema), True)
    ])
    
    return StructType([
        StructField("ingestion_iso", StringType(), True),
        StructField("box_index", IntegerType(), True),
        StructField("journeys", ArrayType(journey_schema), True)
    ])


def get_weather_schema():
    """Define schema for weather JSONL data."""
    location_schema = StructType([
        StructField("lat", DoubleType(), True),
        StructField("lon", DoubleType(), True),
        StructField("city", StringType(), True)
    ])
    
    return StructType([
        StructField("timestamp_iso", StringType(), True),
        StructField("timestamp_unix", LongType(), True),
        StructField("temperature_c", DoubleType(), True),
        StructField("precipitation_mm", DoubleType(), True),
        StructField("wind_speed_kmh", DoubleType(), True),
        StructField("weather_code", IntegerType(), True),
        StructField("humidity_percent", DoubleType(), True),
        StructField("cloud_cover_percent", DoubleType(), True),
        StructField("location", location_schema, True)
    ])


def load_transport_data(spark: SparkSession, path: str):
    """
    Load and flatten transport JSONL data.
    
    Returns DataFrame with columns:
    - ingestion_iso, line, vehicleType, lineType, journeyID
    - startStationName, endStationName, startDateTime, endDateTime
    - realtimeDelay (target variable)
    """
    schema = get_transport_schema()
    
    # Load JSONL
    df = spark.read.schema(schema).json(path)
    
    # Flatten: explode journeys, then explode segments
    flattened = df \
        .select(
            col("ingestion_iso"),
            col("box_index"),
            explode("journeys").alias("journey")
        ) \
        .select(
            col("ingestion_iso"),
            col("box_index"),
            col("journey.journeyID").alias("journey_id"),
            col("journey.line.name").alias("line"),
            col("journey.line.direction").alias("direction"),
            col("journey.line.type.simpleType").alias("line_type"),
            col("journey.vehicleType").alias("vehicle_type"),
            explode("journey.segments").alias("segment")
        ) \
        .select(
            col("ingestion_iso"),
            col("box_index"),
            col("journey_id"),
            col("line"),
            col("direction"),
            col("line_type"),
            col("vehicle_type"),
            col("segment.startStationName").alias("start_station"),
            col("segment.endStationName").alias("end_station"),
            col("segment.startDateTime").alias("start_timestamp"),
            col("segment.endDateTime").alias("end_timestamp"),
            col("segment.realtimeDelay").alias("delay_minutes"),
            col("segment.isFirst").alias("is_first_stop"),
            col("segment.isLast").alias("is_last_stop")
        )
    
    return flattened


def load_weather_data(spark: SparkSession, path: str):
    """Load weather JSONL data."""
    schema = get_weather_schema()
    return spark.read.schema(schema).json(path)


def join_transport_weather(transport_df, weather_df):
    """
    Join transport and weather data on timestamp.
    Weather is joined by rounding transport timestamp to nearest hour.
    """
    # Round transport timestamp to nearest hour for joining
    transport_with_hour = transport_df.withColumn(
        "weather_join_ts",
        (floor(col("start_timestamp") / 3600) * 3600).cast("long")
    )
    
    # Round weather timestamp to hour
    weather_hourly = weather_df.withColumn(
        "weather_join_ts", 
        (floor(col("timestamp_unix") / 3600) * 3600).cast("long")
    ).select(
        col("weather_join_ts"),
        col("temperature_c"),
        col("precipitation_mm"),
        col("wind_speed_kmh"),
        col("weather_code"),
        col("humidity_percent"),
        col("cloud_cover_percent")
    ).dropDuplicates(["weather_join_ts"])
    
    # Join
    joined = transport_with_hour.join(
        weather_hourly,
        on="weather_join_ts",
        how="left"
    )
    
    return joined


def add_time_features(df):
    """Add time-based features for ML."""
    return df \
        .withColumn("datetime", from_unixtime(col("start_timestamp"))) \
        .withColumn("hour_of_day", hour(from_unixtime(col("start_timestamp")))) \
        .withColumn("day_of_week", dayofweek(from_unixtime(col("start_timestamp")))) \
        .withColumn(
            "is_rush_hour",
            when(
                (col("hour_of_day").between(7, 9)) | 
                (col("hour_of_day").between(16, 19)),
                1
            ).otherwise(0)
        ) \
        .withColumn(
            "is_weekend",
            when(col("day_of_week").isin([1, 7]), 1).otherwise(0)
        )


def create_ml_dataset(spark: SparkSession, transport_path: str, weather_path: str):
    """
    Full pipeline: load, flatten, join, and prepare ML dataset.
    
    Returns DataFrame ready for ML with all features.
    """
    print("Loading transport data...")
    transport_df = load_transport_data(spark, transport_path)
    print(f"  -> {transport_df.count()} segment records")
    
    print("Loading weather data...")
    weather_df = load_weather_data(spark, weather_path)
    print(f"  -> {weather_df.count()} weather records")
    
    print("Joining datasets...")
    joined_df = join_transport_weather(transport_df, weather_df)
    
    print("Adding time features...")
    final_df = add_time_features(joined_df)
    
    # Select final columns for ML
    ml_df = final_df.select(
        # Identifiers
        col("journey_id"),
        col("start_station"),
        col("end_station"),
        
        # Categorical features
        col("line"),
        col("vehicle_type"),
        col("line_type"),
        col("direction"),
        
        # Time features
        col("hour_of_day"),
        col("day_of_week"),
        col("is_rush_hour"),
        col("is_weekend"),
        
        # Weather features
        col("temperature_c"),
        col("precipitation_mm"),
        col("wind_speed_kmh"),
        col("weather_code"),
        col("humidity_percent"),
        col("cloud_cover_percent"),
        
        # Target variable
        col("delay_minutes")
    )
    
    return ml_df


def save_ml_dataset(df, output_path: str, format: str = "parquet"):
    """Save prepared ML dataset."""
    df.write.mode("overwrite").format(format).save(output_path)
    print(f"Saved ML dataset to {output_path}")


if __name__ == "__main__":
    import sys
    
    # Default paths (relative to data_ingestion folder)
    data_dir = Path(__file__).parent.parent / "data_ingestion"
    
    transport_path = str(data_dir / "geofox_grid_*.jsonl")
    weather_path = str(data_dir / "weather_*.jsonl")
    output_path = str(Path(__file__).parent.parent / "model" / "ml_dataset")
    
    # Allow overriding via command line
    if len(sys.argv) > 1:
        transport_path = sys.argv[1]
    if len(sys.argv) > 2:
        weather_path = sys.argv[2]
    if len(sys.argv) > 3:
        output_path = sys.argv[3]
    
    print("=" * 60)
    print("Delay Prediction - Data Pipeline")
    print("=" * 60)
    print(f"Transport data: {transport_path}")
    print(f"Weather data:   {weather_path}")
    print(f"Output:         {output_path}")
    print("=" * 60)
    
    # Create Spark session
    spark = create_spark_session()
    
    try:
        # Run pipeline
        ml_df = create_ml_dataset(spark, transport_path, weather_path)
        
        # Show sample
        print("\nSample data:")
        ml_df.show(10, truncate=False)
        
        # Show schema
        print("\nSchema:")
        ml_df.printSchema()
        
        # Basic stats
        print("\nDelay statistics:")
        ml_df.describe("delay_minutes").show()
        
        # Save dataset
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        save_ml_dataset(ml_df, output_path)
        
    finally:
        spark.stop()

