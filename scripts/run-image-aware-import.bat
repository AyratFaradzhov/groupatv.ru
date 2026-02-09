@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
node scripts\image-aware-product-ingestion.js
pause


