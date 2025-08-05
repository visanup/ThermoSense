# OCR Service

`ocr-service` is a Python microservice that listens for processed image events, sends images to a multimodal LLM (Qwen 2.5) to extract temperature readings, and persists the results to PostgreSQL. It is built with FastAPI for health endpoints, pika for RabbitMQ integration, MinIO for object storage, and a simple orchestrator to run both the HTTP server and the consumer.

---

## Features

* **Multimodal LLM**: Uses Qwen 2.5 (`qwen2.5-vl-3b-instruct`) to read temperature directly from images (base64-encoded).
* **Lightweight**: No local OCR dependencies (Tesseract/OpenCV) required—LLM handles image understanding.
* **RabbitMQ Consumer**: Listens on `processed.created` queue for new processed images.
* **MinIO Integration**: Downloads images from a configurable raw/processed bucket, uploads if needed.
* **PostgreSQL Storage**: Writes temperature readings to `temperature_readings` table and updates `image_objects` status.
* **FastAPI Health Endpoints**: `/health` and `/ready` to monitor RabbitMQ and MinIO connectivity.
* **Graceful Shutdown**: Handles `SIGINT`/`SIGTERM`, stops consumers and HTTP server cleanly.

---

## Prerequisites

* Python 3.11+
* RabbitMQ (with exchange & queues configured)
* MinIO (or S3-compatible object storage)
* PostgreSQL
* Qwen 2.5 LLM server (multimodal endpoint at `/v1/chat/completions`)

---

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/ocr-service.git
   cd ocr-service
   ```
2. Create a virtual environment and install dependencies:

   ```bash
   python -m venv venv
   source venv/bin/activate  # on Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Create a `.env` file in the project root with the following variables:

   ```ini
   # RabbitMQ
   RABBITMQ_URL=amqp://user:pass@rabbitmq:5672/
   RABBITMQ_QUEUE_PROCESSED=processed.created
   RABBITMQ_EXCHANGE=thermo-exchange
   PROCESSED_ROUTING_KEY=processed.created

   # MinIO
   MINIO_ENDPOINT=minio:9000
   MINIO_ROOT_USER=minio
   MINIO_ROOT_PASSWORD=minio123
   MINIO_SECURE=false
   MINIO_RAW_BUCKET=thermo-raw
   MINIO_PROCESSED_BUCKET=thermo-processed

   # Database
   DATABASE_URL=postgresql://user:pass@postgres:5432/thermo

   # LLM Server
   LMSTUDIO_URL=http://localhost:4000/v1/chat/completions

   # Service
   PROCESSING_SERVICE_PORT=5102
   ```

---

## Configuration

All environment variables are loaded via `python-dotenv` in `app/config.py`. Adjust as needed:

| Variable                   | Description                            | Default                                        |
| -------------------------- | -------------------------------------- | ---------------------------------------------- |
| `RABBITMQ_URL`             | Connection URL for RabbitMQ            | `amqp://guest:guest@localhost:5672/`           |
| `RABBITMQ_QUEUE_PROCESSED` | Name of the queue for processed images | `processed.created`                            |
| `RABBITMQ_EXCHANGE`        | RabbitMQ exchange name                 | `thermo-exchange`                              |
| `PROCESSED_ROUTING_KEY`    | Routing key for processed events       | `processed.created`                            |
| `MINIO_ENDPOINT`           | Host\:port of MinIO/S3                 | `localhost:9000`                               |
| `MINIO_ROOT_USER`          | MinIO access key                       | `minio`                                        |
| `MINIO_ROOT_PASSWORD`      | MinIO secret key                       | `minio123`                                     |
| `MINIO_SECURE`             | Use SSL (true/false)                   | `false`                                        |
| `MINIO_RAW_BUCKET`         | Name of raw-images bucket              | `thermo-raw`                                   |
| `MINIO_PROCESSED_BUCKET`   | Name of processed-images bucket        | `thermo-processed`                             |
| `DATABASE_URL`             | SQLAlchemy database URL                | `postgresql://user:pass@localhost:5432/thermo` |
| `LMSTUDIO_URL`             | Multimodal chat-completions endpoint   | `http://localhost:4000/v1/chat/completions`    |
| `PROCESSING_SERVICE_PORT`  | Port for FastAPI health server         | `5102`                                         |

---

## Running the Service

Start the service (starts HTTP health server and RabbitMQ consumer):

```bash
python -m app.main
```

Alternatively, using Uvicorn directly:

```bash
uvicorn app.main:main --host 0.0.0.0 --port 5102
```

Logs will show health checks, downloads/uploads, and processing steps.

---

## Endpoints

* **GET /**: Root ping - `{"message": "processing-service is alive"}`
* **GET /health**: Checks RabbitMQ & MinIO (returns 200 or 503 with details)
* **GET /ready**: Readiness - 200 if all dependencies OK, else 503

---

## Testing Locally

Use the provided `test_processor.py` to test LLM-only pipeline without running RabbitMQ:

```bash
python test_processor.py
```

Ensure `.env` is loaded and path to test image is correct.

---

## Future Improvements

* Add Prometheus metrics (`prometheus-client`)
* Structured logging with JSON formatter
* Retry/backoff for LLM calls
* Dockerfile & docker-compose setup
* Support for additional image-based readings (e.g., humidity)

---

## License

MIT © Your Company
