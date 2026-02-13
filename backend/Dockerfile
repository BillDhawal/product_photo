# AWS Lambda Python base image - use arm64 to match Lambda function architecture
FROM public.ecr.aws/lambda/python:3.12-arm64

# Copy requirements and install
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Copy application code
COPY main.py agent.py lambda_handler.py ${LAMBDA_TASK_ROOT}/

# Lambda handler (Mangum wraps FastAPI for API Gateway)
CMD ["lambda_handler.handler"]
