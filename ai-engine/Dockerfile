# AI Semantic Engine - Dockerfile (Python Version)
FROM python:3.11-slim

LABEL maintainer="Onlitec <dev@onlitec.com>"
LABEL description="AI Semantic Engine for Email Security"

WORKDIR /app

# Install system dependencies
# curl: for healthcheck
# build-essential: for compiling some python packages if needed
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage cache
COPY requirements.txt .

# Install Python dependencies
# Using --no-cache-dir to keep image small
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
