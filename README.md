This project is fork of https://github.com/molenzwiebel/Mimic (archieved)
Since the project was archieved and the Overwolf version of the app has not been updated in years i updated the original code, fixing bugs and adding new features

List of added features:
- Autoaccept games option
- Swap roles and pick position
- Arena mode "bravery" pick option

List of fixes:
- Aram pick and bench champion select
- Fixed runes pages and added new runes
- Friend list and invites
- Ban selection 
- Removed authorization for first correction (not needed for local server version)
- New gamemodes in lobby creation

List of all features offered by the application:
- Create and leave lobbies
- Start / Stop queues
- Accept / Refuse games
- Autoaccept option
- Champion Select (pick, ban, swap role and position, runes, summoner spells)
- Skin selector

Important Changes:
The original project has its own server host to make the phone<--->pc (conduit.exe) connection possible, but this program creates a LOCAL server in order to make that possible.
The launcher is not a standalone and you need all the files to use the application, since you have to host your own server

How to use:
- After first download, open "prepare-destiny.bat" to install dependencies for "web", "rift" and build web interface.
- Option 1: Use the Conduit.exe file in "\Destinyv1\conduit\bin\Release"
- Option 2: Compile your own version with VisualStudio (don't forget NuGet packages), set release and compile.
- The program will show you the local ip (and QRcode) to connect to. The ip should be your pc's local ip. If the code does not appear you should open your lol client
- Use any browser on phone and go to the site and enter the code. 
  
The local server prompt in the Conduit.exe file shows the local server logs. You can use it to identify problems or to check new connections
If there are any problems with connection you probably have to open router ports "8080" and "51001". If you do this you should also setup your pc with a static ip in the windows settings. (DHCP can cause problems as the machine's ip can change)

Note: the device authorization window of the original version has been removed since it caused problems, since the local connection is not secure (HTTPS), and it was needed to make the pop-up window appear

Known minor issues:
- Conduit.exe opens new windows when new mobile connection happen. Tip: to avoid problems you should have only one windows, you can close the other one.
- Sometimes when you find match or create / join lobbies, the web app can be stuck on the previous page. Fix: refresh the page and click connect, the new page will be loaded without problems
