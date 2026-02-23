from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError
from api.settings import get_settings


@dataclass
class StoredObject:
    body: bytes
    content_type: str


class ObjectStore:
    def put_bytes(self, key: str, body: bytes, content_type: str) -> None:
        raise NotImplementedError

    def get_bytes(self, key: str) -> StoredObject | None:
        raise NotImplementedError

    def exists(self, key: str) -> bool:
        raise NotImplementedError

    def delete_prefix(self, prefix: str) -> None:
        raise NotImplementedError


class S3ObjectStore(ObjectStore):
    def __init__(self) -> None:
        settings = get_settings()
        self.bucket = settings.s3_bucket
        self.client: BaseClient = boto3.client(
            's3',
            endpoint_url=settings.s3_endpoint,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            use_ssl=settings.s3_secure,
        )

    def put_bytes(self, key: str, body: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=body, ContentType=content_type)

    def get_bytes(self, key: str) -> StoredObject | None:
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=key)
        except ClientError:
            return None
        body = obj['Body'].read()
        return StoredObject(body=body, content_type=obj.get('ContentType', 'application/octet-stream'))

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False

    def delete_prefix(self, prefix: str) -> None:
        paginator = self.client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            contents = page.get('Contents', [])
            if not contents:
                continue
            self.client.delete_objects(
                Bucket=self.bucket,
                Delete={'Objects': [{'Key': c['Key']} for c in contents]},
            )


_store: ObjectStore | None = None


def get_store() -> ObjectStore:
    global _store
    if _store is None:
        _store = S3ObjectStore()
    return _store
