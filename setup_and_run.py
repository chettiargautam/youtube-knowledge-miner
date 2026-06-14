#!/usr/bin/env python3
from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
VENV = BACKEND / ".venv"
BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:3000"


def run(cmd: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
    print(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, check=check)


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def python_bin() -> Path:
    if platform.system() == "Windows":
        return VENV / "Scripts" / "python.exe"
    return VENV / "bin" / "python"


def npm_cmd() -> str:
    return "npm.cmd" if platform.system() == "Windows" else "npm"


def ensure_python() -> None:
    if sys.version_info < (3, 10):
        raise RuntimeError("Python 3.10+ is required to run the backend.")


def ensure_env() -> None:
    env_path = BACKEND / ".env"
    example = BACKEND / ".env.example"
    if not env_path.exists() and example.exists():
        env_path.write_text(example.read_text(encoding="utf-8"), encoding="utf-8")
        print("Created backend/.env from backend/.env.example")


def install_backend() -> None:
    print("Setting up backend dependencies...")
    if not VENV.exists():
        run([sys.executable, "-m", "venv", str(VENV)])
    run([str(python_bin()), "-m", "pip", "install", "--upgrade", "pip"], cwd=BACKEND)
    run([str(python_bin()), "-m", "pip", "install", "-r", "requirements.txt"], cwd=BACKEND)


def install_frontend() -> None:
    if not command_exists(npm_cmd()):
        raise RuntimeError("npm was not found. Install Node.js LTS, then run this script again.")
    print("Setting up frontend dependencies...")
    run([npm_cmd(), "install"], cwd=FRONTEND)


def wait_backend() -> None:
    for _ in range(60):
        try:
            with urlopen(f"{BACKEND_URL}/health", timeout=1) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(1)
    raise RuntimeError("Backend did not become ready.")


def run_servers() -> None:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND)
    print(f"Starting backend at {BACKEND_URL}")
    backend_proc = subprocess.Popen(
        [
            str(python_bin()),
            "-m",
            "uvicorn",
            "app.main:app",
            "--reload",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ],
        cwd=BACKEND,
        env=env,
    )
    try:
        print("Waiting for backend...")
        wait_backend()
        print(f"Starting frontend at {FRONTEND_URL}")
        run([npm_cmd(), "run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000"], cwd=FRONTEND)
    finally:
        backend_proc.terminate()
        try:
            backend_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            backend_proc.kill()


def main() -> None:
    ensure_python()
    ensure_env()
    install_backend()
    install_frontend()
    run_servers()


if __name__ == "__main__":
    main()
