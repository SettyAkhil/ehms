/**
 * Ephemeral UI-session state. It is intentionally not persisted: backend
 * cookies and /api/auth/session remain the only authentication authority.
 */
let authenticated = false

export function setAppSessionAuthenticated(value: boolean): void {
  authenticated = value
}

export function isAppSessionAuthenticated(): boolean {
  return authenticated
}
