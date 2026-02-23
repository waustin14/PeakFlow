from fastapi import Header, HTTPException, status
from api.settings import get_settings


def require_api_key(x_api_key: str | None = Header(default=None), authorization: str | None = Header(default=None)) -> str:
    settings = get_settings()
    key = x_api_key
    if not key and authorization and authorization.lower().startswith('bearer '):
        key = authorization[7:].strip()

    if not key or key not in settings.api_key_set:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='invalid API key')
    return key
