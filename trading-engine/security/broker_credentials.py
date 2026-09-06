"""
TradeLogic - Broker Credential Decryption

Reproduces the exact broker credential format used by the
TradeLogic Next.js backend.

TypeScript format:
    v1.<base64url iv>.<base64url auth_tag>.<base64url ciphertext>

Encryption:
- AES-256-GCM
- 32-byte key supplied as exactly 64 hexadecimal characters
- 12-byte IV
- 16-byte GCM authentication tag
- UTF-8 plaintext

SECURITY:
- This module is server/VPS-only.
- The encryption key is read from the worker environment.
- The encryption key must never be logged or returned.
- Decrypted MT5 passwords must never be persisted in plaintext.
"""

from __future__ import annotations

import base64
import os
import re

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


ALGORITHM_VERSION = "v1"
IV_LENGTH = 12
AUTH_TAG_LENGTH = 16
KEY_LENGTH = 32
HEX_KEY_LENGTH = 64

_HEX_KEY_PATTERN = re.compile(
    rf"^[a-fA-F0-9]{{{HEX_KEY_LENGTH}}}$"
)


class BrokerCredentialError(RuntimeError):
    """Base error for TradeLogic broker credential operations."""


class BrokerCredentialConfigError(BrokerCredentialError):
    """Raised when the worker encryption key is missing or invalid."""


class BrokerCredentialFormatError(BrokerCredentialError):
    """Raised when encrypted broker credential data is malformed."""


class BrokerCredentialDecryptionError(BrokerCredentialError):
    """Raised when credential authentication or decryption fails."""


def _get_encryption_key() -> bytes:
    """
    Load and validate the AES-256-GCM key from the environment.

    This exactly mirrors the TypeScript requirement that the value
    be a 64-character hexadecimal string decoding to 32 bytes.
    """

    raw_key = os.getenv(
        "BROKER_CREDENTIAL_ENCRYPTION_KEY",
        "",
    ).strip()

    if not raw_key:
        raise BrokerCredentialConfigError(
            "BROKER_CREDENTIAL_ENCRYPTION_KEY is not configured."
        )

    if not _HEX_KEY_PATTERN.fullmatch(raw_key):
        raise BrokerCredentialConfigError(
            "BROKER_CREDENTIAL_ENCRYPTION_KEY must be a "
            "64-character hexadecimal value."
        )

    try:
        key = bytes.fromhex(raw_key)
    except ValueError as exc:
        raise BrokerCredentialConfigError(
            "BROKER_CREDENTIAL_ENCRYPTION_KEY is not valid hexadecimal."
        ) from exc

    if len(key) != KEY_LENGTH:
        raise BrokerCredentialConfigError(
            "BROKER_CREDENTIAL_ENCRYPTION_KEY must decode "
            "to exactly 32 bytes."
        )

    return key


def _decode_base64url(value: str) -> bytes:
    """
    Decode Node.js-compatible unpadded base64url data.

    Node's Buffer.toString('base64url') omits padding, so Python
    padding is restored before decoding.
    """

    if not value:
        raise BrokerCredentialFormatError(
            "Broker credential contains an empty encoded component."
        )

    padding = "=" * (-len(value) % 4)

    try:
        return base64.b64decode(
            value + padding,
            altchars=b"-_",
            validate=True,
        )
    except (ValueError, base64.binascii.Error) as exc:
        raise BrokerCredentialFormatError(
            "Broker credential contains invalid base64url data."
        ) from exc


def decrypt_broker_credential(
    encrypted_value: str,
) -> str:
    """
    Decrypt one TradeLogic broker credential.

    This mirrors the existing TypeScript implementation:

        v1.<iv>.<auth_tag>.<ciphertext>

    cryptography's AESGCM expects ciphertext and authentication tag
    together, while Node stores them separately. Therefore the tag is
    appended to the ciphertext before decryption.
    """

    if not encrypted_value:
        raise BrokerCredentialFormatError(
            "Encrypted broker credential cannot be empty."
        )

    parts = encrypted_value.split(".")

    if (
        len(parts) != 4
        or parts[0] != ALGORITHM_VERSION
    ):
        raise BrokerCredentialFormatError(
            "Unsupported broker credential format."
        )

    _, iv_value, tag_value, ciphertext_value = parts

    iv = _decode_base64url(iv_value)
    auth_tag = _decode_base64url(tag_value)
    ciphertext = _decode_base64url(ciphertext_value)

    if len(iv) != IV_LENGTH:
        raise BrokerCredentialFormatError(
            "Broker credential IV must be exactly 12 bytes."
        )

    if len(auth_tag) != AUTH_TAG_LENGTH:
        raise BrokerCredentialFormatError(
            "Broker credential authentication tag must "
            "be exactly 16 bytes."
        )

    key = _get_encryption_key()

    encrypted_payload = ciphertext + auth_tag

    try:
        plaintext = AESGCM(key).decrypt(
            iv,
            encrypted_payload,
            None,
        )
    except InvalidTag as exc:
        raise BrokerCredentialDecryptionError(
            "Broker credential authentication failed."
        ) from exc
    except Exception as exc:
        raise BrokerCredentialDecryptionError(
            "Unable to decrypt broker credential."
        ) from exc

    try:
        return plaintext.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise BrokerCredentialDecryptionError(
            "Decrypted broker credential is not valid UTF-8."
        ) from exc