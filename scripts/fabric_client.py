"""Small Microsoft Fabric REST client using Azure CLI authentication."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


class FabricError(RuntimeError):
    pass


class FabricClient:
    API_ROOT = "https://api.fabric.microsoft.com/v1"

    def __init__(self) -> None:
        self.token = self._get_token()

    def _get_token(self) -> str:
        az_path = shutil.which("az")
        if not az_path:
            raise FabricError("Azure CLI was not found.")
        command = [
            az_path,
            "account",
            "get-access-token",
            "--resource",
            "https://api.fabric.microsoft.com/",
            "--query",
            "accessToken",
            "--output",
            "tsv",
        ]
        if os.name == "nt" and Path(az_path).suffix.lower() == ".cmd":
            azure_cli_python = Path(az_path).parent.parent / "python.exe"
            command = [str(azure_cli_python), "-IBm", "azure.cli", *command[1:]]
        result = subprocess.run(
            command, capture_output=True, text=True, timeout=60, check=False
        )
        if result.returncode or not result.stdout.strip():
            raise FabricError(result.stderr.strip() or "Azure CLI returned no token.")
        return result.stdout.strip()

    def request(
        self, method: str, path: str, body: dict[str, Any] | None = None
    ) -> tuple[int, dict[str, str], dict[str, Any] | str | None]:
        url = path if path.startswith("https://") else f"{self.API_ROOT}/{path.lstrip('/')}"
        payload = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=payload,
            method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                content = response.read().decode("utf-8")
                parsed = json.loads(content) if content else None
                return response.status, dict(response.headers), parsed
        except urllib.error.HTTPError as error:
            content = error.read().decode("utf-8", errors="replace")
            raise FabricError(
                f"{method} {url} failed ({error.code}): {content or error.reason}"
            ) from error

    def get(self, path: str) -> dict[str, Any]:
        _, _, content = self.request("GET", path)
        if not isinstance(content, dict):
            raise FabricError(f"GET {path} returned no JSON object.")
        return content

    def post(
        self, path: str, body: dict[str, Any] | None = None
    ) -> dict[str, Any] | None:
        status, headers, content = self.request("POST", path, body)
        if status == 202:
            self.wait_for_operation(headers)
        return content if isinstance(content, dict) else None

    def wait_for_operation(self, headers: dict[str, str]) -> None:
        location = headers.get("Location") or headers.get("location")
        if not location:
            raise FabricError("A long-running operation returned no Location header.")
        delay = int(headers.get("Retry-After") or headers.get("retry-after") or 5)
        deadline = time.monotonic() + 1800
        while time.monotonic() < deadline:
            time.sleep(max(delay, 1))
            status, response_headers, content = self.request("GET", location)
            delay = int(
                response_headers.get("Retry-After")
                or response_headers.get("retry-after")
                or 5
            )
            if status == 202:
                continue
            if isinstance(content, dict):
                operation_status = content.get("status")
                if operation_status in {"Failed", "Cancelled"}:
                    raise FabricError(f"Fabric operation failed: {content}")
                if operation_status in {"Running", "NotStarted", "InProgress"}:
                    continue
            return
        raise FabricError("Fabric operation did not finish within 30 minutes.")
