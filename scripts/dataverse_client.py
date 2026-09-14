"""Minimal authenticated client for the Dataverse Web API."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


class DataverseError(RuntimeError):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(f"Dataverse request failed ({status}): {message}")
        self.status = status


class DataverseClient:
    def __init__(self, environment_url: str) -> None:
        self.environment_url = environment_url.rstrip("/")
        self.api_url = f"{self.environment_url}/api/data/v9.2"
        self.token = self._get_token()

    def _get_token(self) -> str:
        az_path = shutil.which("az")
        if not az_path:
            raise RuntimeError("Azure CLI was not found. Install it and run az login.")

        command = [
            az_path,
            "account",
            "get-access-token",
            "--resource",
            self.environment_url,
            "--query",
            "accessToken",
            "--output",
            "tsv",
        ]
        if os.name == "nt" and Path(az_path).suffix.lower() == ".cmd":
            azure_cli_python = Path(az_path).parent.parent / "python.exe"
            if not azure_cli_python.exists():
                raise RuntimeError(
                    f"Azure CLI's Python runtime was not found at {azure_cli_python}."
                )
            command = [
                str(azure_cli_python),
                "-IBm",
                "azure.cli",
                *command[1:],
            ]

        result = subprocess.run(
            command,
            capture_output=True,
            check=False,
            text=True,
            timeout=60,
        )
        if result.returncode != 0 or not result.stdout.strip():
            detail = result.stderr.strip() or "Azure CLI returned no access token."
            raise RuntimeError(
                f"Unable to acquire a Dataverse token. Run az login for the environment tenant. {detail}"
            )
        return result.stdout.strip()

    def request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        url = path if path.startswith("https://") else f"{self.api_url}/{path.lstrip('/')}"
        payload = None if body is None else json.dumps(body).encode("utf-8")
        request_headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
        }
        if headers:
            request_headers.update(headers)
        request = urllib.request.Request(
            url, data=payload, headers=request_headers, method=method
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                content = response.read()
                if not content:
                    return {"status": response.status, "headers": dict(response.headers)}
                return json.loads(content.decode("utf-8"))
        except urllib.error.HTTPError as error:
            content = error.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(content)
                message = parsed.get("error", {}).get("message", content)
            except json.JSONDecodeError:
                message = content or error.reason
            raise DataverseError(error.code, message) from error
        except urllib.error.URLError as error:
            raise RuntimeError(f"Unable to reach Dataverse at {url}: {error.reason}") from error

    def get(self, path: str, query: dict[str, str] | None = None) -> dict[str, Any]:
        if query:
            encoded = urllib.parse.urlencode(query, safe="'(),$ ")
            path = f"{path}?{encoded}"
        return self.request("GET", path)

    def post(
        self,
        path: str,
        body: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        return self.request("POST", path, body, headers)

    def patch(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        return self.request("PATCH", path, body)

    def put(
        self,
        path: str,
        body: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        return self.request("PUT", path, body, headers)
