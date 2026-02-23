from fastapi import FastAPI
from api.db import Base, engine
from api.routes.contours import router as contour_router

app = FastAPI(title='Contour Service', version='0.1.0')


@app.on_event('startup')
def startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get('/healthz')
def healthz() -> dict[str, str]:
    return {'status': 'ok'}


app.include_router(contour_router)
