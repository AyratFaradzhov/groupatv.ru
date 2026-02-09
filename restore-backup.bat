@echo off
chcp 65001 >nul
cd /d "%~dp0"
copy /Y "data\products.backup-prepare-search-seo.json" "data\products.json"
echo Восстановление завершено
pause



