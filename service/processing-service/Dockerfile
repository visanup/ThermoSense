# Use a slim Python base
FROM python:3.11-slim

# Create non-root user for safety
RUN useradd --create-home appuser

WORKDIR /app

# Install system dependencies needed for OpenCV and other operations
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       libglib2.0-0 \
       libsm6 \
       libxext6 \
       libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
# upgrade packaging tools first to avoid old resolver issues
RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY app/ ./app

# Ensure environment variables are not buffered
ENV PYTHONUNBUFFERED=1

# Switch to non-root user
USER appuser

# Entry point: run the processing service (adjust if using separate runner)
CMD ["python", "-m", "app.main"]