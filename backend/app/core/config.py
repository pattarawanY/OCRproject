from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_name: str = "CS SmartClaim API"
    database_url: str = "postgresql+psycopg://smartclaim:smartclaim@localhost:5432/smartclaim"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 8

    cors_origins: str = "http://localhost:3000"

    upload_dir: Path = BASE_DIR / "uploads"
    max_upload_mb: int = 10

    # "google" ใช้ Google Cloud Vision/Translation จริง, "mock" ใช้ข้อมูลจำลองสำหรับพัฒนา
    ocr_provider: str = "mock"
    translate_provider: str = "mock"
    google_application_credentials: str | None = None

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "CS SmartClaim <no-reply@smartclaim.local>"
    smtp_use_tls: bool = True

    # ฟอนต์ภาษาไทยสำหรับสร้าง PDF (เช่น THSarabunNew.ttf หรือ Garuda.ttf)
    pdf_font_path: str | None = None

    frontend_url: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
