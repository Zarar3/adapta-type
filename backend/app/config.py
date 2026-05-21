from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    allowed_origin: str = "http://localhost:5173"
    sentry_dsn: str = ""
    environment: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
