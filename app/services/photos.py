"""Bounded raster images shared by account settings and Portfolio Studio."""

import base64
import binascii
import io
from typing import Annotated

from PIL import Image
from pydantic import AfterValidator, StringConstraints

PREFIX = 'data:image/jpeg;base64,'
MAX_PHOTO_LENGTH = 180_000


def validate_photo(value: str) -> str:
    if not value:
        return value
    try:
        if not value.startswith(PREFIX):
            raise ValueError('Not a JPEG data URL')
        raw = base64.b64decode(value[len(PREFIX):], validate=True)
        with Image.open(io.BytesIO(raw), formats=['JPEG']) as image:
            if max(image.size) > 1280:
                raise ValueError('Image too large')
            image.load()
    except (ValueError, binascii.Error, OSError, Image.DecompressionBombError) as exc:
        raise ValueError('Use a supported JPEG image within the size limit.') from exc
    return value


Photo = Annotated[str, StringConstraints(max_length=MAX_PHOTO_LENGTH), AfterValidator(validate_photo)]
