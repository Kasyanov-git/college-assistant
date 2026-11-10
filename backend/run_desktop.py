# Точка входа для PyInstaller: uvicorn + рабочая директория = _MEIPASS.

import multiprocessing
import os
import sys

multiprocessing.freeze_support()


def main() -> None:
    if getattr(sys, "frozen", False):
        os.chdir(sys._MEIPASS)

    import app.main  # noqa: F401 — чтобы PyInstaller подтянул зависимости приложения

    import uvicorn

    host = os.environ.get("COLLEGE_ASSISTANT_HOST", "0.0.0.0")
    port = int(os.environ.get("COLLEGE_ASSISTANT_PORT", "8000"))
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
