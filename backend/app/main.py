from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError

from app.api.router import api_router
from app.core.config import settings


PROJECT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_DIR / "frontend"


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)

    @app.exception_handler(ProgrammingError)
    async def handle_programming_error(_: Request, exc: ProgrammingError) -> JSONResponse:
        message = str(getattr(exc, "orig", exc)).lower()
        if "relation" in message and "does not exist" in message:
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Database schema is not initialized. Run migrations against the configured database.",
                    "code": "DB_SCHEMA_MISSING",
                },
            )
        return JSONResponse(
            status_code=503,
            content={"detail": "Database query failed.", "code": "DB_QUERY_FAILED"},
        )

    @app.exception_handler(OperationalError)
    async def handle_operational_error(_: Request, __: OperationalError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"detail": "Database connection failed.", "code": "DB_CONNECTION_FAILED"},
        )

    @app.exception_handler(SQLAlchemyError)
    async def handle_sqlalchemy_error(_: Request, __: SQLAlchemyError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"detail": "Database service is unavailable.", "code": "DB_UNAVAILABLE"},
        )

    if FRONTEND_DIR.exists():
        @app.get("/", include_in_schema=False)
        async def serve_frontend_index() -> FileResponse:
            return FileResponse(FRONTEND_DIR / "index.html")

        @app.get("/reset-password", include_in_schema=False)
        async def serve_reset_password(request: Request) -> RedirectResponse:
            target = "/reset-password.html"
            if request.url.query:
                target = f"{target}?{request.url.query}"
            return RedirectResponse(url=target, status_code=307)

        @app.get("/public/surveys/{public_slug}", include_in_schema=False)
        async def serve_public_survey(public_slug: str) -> RedirectResponse:
            return RedirectResponse(
                url=f"/public-survey.html?slug={public_slug}",
                status_code=307,
            )

        app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

    return app


app = create_app()
