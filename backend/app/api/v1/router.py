from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.feedback import public_router as public_feedback_router
from app.api.v1.endpoints.feedback import router as feedback_router
from app.api.v1.endpoints.projects import router as projects_router
from app.api.v1.endpoints.surveys import public_router as public_survey_router
from app.api.v1.endpoints.surveys import router as surveys_router
from app.api.v1.endpoints.workspaces import router as workspaces_router

api_v1_router = APIRouter()
api_v1_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_v1_router.include_router(workspaces_router, prefix="/workspaces", tags=["workspaces"])
api_v1_router.include_router(projects_router, tags=["projects"])
api_v1_router.include_router(surveys_router, tags=["surveys"])
api_v1_router.include_router(feedback_router, tags=["feedback"])
api_v1_router.include_router(public_survey_router, tags=["public"])
api_v1_router.include_router(public_feedback_router, tags=["public"])
