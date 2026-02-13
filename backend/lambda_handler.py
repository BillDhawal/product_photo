"""Lambda handler wrapping FastAPI app with Mangum (for API Gateway HTTP API)."""
from main import app
from mangum import Mangum

handler = Mangum(app, lifespan="off")
