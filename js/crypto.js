/**
 * A module for handling cryptographic operations using the Web Crypto API.
 * This centralizes all crypto logic for security and maintainability.
 */

/**
 * Computes the SHA-256 hash of a string.
 * @param {string} str The string to hash.
 * @returns {Promise<string>} A promise that resolves to the hex-encoded hash string.
 */
async function sha256(str) {
    const textAsBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', textAsBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derives a cryptographic key from a password using PBKDF2.
 * @param {string} password The user's password.
 * @param {Uint8Array} salt A random salt.
 * @returns {Promise<CryptoKey>} A promise that resolves to a CryptoKey suitable for signing.
 */
async function deriveKey(password, salt) {
    const baseKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'HMAC', hash: 'SHA-256', length: 256 },
        true,
        ['sign', 'verify']
    );
}

/**
 * Creates an HMAC signature for a given data payload using a derived key.
 * @param {CryptoKey} key The key to sign with.
 * @param {string} data The data to sign.
 * @returns {Promise<string>} A promise that resolves to the hex-encoded signature.
 */
async function sign(key, data) {
    const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(data)
    );
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export { sha256, deriveKey, sign };
