import os
import base64
import binascii
from fastapi import HTTPException
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
import jwt

load_dotenv()

auth_scheme = HTTPBearer(auto_error=False)
TWITCH_JWK_URL = "https://id.twitch.tv/oauth2/keys"
DEV_AUTH_BYPASS = os.getenv("DEV_AUTH_BYPASS", "true").lower() in {"1", "true", "yes"}

raw_secret = os.getenv("TWITCH_EXT_SECRET", "")

try:
    twitch_ext_secret = base64.b64decode(raw_secret) if raw_secret else b""
except (binascii.Error, ValueError):
    if DEV_AUTH_BYPASS:
        twitch_ext_secret = b""
    else:
        raise RuntimeError(
            "TWITCH_EXT_SECRET must be a valid base64 Twitch Extension shared secret "
            "when DEV_AUTH_BYPASS=false."
        )


def verify_and_decode_jwt(token: str):
    if DEV_AUTH_BYPASS:
        return {"role": "broadcaster", "channel_id": "dev"}

    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    try:
        return jwt.decode(token, twitch_ext_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=403, detail="Invalid token")


def verify_optional_credentials(credentials):
    if credentials is None:
        return verify_and_decode_jwt("")
    return verify_and_decode_jwt(credentials.credentials)
