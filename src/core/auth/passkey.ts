/**
 * Passkey assertion helper. Uses WebAuthn when available in the runtime.
 * This keeps login flow end-to-end where passkey APIs are present.
 */

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const TRAILING_BASE64_PADDING_PATTERN = new RegExp('=+$', 'g');

export type PasskeyErrorCode =
  | 'PASSKEY_NOT_SUPPORTED'
  | 'PASSKEY_CANCELLED'
  | 'PASSKEY_INVALID_OPTIONS'
  | 'PASSKEY_RUNTIME';

export class PasskeyClientError extends Error {
  code: PasskeyErrorCode;

  constructor(code: PasskeyErrorCode, message: string) {
    super(message);
    this.name = 'PasskeyClientError';
    this.code = code;
  }
}

type UnknownRecord = Record<string, unknown>;

function getWebAuthnCredentialGetter():
  | ((options: unknown) => Promise<unknown>)
  | null {
  const g = globalThis as unknown as {
    navigator?: {
      credentials?: {
        get?: (options: unknown) => Promise<unknown>;
      };
    };
  };
  const credentials = g.navigator?.credentials;
  if (credentials != null && typeof credentials.get === 'function') {
    return credentials.get.bind(credentials);
  }
  return null;
}

export function isPasskeySupported(): boolean {
  return getWebAuthnCredentialGetter() != null;
}

/* eslint-disable no-bitwise */
function decodeBase64(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = BASE64_CHARS.indexOf(clean[i] ?? 'A');
    const c2 = BASE64_CHARS.indexOf(clean[i + 1] ?? 'A');
    const c3 = clean[i + 2] === '=' ? -1 : BASE64_CHARS.indexOf(clean[i + 2] ?? 'A');
    const c4 = clean[i + 3] === '=' ? -1 : BASE64_CHARS.indexOf(clean[i + 3] ?? 'A');
    const n1 = (c1 << 2) | (c2 >> 4);
    bytes.push(n1 & 0xff);
    if (c3 >= 0) {
      const n2 = ((c2 & 15) << 4) | (c3 >> 2);
      bytes.push(n2 & 0xff);
    }
    if (c3 >= 0 && c4 >= 0) {
      const n3 = ((c3 & 3) << 6) | c4;
      bytes.push(n3 & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function encodeBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;
    const hasB2 = i + 1 < bytes.length;
    const hasB3 = i + 2 < bytes.length;

    const c1 = b1 >> 2;
    const c2 = ((b1 & 3) << 4) | (b2 >> 4);
    const c3 = ((b2 & 15) << 2) | (b3 >> 6);
    const c4 = b3 & 63;

    output += BASE64_CHARS[c1];
    output += BASE64_CHARS[c2];
    output += hasB2 ? BASE64_CHARS[c3] : '=';
    output += hasB3 ? BASE64_CHARS[c4] : '=';
  }
  return output;
}
/* eslint-enable no-bitwise */

function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  const bytes = decodeBase64(base64);
  const copy = Uint8Array.from(bytes);
  return copy.buffer;
}

function toBase64Url(value: Uint8Array): string {
  return encodeBase64(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(TRAILING_BASE64_PADDING_PATTERN, '');
}

function toUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function bufferToBase64UrlOrThrow(value: unknown, fieldName: string): string {
  const bytes = toUint8Array(value);
  if (bytes == null) {
    throw new PasskeyClientError(
      'PASSKEY_INVALID_OPTIONS',
      `Passkey response missing ${fieldName}`
    );
  }
  return toBase64Url(bytes);
}

function normalizePublicKeyOptions(options: UnknownRecord): UnknownRecord {
  const rawPublicKey = (
    options.publicKey != null &&
    typeof options.publicKey === 'object' &&
    !Array.isArray(options.publicKey)
  )
    ? (options.publicKey as UnknownRecord)
    : options;

  if (typeof rawPublicKey.challenge !== 'string') {
    throw new PasskeyClientError(
      'PASSKEY_INVALID_OPTIONS',
      'Passkey challenge is missing from options.'
    );
  }

  const publicKey: UnknownRecord = {
    ...rawPublicKey,
    challenge: base64UrlToArrayBuffer(rawPublicKey.challenge),
  };

  if (Array.isArray(rawPublicKey.allowCredentials)) {
    publicKey.allowCredentials = rawPublicKey.allowCredentials.map(entry => {
      if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
        return entry;
      }
      const item = { ...(entry as UnknownRecord) };
      if (typeof item.id === 'string') {
        item.id = base64UrlToArrayBuffer(item.id);
      }
      return item;
    });
  }

  return publicKey;
}

export function isPasskeyClientError(value: unknown): value is PasskeyClientError {
  return value instanceof PasskeyClientError;
}

export async function createPasskeyAssertion(
  options: UnknownRecord
): Promise<UnknownRecord> {
  const getCredential = getWebAuthnCredentialGetter();
  if (getCredential == null) {
    throw new PasskeyClientError(
      'PASSKEY_NOT_SUPPORTED',
      'Passkey is not supported in this app/runtime.'
    );
  }

  try {
    const publicKey = normalizePublicKeyOptions(options);
    const credential = (await getCredential({ publicKey })) as UnknownRecord | null;
    if (credential == null) {
      throw new PasskeyClientError('PASSKEY_CANCELLED', 'Passkey request was cancelled.');
    }

    const response = (credential.response ?? {}) as UnknownRecord;
    const result: UnknownRecord = {
      id: credential.id,
      rawId: bufferToBase64UrlOrThrow(credential.rawId, 'rawId'),
      type: credential.type ?? 'public-key',
      response: {
        authenticatorData: bufferToBase64UrlOrThrow(
          response.authenticatorData,
          'response.authenticatorData'
        ),
        clientDataJSON: bufferToBase64UrlOrThrow(
          response.clientDataJSON,
          'response.clientDataJSON'
        ),
        signature: bufferToBase64UrlOrThrow(response.signature, 'response.signature'),
      },
    };

    if (response.userHandle != null) {
      (result.response as UnknownRecord).userHandle = bufferToBase64UrlOrThrow(
        response.userHandle,
        'response.userHandle'
      );
    }

    if (typeof credential.getClientExtensionResults === 'function') {
      result.clientExtensionResults = (
        credential.getClientExtensionResults as () => unknown
      )();
    }

    return result;
  } catch (error) {
    if (isPasskeyClientError(error)) throw error;
    const name = (error as { name?: string })?.name;
    if (name === 'NotAllowedError' || name === 'AbortError') {
      throw new PasskeyClientError('PASSKEY_CANCELLED', 'Passkey request was cancelled.');
    }
    throw new PasskeyClientError(
      'PASSKEY_RUNTIME',
      (error as { message?: string })?.message ?? 'Passkey authentication failed.'
    );
  }
}
