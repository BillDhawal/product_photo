"""
Credit system: 8 credits/day per user, 4 credits per generation.
Uses Supabase for persistence. Root user and dgajwe@gmail.com have unlimited credits.
"""
import logging
import os
from datetime import datetime, timezone

log = logging.getLogger(__name__)

DAILY_CREDITS = 8
GENERATION_COST = 4
UNLIMITED_EMAILS = {"dgajwe@gmail.com"}
ROOT_USER_IDS = set()  # Add root user IDs if needed, e.g. {"user_xxx"}


def _supabase_configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


def _get_supabase():
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for credits")
    return create_client(url, key)


def has_unlimited_credits(user_id: str | None, email: str | None) -> bool:
    """Root user and dgajwe@gmail.com have unlimited credits."""
    if not user_id and not email:
        return False
    email_lower = (email or "").strip().lower()
    if email_lower in UNLIMITED_EMAILS:
        return True
    if user_id and user_id in ROOT_USER_IDS:
        return True
    return False


def get_credits_available(user_id: str, email: str | None = None) -> int:
    """
    Get available credits for user. Resets daily. Returns (daily_remaining + purchased).
    """
    if has_unlimited_credits(user_id, email):
        return 999999

    if not _supabase_configured():
        return DAILY_CREDITS  # Allow when not configured

    try:
        sb = _get_supabase()
        r = sb.table("user_credits").select("daily_credits_used, daily_reset_at, purchased_credits").eq("user_id", user_id).execute()
    except Exception as e:
        log.warning("credits get failed: %s", e)
        return DAILY_CREDITS  # Allow on error for now

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if not r.data or len(r.data) == 0:
        return DAILY_CREDITS

    row = r.data[0]
    daily_used = row.get("daily_credits_used") or 0
    reset_at = row.get("daily_reset_at")
    purchased = row.get("purchased_credits") or 0

    # Reset if we're in a new day
    if reset_at:
        try:
            reset_dt = datetime.fromisoformat(reset_at.replace("Z", "+00:00"))
            if reset_dt.date() < now.date():
                daily_used = 0
        except Exception:
            pass

    daily_remaining = max(0, DAILY_CREDITS - daily_used)
    return daily_remaining + purchased


def deduct_credits(user_id: str, email: str | None, cost: int = GENERATION_COST) -> bool:
    """
    Deduct credits. Returns True if successful. Resets daily if new day.
    """
    if has_unlimited_credits(user_id, email):
        return True

    if not _supabase_configured():
        return True  # Allow when not configured

    try:
        sb = _get_supabase()
        now = datetime.now(timezone.utc).isoformat()

        # Upsert: get or create row
        r = sb.table("user_credits").select("*").eq("user_id", user_id).execute()

        if not r.data or len(r.data) == 0:
            # New user: insert with cost already deducted
            sb.table("user_credits").insert({
                "user_id": user_id,
                "email": email,
                "daily_credits_used": cost,
                "daily_reset_at": now,
                "purchased_credits": 0,
                "updated_at": now,
            }).execute()
            return True

        row = r.data[0]
        daily_used = row.get("daily_credits_used") or 0
        reset_at = row.get("daily_reset_at")
        purchased = row.get("purchased_credits") or 0

        # Reset daily if new day
        if reset_at:
            try:
                reset_dt = datetime.fromisoformat(reset_at.replace("Z", "+00:00"))
                if reset_dt.date() < datetime.now(timezone.utc).date():
                    daily_used = 0
            except Exception:
                pass

        # Use purchased first, then daily
        remaining = (DAILY_CREDITS - daily_used) + purchased
        if remaining < cost:
            return False

        # Deduct from daily first
        if daily_used + cost <= DAILY_CREDITS:
            new_daily = daily_used + cost
            new_purchased = purchased
        else:
            overflow = (daily_used + cost) - DAILY_CREDITS
            new_daily = DAILY_CREDITS
            new_purchased = max(0, purchased - overflow)

        sb.table("user_credits").update({
            "daily_credits_used": new_daily,
            "daily_reset_at": now,
            "purchased_credits": new_purchased,
            "email": email,
            "updated_at": now,
        }).eq("user_id", user_id).execute()
        return True

    except Exception as e:
        log.exception("credits deduct failed: %s", e)
        return False
