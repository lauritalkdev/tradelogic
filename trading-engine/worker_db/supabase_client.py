"""
TradeLogic - Server-Side Supabase Worker Client

Creates the privileged Supabase client used by TradeLogic's
Python trading workers.

SECURITY:
- Runs only on trusted TradeLogic VPS/server infrastructure.
- Uses the Supabase service-role key.
- Never exposes the service-role key to users or browsers.
- Reads configuration only from environment variables.
- Never prints or returns secrets.
"""

from __future__ import annotations

import os
from functools import lru_cache

from supabase import Client, create_client


class SupabaseWorkerConfigError(RuntimeError):
    """Raised when required Supabase worker configuration is missing."""


def _required_environment_value(
    name: str,
) -> str:
    value = os.getenv(
        name,
        "",
    ).strip()

    if not value:
        raise SupabaseWorkerConfigError(
            f"Required environment variable '{name}' is not configured."
        )

    return value


def get_supabase_url() -> str:
    """
    Return the Supabase project URL.

    Production workers should use:
        SUPABASE_URL

    NEXT_PUBLIC_SUPABASE_URL is accepted only as a development
    fallback because the project URL itself is not secret.
    """

    server_url = os.getenv(
        "SUPABASE_URL",
        "",
    ).strip()

    if server_url:
        return server_url.rstrip("/")

    public_url = os.getenv(
        "NEXT_PUBLIC_SUPABASE_URL",
        "",
    ).strip()

    if public_url:
        return public_url.rstrip("/")

    raise SupabaseWorkerConfigError(
        "Supabase URL is not configured. "
        "Set SUPABASE_URL in the worker environment."
    )


def get_service_role_key() -> str:
    """
    Return the server-only Supabase service-role key.

    There is deliberately no fallback to the anonymous or
    publishable Supabase key.
    """

    return _required_environment_value(
        "SUPABASE_SERVICE_ROLE_KEY"
    )


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """
    Create and cache TradeLogic's privileged Supabase worker client.

    Client creation is lazy, so merely importing this module does
    not require environment variables to have been configured yet.
    """

    url = get_supabase_url()
    service_role_key = get_service_role_key()

    try:
        return create_client(
            url,
            service_role_key,
        )

    except Exception as exc:
        raise SupabaseWorkerConfigError(
            "Unable to create the TradeLogic Supabase "
            f"worker client: {exc}"
        ) from exc


def clear_supabase_client_cache() -> None:
    """
    Clear the cached Supabase client.

    Useful during controlled testing or worker reinitialization
    when environment configuration has intentionally changed.
    """

    get_supabase_client.cache_clear()