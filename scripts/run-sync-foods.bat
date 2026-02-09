@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
node scripts\sync-foods-to-products.js
pause


