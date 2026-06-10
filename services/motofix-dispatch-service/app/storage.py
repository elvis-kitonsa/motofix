# app/storage.py
"""
Cloud storage utilities for uploading media files.
Supports both AWS S3 and Cloudinary.
"""

import os
import logging
from typing import Optional, BinaryIO
from pathlib import Path
import boto3
import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)

STORAGE_PROVIDER = os.getenv("STORAGE_PROVIDER", "cloudinary")  # or "s3"


class StorageError(Exception):
    """Raised when storage operation fails"""
    pass


class CloudinaryStorage:
    """Upload files to Cloudinary"""

    def __init__(self):
        api_key = os.getenv("CLOUDINARY_API_KEY")
        api_secret = os.getenv("CLOUDINARY_API_SECRET")
        cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")

        if not all([api_key, api_secret, cloud_name]):
            raise StorageError("Cloudinary credentials not configured")

        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
        )
        logger.info("Cloudinary storage initialized")

    async def upload_file(
        self,
        file_path: str,
        file_type: str,
        request_id: str,
    ) -> dict:
        """
        Upload file to Cloudinary and return metadata.

        Args:
            file_path: Local path to file
            file_type: Type of file ('voice', 'photo', 'document')
            request_id: Associated request ID

        Returns:
            {
                'url': 'https://...',
                'file_type': 'voice',
                'size_kb': 45.2,
                'uploaded_at': '2026-01-27T10:30:00Z'
            }
        """
        try:
            # Determine resource type and folder
            if file_type == "voice":
                resource_type = "video"
                folder = "motofix/voice-notes"
                public_id = f"voice_{request_id}_{Path(file_path).stem}"
            elif file_type == "photo":
                resource_type = "image"
                folder = "motofix/photos"
                public_id = f"photo_{request_id}_{Path(file_path).stem}"
            else:
                resource_type = "raw"
                folder = "motofix/documents"
                public_id = f"doc_{request_id}_{Path(file_path).stem}"

            # Upload to Cloudinary
            result = cloudinary.uploader.upload(
                file_path,
                resource_type=resource_type,
                folder=folder,
                public_id=public_id,
                overwrite=False,
            )

            file_size_kb = result.get("bytes", 0) / 1024
            uploaded_at = result.get("created_at", "")

            return {
                "url": result["secure_url"],
                "file_type": file_type,
                "size_kb": round(file_size_kb, 1),
                "uploaded_at": uploaded_at,
            }

        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
            raise StorageError(f"Failed to upload to Cloudinary: {str(e)}")


class S3Storage:
    """Upload files to AWS S3"""

    def __init__(self):
        access_key = os.getenv("AWS_ACCESS_KEY_ID")
        secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        bucket_name = os.getenv("AWS_BUCKET_NAME")
        region = os.getenv("AWS_REGION", "us-east-1")

        if not all([access_key, secret_key, bucket_name]):
            raise StorageError("AWS S3 credentials not configured")

        self.s3_client = boto3.client(
            "s3",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )
        self.bucket_name = bucket_name
        logger.info(f"S3 storage initialized for bucket: {bucket_name}")

    async def upload_file(
        self,
        file_path: str,
        file_type: str,
        request_id: str,
    ) -> dict:
        """
        Upload file to S3 and return metadata.

        Args:
            file_path: Local path to file
            file_type: Type of file ('voice', 'photo', 'document')
            request_id: Associated request ID

        Returns:
            {
                'url': 'https://...',
                'file_type': 'voice',
                'size_kb': 45.2,
                'uploaded_at': '2026-01-27T10:30:00Z'
            }
        """
        try:
            from datetime import datetime

            # Determine S3 key and content type
            if file_type == "voice":
                prefix = "voice-notes"
                content_type = "audio/webm"
            elif file_type == "photo":
                prefix = "photos"
                content_type = "image/jpeg"
            else:
                prefix = "documents"
                content_type = "application/octet-stream"

            file_name = Path(file_path).name
            s3_key = f"motofix/{prefix}/req_{request_id}/{file_name}"

            # Get file size
            file_size = Path(file_path).stat().st_size
            file_size_kb = file_size / 1024

            # Upload to S3
            self.s3_client.upload_file(
                file_path,
                self.bucket_name,
                s3_key,
                ExtraArgs={"ContentType": content_type},
            )

            # Generate signed URL
            url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": s3_key},
                ExpiresIn=31536000,  # 1 year
            )

            return {
                "url": url,
                "file_type": file_type,
                "size_kb": round(file_size_kb, 1),
                "uploaded_at": datetime.utcnow().isoformat() + "Z",
            }

        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            raise StorageError(f"Failed to upload to S3: {str(e)}")


def get_storage():
    """Factory function to get appropriate storage provider"""
    if STORAGE_PROVIDER == "s3":
        return S3Storage()
    else:
        return CloudinaryStorage()
