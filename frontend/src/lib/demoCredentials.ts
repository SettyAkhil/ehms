export interface DemoCredential {
  username: string
  localPassword: string
  backendUsername: string
  backendPassword: string
}

const LOCAL_PASSWORD = "password123"

export const DEMO_CREDENTIALS: Record<string, DemoCredential> = {
  admin: {
    username: "admin",
    localPassword: LOCAL_PASSWORD,
    backendUsername: "admin",
    backendPassword: "Admin@123",
  },
}

export function credentialsForRole(roleKey: string): DemoCredential | undefined {
  const k = roleKey.trim().toLowerCase()
  return DEMO_CREDENTIALS[k] || DEMO_CREDENTIALS["admin"]
}
