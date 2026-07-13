@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo        Destiny - First Time Setup
echo ============================================
echo.

:: -------------------------------------------------
:: Check if Node.js is installed
:: -------------------------------------------------

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js was not found.
    echo Downloading installer...

    powershell -Command ^
    "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.17.1/node-v22.17.1-x64.msi' -OutFile '%TEMP%\node.msi'"

    echo Installing Node.js...

    msiexec /i "%TEMP%\node.msi" /passive /norestart

    echo.
    echo Node.js has been installed.
    echo Please close and run this script again.
    pause
    exit
)

echo Node.js detected.
node -v

echo.

:: -------------------------------------------------
:: Check if npm is available
:: -------------------------------------------------

where npm >nul 2>&1
if errorlevel 1 (
    echo npm was not found.
    pause
    exit
)

echo npm detected.
npm -v

echo.

:: -------------------------------------------------
:: Check if Yarn is installed
:: -------------------------------------------------

where yarn >nul 2>&1

if errorlevel 1 (
    echo Yarn was not found.
    echo Installing Yarn...

    call npm install -g yarn

    if errorlevel 1 (
        echo Failed to install Yarn.
        pause
        exit
    )
)

echo Yarn detected.
yarn -v

echo.

:: -------------------------------------------------
:: Install and build the web interface
:: -------------------------------------------------

cd /d "%~dp0web"

echo.
echo ============================================
echo Installing web dependencies...
echo ============================================

call yarn install

echo.
echo ============================================
echo Building web interface...
echo ============================================

call yarn build

:: -------------------------------------------------
:: Install Rift dependencies
:: -------------------------------------------------

cd /d "%~dp0rift"

echo.
echo ============================================
echo Installing Rift dependencies...
echo ============================================

call yarn install

echo.
echo ============================================
echo Setup completed successfully!
echo ============================================
echo You can now launch Conduit.exe.
pause
