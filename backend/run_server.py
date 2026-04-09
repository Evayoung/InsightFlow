"""Entry point script for running the FastAPI application with Uvicorn."""

import os

import uvicorn


if __name__ == "__main__":
    is_render = os.getenv("RENDER", "").lower() == "true"
    port = int(os.getenv("PORT", "8010"))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=not is_render,
    )
