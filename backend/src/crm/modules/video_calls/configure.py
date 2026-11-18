"""Generate local-only credentials without printing secrets or overwriting other settings."""

import argparse
import secrets
from pathlib import Path

from dotenv import dotenv_values

from crm.core.env_files import update_env


def main():
    parser = argparse.ArgumentParser(description="Configure local LiveKit (secrets stay in .env)")
    parser.add_argument("--manager-id", type=int, default=1)
    args = parser.parse_args()
    if args.manager_id <= 0:
        parser.error("manager-id must be positive")
    root = Path(__file__).resolve().parents[5]
    env = dotenv_values(root / ".env")
    key = env.get("CRM_LIVEKIT_API_KEY") or "crm-local"
    secret = env.get("CRM_LIVEKIT_API_SECRET") or secrets.token_urlsafe(48)
    public_url = "ws://localhost:7880"
    frontend_url = f"http://localhost:{env.get('FRONTEND_PORT') or '3000'}"
    values = {
        "CRM_VIDEO_ENABLED": "true",
        "CRM_LIVEKIT_API_KEY": key,
        "CRM_LIVEKIT_API_SECRET": secret,
        "CRM_LIVEKIT_PUBLIC_URL": public_url,
        "CRM_FRONTEND_URL": frontend_url,
    }
    update_env(root / ".env", {**values, "CRM_LIVEKIT_URL": "http://livekit:7880"})
    update_env(root / "backend" / ".env", {**values, "CRM_LIVEKIT_URL": "http://localhost:7880"})
    print("Configured local video: .env and backend/.env (both Git-ignored).")
    print("Manager access uses CRM sessions; configure an account with crm.modules.auth.configure.")


if __name__ == "__main__":
    main()
