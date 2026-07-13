@echo off
setlocal EnableDelayedExpansion
echo ============================================
echo        Destiny - First Time Setup
echo ============================================
echo.

:: -------------------------------------------------
:: Check for administrator rights (needed for the
:: firewall rule and, possibly, the Node installer)
:: -------------------------------------------------
net session >nul 2>&1
if errorlevel 1 (
    echo NOTE: not running as administrator.
    echo The firewall rule for port 51001 cannot be added automatically.
    echo For a complete setup, right-click this file and choose
    echo "Run as administrator".
    echo.
    set NOADMIN=1
)

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
call npm -v
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
call yarn -v
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
if errorlevel 1 (
    echo Failed to install web dependencies.
    pause
    exit
)
echo.
echo ============================================
echo Building web interface...
echo ============================================
call yarn build
if errorlevel 1 (
    echo Web build failed. Check the errors above.
    pause
    exit
)

:: -------------------------------------------------
:: Install Rift dependencies
:: -------------------------------------------------
cd /d "%~dp0rift"
echo.
echo ============================================
echo Installing Rift dependencies...
echo ============================================
call yarn install
if errorlevel 1 (
    echo Failed to install Rift dependencies.
    pause
    exit
)

:: -------------------------------------------------
:: Firewall rule so phones on the LAN can reach
:: the local server on port 51001
:: -------------------------------------------------
echo.
echo ============================================
echo Configuring firewall (port 51001)...
echo ============================================
if defined NOADMIN (
    echo Skipped: administrator rights required.
    echo You can add it later by running this script as administrator.
) else (
    netsh advfirewall firewall show rule name="Destiny Rift 51001" >nul 2>&1
    if errorlevel 1 (
        netsh advfirewall firewall add rule name="Destiny Rift 51001" dir=in action=allow protocol=TCP localport=51001 >nul
        echo Firewall rule added.
    ) else (
        echo Firewall rule already present.
    )
)

:: -------------------------------------------------
:: Final check: is Conduit.exe available?
:: -------------------------------------------------
echo.
echo ============================================
echo Setup completed!
echo ============================================
if exist "%~dp0conduit\bin\Release\Conduit.exe" (
    echo You can now launch Conduit.exe:
    echo   %~dp0conduit\bin\Release\Conduit.exe
) else (
    echo WARNING: Conduit.exe was not found in conduit\bin\Release\.
    echo Build it once with Visual Studio ^(Release^) or copy a
    echo prebuilt Conduit.exe there, then launch it.
)
echo.
pause
