@echo off
setlocal
cd /d "%~dp0.."

start "" /b "backend\venv\Scripts\python.exe" "backend\run_desktop.py"

for /l %%i in (1,1,30) do (
  curl --silent --fail http://127.0.0.1:8000/health >nul 2>&1
  if not errorlevel 1 goto server_ready
  timeout /t 1 /nobreak >nul
)
echo Не удалось дождаться backend на http://127.0.0.1:8000
exit /b 1

:server_ready
set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" (
  echo Microsoft Edge не найден. Запустите URL вручную в режиме kiosk.
  exit /b 1
)

start "" "%BROWSER%" --kiosk http://127.0.0.1:8000 --edge-kiosk-type=fullscreen --no-first-run --disable-features=Translate
endlocal
