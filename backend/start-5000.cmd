@echo off
REM Start backend on normal port 5000
cd /d "C:\Users\Admin\Downloads\KisanMitra (2)\KisanMitra\KisanMitra\backend"
set PORT=5000
start "KisanMitra-Backend" /b node src/server.js > backend-5000.log 2>&1
echo Starting backend on port 5000...
