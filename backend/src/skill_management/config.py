from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Default matches the local database from compose.yaml
    database_url: str = "postgresql+psycopg://skills:skills@localhost:5433/skills"


settings = Settings()
