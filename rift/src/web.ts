import * as express from "express";
import * as bodyParser from "body-parser";
import * as jwt from "jsonwebtoken";
import * as cors from "cors";
import * as fs from "fs";
import * as path from "path";

import * as db from "./database";

// Create a new express app using CORS and JSON bodies.
const app = express();
app.use(cors());
app.use(bodyParser.json());

// If a built copy of the web interface is available (either at the path given by
// RIFT_WEB_DIR or in ../web/dist), serve it. This makes it possible to run Mimic
// completely locally: the phone opens http://<pc-ip>:51001 in the browser and
// connects back to this same Rift instance over plain websockets.
const webDir = process.env.RIFT_WEB_DIR || path.join(__dirname, "..", "..", "web", "dist");
if (fs.existsSync(path.join(webDir, "index.html"))) {
    console.log("[+] Serving web interface from " + webDir);
    app.use(express.static(webDir));
} else {
    // GET /. Just return some default text.
    app.get("/", (req, res) => {
        res.send("Hai, rifto desu.");
    });
}

// POST /register. Receive a code for the specified public key.
app.post("/register", async (req, res) => {
    // Check that they provided a public key.
    if (typeof req.body.pubkey !== "string") {
        return res.status(400).json({
            ok: false,
            error: "Missing public key."
        });
    }

    // Generate a new unique code.
    const code = await db.generateCode(req.body.pubkey);
    console.log("[+] New Conduit registered. Code: " + code);

    // Sign a JWT and return it.
    res.json({
        ok: true,
        token: jwt.sign({
            code
        }, process.env.RIFT_JWT_SECRET!)
    });
});

// GET /check?token=jY... Checks if a specified JWT is valid.
app.get("/check", async (req, res) => {
    if (typeof req.query.token !== "string") {
        return res.status(400).json({
            ok: false,
            error: "Missing a token to check."
        });
    }

    jwt.verify(req.query.token, process.env.RIFT_JWT_SECRET!, async (err: Error | null, obj: any) => {
        // If the token could not be decoded, or if it doesn't contain a code field, return false.
        if (err) return res.json(false);
        if (!obj || typeof obj.code !== "string") return res.json(false);

        // Return whether or not the code exists in our database.
        res.json(!!await db.lookup(obj.code));
    });
});

export default app;
