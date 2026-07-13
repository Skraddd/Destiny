import * as fs from "fs";

/**
 * Extremely simple JSON-file backed store that maps 6-digit codes to public keys.
 * This replaces the old sqlite database so that Rift no longer depends on native
 * modules (sqlite3 does not build on modern Node versions).
 */

const DB_PATH = process.env.RIFT_DB_PATH || "database.json";

let entries: { code: string, public_key: string }[] = [];

function save() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(entries, null, 2));
    } catch (e) {
        console.error("[-] Could not persist database: " + e);
    }
}

/**
 * Creates or loads the database file.
 */
export async function create() {
    if (fs.existsSync(DB_PATH)) {
        try {
            entries = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
        } catch (e) {
            console.error("[-] Could not read " + DB_PATH + ", starting with an empty database.");
            entries = [];
        }
    } else {
        save();
    }
}

/**
 * Generates a new unique code for the specified public key and returns that key.
 * Either inserts the public key in the database, or returns the existing code
 * if it already existed.
 */
export async function generateCode(pubkey: string): Promise<string> {
    const existing = entries.filter(x => x.public_key === pubkey)[0];
    if (existing) return existing.code;

    let code: string;
    do {
        // Generate a random 6 digit number as code.
        code = (Math.floor(Math.random() * 900000) + 100000).toString();
    } while (entries.some(x => x.code === code));

    entries.push({ code, public_key: pubkey });
    save();

    return code;
}

/**
 * Looks up the public key belonging to the specified code. Returns either the
 * key, or null if not found.
 */
export async function lookup(code: string): Promise<{ public_key: string, code: string } | null> {
    return entries.filter(x => x.code === code)[0] || null;
}

/**
 * Checks if the specified code is still a valid entry. If yes, updates the pubkey for
 * said code and returns true. Else, returns false.
 */
export async function potentiallyUpdate(code: string, pubkey: string): Promise<boolean> {
    const entry = entries.filter(x => x.code === code)[0];
    if (!entry) return false;

    entry.public_key = pubkey;
    save();

    return true;
}
