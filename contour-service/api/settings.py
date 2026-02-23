from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    api_keys: str = Field(default='dev-key', alias='CONTOUR_API_KEYS')
    db_url: str = Field(alias='CONTOUR_DB_URL')
    broker_url: str = Field(alias='CONTOUR_BROKER_URL')
    result_backend: str = Field(alias='CONTOUR_RESULT_BACKEND')

    s3_endpoint: str = Field(alias='CONTOUR_S3_ENDPOINT')
    s3_region: str = Field(default='us-east-1', alias='CONTOUR_S3_REGION')
    s3_access_key: str = Field(alias='CONTOUR_S3_ACCESS_KEY')
    s3_secret_key: str = Field(alias='CONTOUR_S3_SECRET_KEY')
    s3_bucket: str = Field(alias='CONTOUR_S3_BUCKET')
    s3_secure: bool = Field(default=False, alias='CONTOUR_S3_SECURE')
    s3_prefix: str = Field(default='contours', alias='CONTOUR_S3_PREFIX')

    dem_catalog_path: str = Field(alias='CONTOUR_DEM_CATALOG')
    dem_root: str = Field(alias='CONTOUR_DEM_ROOT')
    tmp_root: str = Field(default='/tmp/contour', alias='CONTOUR_TMP_ROOT')

    max_aoi_sqmi: float = Field(default=5.0, alias='CONTOUR_MAX_AOI_SQMI')
    default_ttl_days: int = Field(default=30, alias='CONTOUR_DEFAULT_TTL_DAYS')
    algo_version: str = Field(default='v1', alias='CONTOUR_ALGO_VERSION')
    job_rate_limit_per_hour: int = Field(default=30, alias='CONTOUR_JOB_RATE_LIMIT_PER_HOUR')
    max_concurrent_per_tenant: int = Field(default=2, alias='CONTOUR_MAX_CONCURRENT_PER_TENANT')
    max_zoom: int = Field(default=18, alias='CONTOUR_MAX_ZOOM')

    @property
    def api_key_set(self) -> set[str]:
        return {k.strip() for k in self.api_keys.split(',') if k.strip()}


@lru_cache

def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]
