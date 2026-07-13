@echo off
cd /d "%~dp0web"
echo === Installazione dipendenze web ===
call yarn install
echo === Build interfaccia web ===
call yarn build
cd /d "%~dp0rift"
echo === Installazione dipendenze rift ===
call yarn install
echo.
echo Preparazione completata! Ora usa avvia-mimic.bat
pause
