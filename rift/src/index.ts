import * as db from "./database";
import * as http from "http";
import app from "./web";
import WebSocketManager from "./sockets";
const PORT = process.env.PORT || 51001;

(async() => {
    if (!process.env.RIFT_JWT_SECRET) {
        // Generate a random secret so Rift can be used locally without configuration.
        // Note: tokens will be invalidated whenever Rift restarts.
        process.env.RIFT_JWT_SECRET = require("crypto").randomBytes(32).toString("hex");
        console.log("[!] No RIFT_JWT_SECRET set, generated a random one. Conduit instances will re-register on restart.");
    }

    console.log("[+] Starting rift...");
    await db.create();

    const server = http.createServer(app);

    const sockets = new WebSocketManager();
    server.on("upgrade", sockets.handleUpgradeRequest);

    console.log("[+] Listening on 0.0.0.0:" + PORT + "... ^C to exit.");
    server.listen(PORT);
})();