"""Helpers for explicit local setup commands; never log file contents."""

import re
from pathlib import Path


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
