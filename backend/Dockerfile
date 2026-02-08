FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV PYTHONUNBUFFERED=1
ENV AWS_LWA_PORT=8000
ENV AWS_LWA_READINESS_CHECK_PATH=/health

ARG INCLUDE_LWA=0
RUN if [ "$INCLUDE_LWA" = "1" ]; then \
      apt-get update && apt-get install -y --no-install-recommends curl && \
      mkdir -p /opt/extensions && \
      curl -L -o /opt/extensions/aws-lambda-adapter https://github.com/awslabs/aws-lambda-web-adapter/releases/latest/download/aws-lambda-adapter && \
      chmod +x /opt/extensions/aws-lambda-adapter && \
      rm -rf /var/lib/apt/lists/*; \
    fi

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
