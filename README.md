# Destiny

This project is a fork of the archived project:  
https://github.com/molenzwiebel/Mimic

Since the original project has been archived and the Overwolf version has not been updated for years, I updated the original code by fixing bugs and adding new features.

---

# Added Features

- Auto-accept games
- Swap roles and pick position during Champion Select
- Arena mode **Bravery** pick option

---

# Bug Fixes

- Fixed ARAM champion pick and bench selection
- Updated rune pages and added the latest runes
- Fixed friends list and invitations
- Fixed champion ban selection
- Removed first-time authorization (not needed for the local server version)
- Added support for new game modes in lobby creation

---

# Features

- Create and leave lobbies
- Start and stop matchmaking queues
- Accept or decline matches
- Auto-accept matches
- Champion Select
  - Pick champions
  - Ban champions
  - Swap roles
  - Swap pick order
  - Edit runes
  - Change summoner spells
- Skin selector

---

# Important Changes

The original project relied on its own remote server to allow communication between the mobile device and the PC (`Conduit.exe`).

This version instead creates a **local server** on your computer, allowing the phone and PC to communicate directly over your local network.

**Note:** The launcher is **not standalone**. You must keep all project files, as they are required to host the local server.

---

# Installation

## Requirements

- **.NET Framework 4.x** (4.8 recommended)

Download it from Microsoft:

https://dotnet.microsoft.com/en-us/download/dotnet-framework/net48

---

# First-Time Setup

After downloading the project:

1. Run **`prepare-destiny.bat`**.
2. This script installs all required dependencies for:
   - `web`
   - `rift`
   - the web interface build

---

# Running the Application

## Option 1 (Recommended)

Run:

```
Destinyv1/conduit/bin/Release/Conduit.exe
```

## Option 2

Compile the project yourself using **Visual Studio**.

Requirements:

- Restore all NuGet packages.
- Build the project in **Release** configuration.

---

# Connecting Your Phone

1. Launch **Conduit.exe**.
2. The application will display:
   - your local IP address
   - a QR code
3. Scan the QR code or open the displayed address from your phone using any web browser.
4. Enter the connection code shown by the application.

> **If the QR code or IP does not appear, make sure the League of Legends client is running.**

---

# Server Console

The console window opened by **Conduit.exe** displays the local server logs.

You can use it to:

- monitor incoming connections
- identify connection problems
- debug server activity

---

# Network Configuration

If you experience connection issues, you may need to forward the following ports on your router:

- **8080**
- **51001**

It is also recommended to configure your PC with a **static local IP address**.

Using DHCP may cause the computer's local IP address to change, preventing the phone from connecting.

---

# Authorization Changes

The original project displayed a device authorization window before allowing connections.

This feature has been removed because:

- it caused connection problems
- local connections are not encrypted with HTTPS
- it is unnecessary for a local-only server

---

# Known Issues

### Multiple Console Windows

Each new mobile connection may open an additional `Conduit.exe` console window.

**Workaround:** simply close the extra console windows and keep only one open.

---

### Web Interface Doesn't Update

Occasionally, after:

- finding a match
- creating a lobby
- joining a lobby

the web interface may remain on the previous page.

**Fix:**

1. Refresh the browser page.
2. Press **Connect** again.

The correct page should load normally.
