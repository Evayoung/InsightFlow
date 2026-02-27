from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    APP_NAME: str = "InsightFlow Backend"
    APP_SLUG: str = "insightflow-backend"
    APP_VERSION: str = "0.1.0"

    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/insightflow"

    SECRET_KEY: str = "change-this-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAILS_FROM_EMAIL: str | None = None
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:8000"]
    PASSWORD_RESET_URL_BASE: str = "http://localhost:3000/reset-password"


settings = Settings()
