@echo off
REM Start the React frontend dev server
cd /d "%~dp0frontend"
echo Starting DermAI Frontend on http://localhost:5173
echo.
npm run dev
