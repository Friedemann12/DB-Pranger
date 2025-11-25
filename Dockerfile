# Dockerfile for running the Geofox transport data collector
FROM python:3.11-slim

WORKDIR /app

# Install only the dependencies needed for data ingestion
RUN pip install --no-cache-dir \
    requests>=2.32.0 \
    python-dotenv>=1.0.0

# Copy only the data ingestion script
COPY /app/data_ingestion/create_history.py create_history.py

# Create data directory for output files
RUN mkdir -p /app/data

# Set working directory to data folder so files are written there
WORKDIR /app/data

# Environment variables (set these in Coolify)
# GTI_USER=your_user
# GTI_PASSWORD=your_password

# Run the collector
CMD ["python", "/app/create_history.py"]

