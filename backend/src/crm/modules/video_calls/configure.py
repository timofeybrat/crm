"""Generate local-only credentials without printing secrets or overwriting other settings."""

import argparse
import json
import re
import secrets
from pathlib import Path

from dotenv import dotenv_values


def update_env(path: Path, values: dict[str, str]):
    content = path.read_text(encoding="utf-8") if path.exists() else ""
    for name, value in values.items():
        line = f"{name}={value}"
        pattern = rf"^{re.escape(name)}=.*$"
        if re.search(pattern, content, flags=re.MULTILINE):
            content = re.sub(
                pattern, lambda _, replacement=line: replacement, content, flags=re.MULTILINE
            )
        else:
            content = content.rstrip() + "\n" + line + "\n"
    path.write_text(content, encoding="utf-8")


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
    manager_keys = json.loads(env.get("CRM_VIDEO_MANAGER_KEYS") or "{}")
    manager_keys.setdefault(str(args.manager_id), secrets.token_urlsafe(32))
    public_url = "ws://localhost:7880"
    frontend_url = f"http://localhost:{env.get('FRONTEND_PORT') or '3000'}"
    values = {
        "CRM_VIDEO_ENABLED": "true",
        "CRM_LIVEKIT_API_KEY": key,
        "CRM_LIVEKIT_API_SECRET": secret,
        "CRM_LIVEKIT_PUBLIC_URL": public_url,
        "CRM_FRONTEND_URL": frontend_url,
        "CRM_VIDEO_MANAGER_KEYS": json.dumps(manager_keys, separators=(",", ":")),
    }
    update_env(root / ".env", {**values, "CRM_LIVEKIT_URL": "http://livekit:7880"})
    update_env(root / "backend" / ".env", {**values, "CRM_LIVEKIT_URL": "http://localhost:7880"})
    print("Configured local video: .env and backend/.env (both Git-ignored).")
    print(f"Manager {args.manager_id}: use its CRM_VIDEO_MANAGER_KEYS value from .env in the UI.")


if __name__ == "__main__":
    main()
