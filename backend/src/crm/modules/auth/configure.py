"""Generate bootstrap credentials in ignored .env files; never print passwords."""

import argparse
import re
import secrets
from pathlib import Path

from dotenv import dotenv_values

from crm.core.env_files import update_env


def main():
    parser = argparse.ArgumentParser(description="Prepare local manager credentials")
    parser.add_argument("--manager-id", type=int, default=1)
    parser.add_argument("--login", default="manager1")
    args = parser.parse_args()
    if args.manager_id <= 0 or not re.fullmatch(r"[a-zA-Z0-9._@-]{3,64}", args.login):
        parser.error("Choose a positive manager ID and a login of 3-64 ASCII characters")
    root = Path(__file__).resolve().parents[5]
    current = dotenv_values(root / ".env")
    values = {
        "CRM_BOOTSTRAP_MANAGER_ID": str(args.manager_id),
        "CRM_BOOTSTRAP_LOGIN": current.get("CRM_BOOTSTRAP_LOGIN") or args.login,
        "CRM_BOOTSTRAP_PASSWORD": current.get("CRM_BOOTSTRAP_PASSWORD")
        or secrets.token_urlsafe(32),
    }
    for path in [root / ".env", root / "backend" / ".env"]:
        update_env(path, values)
        # Retire the previous bearer-key mechanism completely.
        lines = path.read_text(encoding="utf-8").splitlines()
        path.write_text(
            "\n".join(line for line in lines if not line.startswith("CRM_VIDEO_MANAGER_KEYS="))
            + "\n",
            encoding="utf-8",
        )
    print("Bootstrap login/password saved in .env and backend/.env. No secrets printed.")
    print("Run migrations, crm.seed, then crm.modules.auth.provision --from-env --role admin.")


if __name__ == "__main__":
    main()
