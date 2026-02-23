FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser

COPY backend/ .
COPY analysis/ ./analysis/

# Create logs directory and set ownership before switching user
RUN mkdir -p /app/logs && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Declare the logs volume so Docker initializes it with correct ownership
VOLUME /app/logs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/')" 2>/dev/null || exit 1

CMD ["gunicorn", "--workers", "2", "--threads", "2", "--bind", "0.0.0.0:5000", "app:app"]
