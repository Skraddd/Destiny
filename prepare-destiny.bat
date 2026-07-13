@echo off
cd /d "%~dp0web"
echo === Install web dependencies ===
call yarn install
echo === Build web interface ===
call yarn build
cd /d "%~dp0rift"
echo === Install rift dependencies ===
call yarn install
echo.
echo Preparation Completed!
pause
