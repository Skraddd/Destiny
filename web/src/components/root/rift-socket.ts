import { getDeviceDescription, getDeviceID } from "@/util/device";
import { default as NodeRSAType } from "node-rsa";

/**
 * Computes the URL of the Rift instance we should connect to.
 *
 * Priority:
 *  1. `?rift=` query parameter (persisted to localStorage for later visits)
 *  2. A previously stored `riftUrl` in localStorage
 *  3. If the page itself is served over plain http (i.e. a local Rift instance
 *     serving the web UI on the LAN), connect back to the same host.
 *  4. The official public Rift instance.
 */
function getRiftUrl(): string {
    try {
        const param = new URLSearchParams(window.location.search).get("rift");
        if (param) {
            let url = param;
            if (!/^wss?:\/\//.test(url)) url = (window.location.protocol === "https:" ? "wss://" : "ws://") + url;
            if (!/\/mobile$/.test(url)) url = url.replace(/\/$/, "") + "/mobile";
            localStorage.setItem("riftUrl", url);
            return url;
        }

        const stored = localStorage.getItem("riftUrl");
        if (stored) return stored;
    } catch (ignored) {
        // localStorage unavailable, fall through.
    }

    // Assume the page is being served by the Rift instance itself (local mode):
    // connect back to the same host, matching the page's protocol.
    const proto = window.location.protocol === "https:" ? "wss://" : "ws://";
    return proto + window.location.host + "/mobile";
}

/**
 * Whether we should use the unencrypted (plaintext) handshake. This is the case when
 * WebCrypto is unavailable, which happens on non-secure (http) origins such as a local
 * LAN deployment. In that scenario the traffic never leaves the local network, so the
 * end-to-end encryption used for the public relay is not needed. Conduit will
 * auto-approve plaintext connections without showing a prompt.
 */
function shouldUsePlainMode(riftUrl: string): boolean {
    const hasSubtle = !!(window.crypto && ((window.crypto as any).subtle || (window.crypto as any).webkitSubtle));
    return !hasSubtle || riftUrl.startsWith("ws://");
}

/**
 * WebSocket-esque class that handles messaging with Conduit through rift.
 */
export default class RiftSocket {
    private riftUrl = getRiftUrl();
    private socket = new WebSocket(this.riftUrl);

    // Params from the normal websocket.
    public onopen: () => void;
    public onmessage: (msg: MessageEvent) => void;
    public onclose: () => void;
    public readyState = WebSocket.CONNECTING;

    // State for UI
    public state = RiftSocketState.CONNECTING;

    private key: CryptoKey | null = null;
    private encrypted = false;
    private plainMode = shouldUsePlainMode(this.riftUrl);

    constructor(private code: string) {
        this.socket.onopen = this.handleOpen;
        this.socket.onmessage = this.handleMessage;
        this.socket.onclose = this.handleClose;
    }

    /**
     * Encrypts the specified contents and sends them to the other side.
     * In plain (local) mode, the contents are sent as-is without encryption.
     */
    public async send(contents: string) {
        if (this.plainMode) {
            this.socket.send(JSON.stringify([RiftOpcode.SEND, JSON.parse(contents)]));
            return;
        }

        // Generate random IV.
        const iv = new Uint8Array(16);
        window.crypto.getRandomValues(iv);

        // Encrypt using AES-CBC.
        const encryptedBuffer = await (window.crypto.subtle || window.crypto.webkitSubtle).encrypt({
            name: "AES-CBC",
            iv
        }, this.key!, stringToBuffer(contents));

        this.socket.send(JSON.stringify([
            RiftOpcode.SEND, bufferToBase64(iv.buffer) + ":" + bufferToBase64(encryptedBuffer)
        ]));
    }

    /**
     * Handles a completed connection with Rift.
     */
    private handleOpen = () => {
        // Request the public key for our target.
        this.socket.send(JSON.stringify([RiftOpcode.CONNECT, this.code]));
    };

    /**
     * Handles a wrapped message sent from Rift.
     */
    private handleMessage = (msg: MessageEvent) => {
        try {
            const [op, ...data] = JSON.parse(msg.data);

            if (op === RiftOpcode.CONNECT_PUBKEY) {
                const pubkey = data[0];

                // If we don't have a public key, show an error.
                if (!pubkey) {
                    this.state = RiftSocketState.FAILED_NO_DESKTOP;
                    return;
                }

                this.state = RiftSocketState.HANDSHAKING;

                if (this.plainMode) {
                    this.sendPlainIdentity();
                } else {
                    this.sendIdentity(pubkey);
                }
            } else if (op === RiftOpcode.RECEIVE) {
                this.handleMobileMessage(data[0]);
            }
        } catch (ignored) {
            // Ignore invalid message.
        }
    };

    /**
     * Handles the closing of the socket.
     */
    private handleClose = (ev: CloseEvent) => {
        this.readyState = WebSocket.CLOSED;
        this.state = RiftSocketState.DISCONNECTED;

        // Notify the wrapper.
        if (this.onclose !== null) this.onclose();
    };

    /**
     * Sends an unencrypted identification payload. Used for local (LAN) connections
     * where WebCrypto is not available because the page is served over plain http.
     */
    private sendPlainIdentity() {
        const { device, browser } = getDeviceDescription();

        this.socket.send(JSON.stringify([
            RiftOpcode.SEND,
            [MobileOpcode.SECRET_PLAIN, {
                identity: getDeviceID(),
                device, browser
            }]
        ]));
    }

    /**
     * Takes the identity of this device, encrypts it with the specified public key
     * and sends it to the Conduit instance. Also chooses a random key.
     */
    private async sendIdentity(pubkey: string) {
        // Generate a random shared key.
        const secret = new Uint8Array(32);
        window.crypto.getRandomValues(secret);

        // Generate a WebCrypto key.
        this.key = await (window.crypto.subtle || window.crypto.webkitSubtle).importKey("raw", secret.buffer, <any>{
            name: "AES-CBC"
        }, false, ["encrypt", "decrypt"]);

        // node-rsa is particularly big and we only need it here, so extract it into its own chunk
        // however, do prefetch it so that it'll be available as quickly as possible
        const NodeRSA: typeof NodeRSAType = <any>await import(/* webpackPrefetch: true */ /* webpackChunkName: "node-rsa" */ "node-rsa").then(x => x.default);
        const rsa = new NodeRSA();
        rsa.importKey(pubkey, "pkcs8-public-pem");

        // Create our identification payload with the chosen secret and info on the device.
        const { device, browser } = getDeviceDescription();
        const identify = JSON.stringify({
            secret: bufferToBase64(secret.buffer),
            identity: getDeviceID(),
            device, browser
        });

        // Send the handshake to Conduit.
        this.socket.send(JSON.stringify([
            RiftOpcode.SEND,
            [MobileOpcode.SECRET, rsa.encrypt(identify, "base64", "utf8")]
        ]));
    }

    /**
     * Handles a raw message received from Conduit. Possibly decrypts the contents before passing it on
     * to the normal message handler.
     */
    private async handleMobileMessage(parts: any) {
        if (this.encrypted && this.key && typeof parts === "string") {
            const [iv, encrypted] = parts.split(":");

            // Decrypt incoming message.
            const decrypted = await (window.crypto.subtle || window.crypto.webkitSubtle).decrypt({
                name: "AES-CBC",
                iv: stringToBuffer(atob(iv))
            }, this.key!, stringToBuffer(atob(encrypted)));

            // Convert to string and dispatch.
            const decryptedString = new TextDecoder("utf-8").decode(new Uint8Array(decrypted));

            if (this.onmessage !== null) {
                this.onmessage(<any>{
                    data: decryptedString
                });
            }

            return;
        }

        if (Array.isArray(parts) && parts[0] === MobileOpcode.SECRET_RESPONSE) {
            const succeeded = parts[1];

            if (!succeeded) {
                this.state = RiftSocketState.FAILED_DESKTOP_DENY;
                this.key = null;

                // Notify the wrapper.
                return;
            }

            // Handshake is done, we're "open" now.
            this.encrypted = !this.plainMode;
            this.readyState = WebSocket.OPEN;
            this.state = RiftSocketState.CONNECTED;
            this.onopen();
            return;
        }

        // In plain (local) mode, messages arrive as raw JSON arrays.
        if (this.plainMode && this.readyState === WebSocket.OPEN && Array.isArray(parts)) {
            if (this.onmessage !== null) {
                this.onmessage(<any>{
                    data: JSON.stringify(parts)
                });
            }
        }
    }
}

// Helper to convert the specified arraybuffer to a base64 string.
function bufferToBase64(buf: ArrayBuffer) {
    return btoa(String.fromCharCode(...Array.from(new Uint8Array(buf))));
}

// Helper to convert the specified string into an ArrayBuffer.
function stringToBuffer(str: string) {
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < arr.length; i++) arr[i] = str.charCodeAt(i);

    return arr.buffer;
}

export const enum RiftSocketState {
    // Connecting to Hub socket/requesting public key
    CONNECTING,

    // Failed to get a public key for the specified key, probably invalid or offline.
    FAILED_NO_DESKTOP,

    // The desktop denied our connection request.
    FAILED_DESKTOP_DENY,

    // Performing a handshake with Conduit, user may need to accept the connection
    HANDSHAKING,

    // Succesfully connected and exchanging encrypted messages
    CONNECTED,

    // The connection was interrupted
    DISCONNECTED
}

const enum RiftOpcode {
    // Request Rift for pubkey.
    CONNECT = 4,

    // Rift either sends public key or null.
    CONNECT_PUBKEY = 5,

    // Send a message to our connected peer.
    SEND = 6,

    // Connected conduit sent a message to us.
    RECEIVE = 8
}

export const enum MobileOpcode {
    // Mobile -> Conduit, sends encrypted shared secret.
    SECRET = 1,

    // Conduit <- Mobile, sends result of secret negotiation. If true, rest of communications is encrypted.
    SECRET_RESPONSE = 2,

    // Mobile -> Conduit, request version
    VERSION = 3,

    // Conduit <- Mobile, send version
    VERSION_RESPONSE = 4,

    // Mobile -> Conduit, subscribe to LCU updates that match regex
    SUBSCRIBE = 5,

    // Mobile -> Conduit, unsibscribe to LCU updates that match regex
    UNSUBSCRIBE = 6,

    // Mobile -> Conduit, make LCU request
    REQUEST = 7,

    // Conduit -> Mobile, response of a previous request message.
    RESPONSE = 8,

    // Conduit -> Mobile, when any subscribed endpoint gets an update
    UPDATE = 9,

    // Mobile -> Conduit, sends an unencrypted identification payload.
    // Used for local (LAN) connections without HTTPS/WebCrypto. No prompt is shown.
    SECRET_PLAIN = 10
}

declare global {
    interface Crypto {
        webkitSubtle: SubtleCrypto;
    }
}
