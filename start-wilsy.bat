@echo off
cd /d "%~dp0"
echo Starting WILSY. Open http://127.0.0.1:4173 once you see "Local:" below.
echo Keep this window open. Press Ctrl+C to stop the server.
echo.
call npm start
pause
