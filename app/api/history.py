"""
History data module using PySpark for processing JSONL journey data.

Provides functions to query historical delay data for the dashboard.
Uses Spark for efficient data processing even with local mode.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    explode, col, avg, max as spark_max, min as spark_min,
    count, sum as spark_sum, when, floor, from_unixtime,
    hour, dayofweek, collect_list, first, struct, array_agg
)
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType,
    LongType, BooleanType, ArrayType
)
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any


# Singleton SparkSession
_spark: Optional[SparkSession] = None


def get_spark_session() -> SparkSession:
    """Get or create SparkSession for the API."""
    global _spark
    if _spark is None:
        _spark = SparkSession.builder \
            .appName("DBPrangerDashboard") \
            .config("spark.driver.memory", "1g") \
            .config("spark.sql.legacy.timeParserPolicy", "LEGACY") \
            .config("spark.ui.enabled", "false") \
            .master("local[*]") \
            .getOrCreate()
        
        # Set log level to reduce noise
        _spark.sparkContext.setLogLevel("WARN")
        print("Spark session created for Dashboard API")
    
    return _spark


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


class SparkHistoryManager:
    """
    Manages historical journey data using PySpark.
    
    Uses Spark for efficient querying and aggregation.
    """
    
    def __init__(self, data_dir: Optional[str] = None):
        """Initialize with data directory path."""
        if data_dir is None:
            # /db_pranger/data in Docker
            self.data_dir = Path("/db_pranger/data")
        else:
            self.data_dir = Path(data_dir)
        
        print(f"Loading data from: {self.data_dir}")
        
        self.spark = get_spark_session()
        self._df = None
        self._load_data()
    
    def _load_data(self):
        """Load all JSONL files using Spark."""
        jsonl_pattern = str(self.data_dir / "*.jsonl")
        
        try:
            schema = get_transport_schema()
            raw_df = self.spark.read.schema(schema).json(jsonl_pattern)
            
            # Flatten: explode journeys, then segments
            self._df = raw_df \
                .select(
                    col("ingestion_iso"),
                    explode("journeys").alias("journey")
                ) \
                .select(
                    col("ingestion_iso"),
                    col("journey.journeyID").alias("journey_id"),
                    col("journey.line.name").alias("line"),
                    col("journey.line.direction").alias("direction"),
                    col("journey.line.type.simpleType").alias("line_type"),
                    col("journey.vehicleType").alias("vehicle_type"),
                    explode("journey.segments").alias("segment")
                ) \
                .select(
                    col("ingestion_iso"),
                    col("journey_id"),
                    col("line"),
                    col("direction"),
                    col("line_type"),
                    col("vehicle_type"),
                    col("segment.startStationName").alias("start_station"),
                    col("segment.endStationName").alias("end_station"),
                    col("segment.startDateTime").alias("start_timestamp"),
                    col("segment.realtimeDelay").alias("delay_minutes")
                ) \
                .cache()  # Cache for repeated queries
            
            count = self._df.count()
            print(f"Loaded {count} segment records via Spark")
            
        except Exception as e:
            print(f"Error loading data with Spark: {e}")
            # Create empty DataFrame with schema
            self._df = self.spark.createDataFrame([], schema=StructType([
                StructField("journey_id", StringType(), True),
                StructField("line", StringType(), True),
                StructField("direction", StringType(), True),
                StructField("line_type", StringType(), True),
                StructField("vehicle_type", StringType(), True),
                StructField("delay_minutes", IntegerType(), True),
                StructField("start_timestamp", LongType(), True),
            ]))
    
    def get_all_journeys(
        self,
        limit: int = 100,
        offset: int = 0,
        line: Optional[str] = None,
        vehicle_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get journeys with pagination using Spark.
        """
        df = self._df
        
        if line:
            df = df.filter(col("line") == line)
        
        if vehicle_type:
            df = df.filter(col("vehicle_type") == vehicle_type)
        
        total = df.count()
        
        # Get paginated results
        journeys = df.limit(offset + limit).collect()[offset:]
        
        return {
            "journeys": [row.asDict() for row in journeys],
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total
        }
    
    def get_delay_stats(self) -> Dict[str, Any]:
        """
        Calculate overall delay statistics using Spark aggregations.
        """
        if self._df.isEmpty():
            return {
                "avg_delay_minutes": 0,
                "max_delay_minutes": 0,
                "min_delay_minutes": 0,
                "delayed_percentage": 0,
                "total_journeys": 0,
                "total_segments": 0
            }
        
        # Use Spark aggregations
        stats = self._df.agg(
            avg("delay_minutes").alias("avg_delay"),
            spark_max("delay_minutes").alias("max_delay"),
            spark_min("delay_minutes").alias("min_delay"),
            count("*").alias("total_segments"),
            spark_sum(when(col("delay_minutes") > 2, 1).otherwise(0)).alias("delayed_count")
        ).collect()[0]
        
        # Count unique journeys
        total_journeys = self._df.select("journey_id").distinct().count()
        
        total_segments = stats["total_segments"] or 0
        delayed_count = stats["delayed_count"] or 0
        
        return {
            "avg_delay_minutes": round(float(stats["avg_delay"] or 0), 2),
            "max_delay_minutes": int(stats["max_delay"] or 0),
            "min_delay_minutes": int(stats["min_delay"] or 0),
            "delayed_percentage": round((delayed_count / total_segments) * 100, 1) if total_segments > 0 else 0,
            "total_journeys": total_journeys,
            "total_segments": total_segments
        }
    
    def get_stats_by_line(self) -> List[Dict[str, Any]]:
        """
        Get delay statistics grouped by line using Spark.
        """
        if self._df.isEmpty():
            return []
        
        # Group by line and aggregate
        line_stats = self._df.groupBy("line", "vehicle_type", "line_type").agg(
            avg("delay_minutes").alias("avg_delay"),
            spark_max("delay_minutes").alias("max_delay"),
            count("*").alias("total_segments"),
            spark_sum(when(col("delay_minutes") > 2, 1).otherwise(0)).alias("delayed_count")
        ).collect()
        
        result = []
        for row in line_stats:
            avg_delay = float(row["avg_delay"] or 0)
            total = row["total_segments"] or 0
            delayed = row["delayed_count"] or 0
            delayed_pct = (delayed / total) * 100 if total > 0 else 0
            
            # Determine status
            if avg_delay < 2:
                status = "good"
            elif avg_delay < 5:
                status = "warning"
            else:
                status = "critical"
            
            result.append({
                "line": row["line"],
                "vehicle_type": row["vehicle_type"],
                "line_type": row["line_type"],
                "avg_delay_minutes": round(avg_delay, 2),
                "max_delay_minutes": int(row["max_delay"] or 0),
                "delayed_percentage": round(delayed_pct, 1),
                "total_segments": total,
                "status": status
            })
        
        # Sort by average delay descending
        result.sort(key=lambda x: x["avg_delay_minutes"], reverse=True)
        return result
    
    def get_delays_over_time(
        self,
        hours: int = 24,
        bucket_minutes: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Get delay data bucketed over time using Spark.
        """
        if self._df.isEmpty():
            return []
        
        bucket_seconds = bucket_minutes * 60
        
        # Create time buckets and aggregate
        bucketed = self._df \
            .withColumn(
                "bucket_ts",
                (floor(col("start_timestamp") / bucket_seconds) * bucket_seconds)
            ) \
            .withColumn(
                "bucket_time",
                from_unixtime(col("bucket_ts"))
            ) \
            .groupBy("bucket_time") \
            .agg(
                avg("delay_minutes").alias("avg_delay"),
                spark_max("delay_minutes").alias("max_delay"),
                spark_min("delay_minutes").alias("min_delay"),
                count("*").alias("count")
            ) \
            .orderBy("bucket_time") \
            .collect()
        
        return [
            {
                "timestamp": row["bucket_time"],
                "avg_delay": round(float(row["avg_delay"] or 0), 2),
                "max_delay": int(row["max_delay"] or 0),
                "min_delay": int(row["min_delay"] or 0),
                "count": row["count"]
            }
            for row in bucketed
        ]
    
    def get_unique_lines(self) -> List[Dict[str, str]]:
        """Get list of unique lines using Spark."""
        if self._df.isEmpty():
            return []
        
        lines = self._df \
            .select("line", "vehicle_type", "line_type", "direction") \
            .dropDuplicates(["line"]) \
            .collect()
        
        return sorted(
            [
                {
                    "name": row["line"],
                    "vehicle_type": row["vehicle_type"],
                    "line_type": row["line_type"],
                    "direction": row["direction"]
                }
                for row in lines
            ],
            key=lambda x: x["name"] or ""
        )
    
    def get_heatmap_data(self) -> List[Dict[str, Any]]:
        """
        Get delay data aggregated by hour of day and day of week.
        
        Returns a grid for heatmap visualization:
        - X-axis: Hour (0-23)
        - Y-axis: Day of week (1=Sunday, 7=Saturday)
        """
        if self._df.isEmpty():
            return []
        
        # Extract hour and day of week from timestamp
        heatmap_data = self._df \
            .withColumn("hour_of_day", hour(from_unixtime(col("start_timestamp")))) \
            .withColumn("day_of_week", dayofweek(from_unixtime(col("start_timestamp")))) \
            .groupBy("hour_of_day", "day_of_week") \
            .agg(
                avg("delay_minutes").alias("avg_delay"),
                spark_max("delay_minutes").alias("max_delay"),
                count("*").alias("count"),
                spark_sum(when(col("delay_minutes") > 2, 1).otherwise(0)).alias("delayed_count")
            ) \
            .orderBy("day_of_week", "hour_of_day") \
            .collect()
        
        # Map day numbers to names
        day_names = {
            1: "Sonntag",
            2: "Montag", 
            3: "Dienstag",
            4: "Mittwoch",
            5: "Donnerstag",
            6: "Freitag",
            7: "Samstag"
        }
        
        return [
            {
                "hour": row["hour_of_day"],
                "day_of_week": row["day_of_week"],
                "day_name": day_names.get(row["day_of_week"], "Unknown"),
                "avg_delay": round(float(row["avg_delay"] or 0), 2),
                "max_delay": int(row["max_delay"] or 0),
                "count": row["count"],
                "delayed_percentage": round(
                    (row["delayed_count"] / row["count"]) * 100, 1
                ) if row["count"] > 0 else 0
            }
            for row in heatmap_data
        ]
    
    def get_journeys_by_line(
        self,
        line: str,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Get all journeys for a specific line with their segments.
        
        Returns journeys grouped with segment details for carousel display.
        """
        if self._df.isEmpty():
            return {"line": line, "journeys": [], "total": 0}
        
        # Filter by line
        line_df = self._df.filter(col("line") == line)
        
        if line_df.isEmpty():
            return {"line": line, "journeys": [], "total": 0}
        
        # Group segments by journey_id
        journeys_df = line_df.groupBy(
            "journey_id", "line", "direction", "vehicle_type", "line_type"
        ).agg(
            avg("delay_minutes").alias("avg_delay"),
            spark_max("delay_minutes").alias("max_delay"),
            spark_min("delay_minutes").alias("min_delay"),
            count("*").alias("segment_count"),
            first("start_station").alias("first_station"),
            spark_max("end_station").alias("last_station"),
            spark_min("start_timestamp").alias("start_time"),
            spark_max("start_timestamp").alias("end_time")
        ).orderBy(col("avg_delay").desc())
        
        total = journeys_df.count()
        journeys = journeys_df.limit(limit).collect()
        
        result = []
        for row in journeys:
            avg_delay = float(row["avg_delay"] or 0)
            
            # Determine status
            if avg_delay < 2:
                status = "good"
            elif avg_delay < 5:
                status = "warning"
            else:
                status = "critical"
            
            result.append({
                "journey_id": row["journey_id"],
                "line": row["line"],
                "direction": row["direction"],
                "vehicle_type": row["vehicle_type"],
                "line_type": row["line_type"],
                "avg_delay_minutes": round(avg_delay, 2),
                "max_delay_minutes": int(row["max_delay"] or 0),
                "min_delay_minutes": int(row["min_delay"] or 0),
                "segment_count": row["segment_count"],
                "first_station": row["first_station"],
                "last_station": row["last_station"],
                "start_time": row["start_time"],
                "end_time": row["end_time"],
                "status": status
            })
        
        return {
            "line": line,
            "journeys": result,
            "total": total,
            "limit": limit
        }
    
    def get_journey_segments(self, journey_id: str) -> Dict[str, Any]:
        """
        Get all segments for a specific journey.
        
        Returns detailed segment information for journey detail view.
        """
        if self._df.isEmpty():
            return {"journey_id": journey_id, "segments": []}
        
        # Filter by journey_id
        segments_df = self._df.filter(col("journey_id") == journey_id) \
            .orderBy("start_timestamp")
        
        segments = segments_df.collect()
        
        if not segments:
            return {"journey_id": journey_id, "segments": []}
        
        # Get journey metadata from first segment
        first_seg = segments[0]
        
        return {
            "journey_id": journey_id,
            "line": first_seg["line"],
            "direction": first_seg["direction"],
            "vehicle_type": first_seg["vehicle_type"],
            "line_type": first_seg["line_type"],
            "segments": [
                {
                    "start_station": row["start_station"],
                    "end_station": row["end_station"],
                    "start_timestamp": row["start_timestamp"],
                    "delay_minutes": row["delay_minutes"],
                    "status": "good" if (row["delay_minutes"] or 0) < 2 
                              else "warning" if (row["delay_minutes"] or 0) < 5 
                              else "critical"
                }
                for row in segments
            ],
            "total_segments": len(segments),
            "avg_delay": round(
                sum(s["delay_minutes"] or 0 for s in segments) / len(segments), 2
            ) if segments else 0
        }


# Global instance (lazy loaded)
_history_manager: Optional[SparkHistoryManager] = None


def get_history_manager() -> SparkHistoryManager:
    """Get or create SparkHistoryManager instance."""
    global _history_manager
    if _history_manager is None:
        _history_manager = SparkHistoryManager()
    return _history_manager
