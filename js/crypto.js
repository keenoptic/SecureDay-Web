// Constants
const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const DIGEST_ALGO = 'SHA-256';
const VERSION = 0x01;

// --- Utility Functions ---

function textToBytes(text) {
    return new TextEncoder().encode(text);
}

function bytesToText(bytes) {
    return new TextDecoder().decode(bytes);
}

// Convert Uint8Array to Base64 string
function bytesToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// Convert Base64 string to Uint8Array
function base64ToBytes(base64) {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function generateSalt() {
    return window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

function generateIV() {
    return window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

// --- Key Derivation ---

// Import password as raw key for PBKDF2
async function importPasswordAsKey(password) {
    const passwordBytes = textToBytes(password);
    return window.crypto.subtle.importKey(
        "raw",
        passwordBytes,
        "PBKDF2",
        false,
        ["deriveKey"]
    );
}

// Derive AES-GCM key from password using PBKDF2
async function deriveKeyFromPassword(password, salt) {
    const baseKey = await importPasswordAsKey(password);
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: DIGEST_ALGO
        },
        baseKey,
        { name: "AES-GCM", length: KEY_LENGTH },
        false,
        ["encrypt", "decrypt"]
    );
}

// Derive AES-GCM key from file content (hash of file)
async function deriveKeyFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await window.crypto.subtle.digest(DIGEST_ALGO, arrayBuffer);
    return window.crypto.subtle.importKey(
        "raw",
        hashBuffer,
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
    );
}

// --- Encryption/Decryption Core ---

async function encryptData(key, iv, plainBytes) {
    return window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        plainBytes
    );
}

async function decryptData(key, iv, cipherBytes) {
    try {
        return await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            cipherBytes
        );
    } catch (e) {
        throw new Error("Decryption failed. Wrong password or corrupted data.");
    }
}

// --- Packing/Unpacking ---

function packMessage(version, salt, iv, ciphertext) {
    const combined = new Uint8Array(1 + salt.length + iv.length + ciphertext.byteLength);
    combined[0] = version;
    combined.set(salt, 1);
    combined.set(iv, 1 + salt.length);
    combined.set(new Uint8Array(ciphertext), 1 + salt.length + iv.length);
    return combined;
}

function unpackMessage(packed) {
    if (packed[0] !== VERSION) {
        throw new Error("Unsupported message version");
    }
    const salt = packed.slice(1, 1 + SALT_LENGTH);
    const iv = packed.slice(1 + SALT_LENGTH, 1 + SALT_LENGTH + IV_LENGTH);
    const ciphertext = packed.slice(1 + SALT_LENGTH + IV_LENGTH);
    return { version: packed[0], salt, iv, ciphertext };
}

// --- Public API ---

export async function encryptWithPassword(plaintext, password) {
    const salt = generateSalt();
    const iv = generateIV();
    const key = await deriveKeyFromPassword(password, salt);
    const plainBytes = textToBytes(plaintext);
    const cipherBuffer = await encryptData(key, iv, plainBytes);
    const packed = packMessage(VERSION, salt, iv, cipherBuffer);
    return bytesToBase64(packed);
}

export async function decryptWithPassword(base64cipher, password) {
    try {
        const packed = base64ToBytes(base64cipher);
        const { salt, iv, ciphertext } = unpackMessage(packed);
        const key = await deriveKeyFromPassword(password, salt);
        const plainBuffer = await decryptData(key, iv, ciphertext);
        return bytesToText(plainBuffer);
    } catch (error) {
        console.error("Decryption error:", error);
        throw new Error("Неверный пароль или поврежденные данные");
    }
}

export async function encryptWithFile(plaintext, file) {
    // For file-based encryption, we don't need a random salt for key derivation
    // as the key is derived from the file hash directly.
    // However, to keep the format consistent, we'll use a zero-filled salt.
    const salt = new Uint8Array(SALT_LENGTH); 
    const iv = generateIV();
    const key = await deriveKeyFromFile(file);
    const plainBytes = textToBytes(plaintext);
    const cipherBuffer = await encryptData(key, iv, plainBytes);
    const packed = packMessage(VERSION, salt, iv, cipherBuffer);
    return bytesToBase64(packed);
}

export async function decryptWithFile(base64cipher, file) {
    try {
        const packed = base64ToBytes(base64cipher);
        const { iv, ciphertext } = unpackMessage(packed); // salt is ignored
        const key = await deriveKeyFromFile(file);
        const plainBuffer = await decryptData(key, iv, ciphertext);
        return bytesToText(plainBuffer);
    } catch (error) {
        console.error("Decryption error:", error);
        throw new Error("Неверный файл-ключ или поврежденные данные");
    }
}
