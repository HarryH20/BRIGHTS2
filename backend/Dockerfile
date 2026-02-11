FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser

COPY . .

# Create logs directory and set ownership before switching user
RUN mkdir -p /app/logs && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Declare the logs volume so Docker initializes it with correct ownership
VOLUME /app/logs

EXPOSE 5000

CMD ["python", "app.py"]
