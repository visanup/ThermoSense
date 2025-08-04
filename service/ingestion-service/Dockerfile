# ingestion-service/Dockerfile
FROM python:3.11-slim

# Create non-root user for safety
RUN useradd --create-home appuser

WORKDIR /app

# Install system dependencies (เพิ่ม curl ให้ healthcheck ใช้ได้)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       libglib2.0-0 \
       libsm6 \
       libxext6 \
       libxrender-dev \
       curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY app/ ./app

# Ensure environment variables are not buffered
ENV PYTHONUNBUFFERED=1

# Switch to non-root user
USER appuser

# Optional: expose port if HTTP health endpoint exists
EXPOSE 5101

# Run as module (ต้องมี app/__init__.py)
CMD ["python", "-m", "app.main"]
