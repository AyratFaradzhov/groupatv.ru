@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
node scripts\smart-product-discovery.js
pause

