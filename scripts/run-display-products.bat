@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
node scripts\display-products-by-categories.js
pause


