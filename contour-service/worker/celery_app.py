from celery import Celery
from api.settings import get_settings

settings = get_settings()

celery_app = Celery(
    'contour_worker',
    broker=settings.broker_url,
    backend=settings.result_backend,
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='UTC',
    enable_utc=True,
)
