// Lightweight, NON-cryptographic password hash. Adequate only for local
// demo storage on the same device. Replace with a real hash (bcrypt/argon2,
// done server-side) when wiring up a real backend.
export function hashPassword(plain: string): string {
  let h = 5381;
  for (let i = 0; i < plain.length; i++) {
    h = ((h << 5) + h) ^ plain.charCodeAt(i);
  }
  // Append length to reduce collisions across short strings.
  return `dj2_${(h >>> 0).toString(36)}_${plain.length}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  return hashPassword(plain) === stored;
}
