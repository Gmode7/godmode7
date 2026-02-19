export const VALID_SCOPES = [
  "projects:read",
  "projects:write",
  "jobs:read",
  "jobs:write",
  "chat:read",
  "chat:write",
  "artifacts:read",
  "artifacts:write",
  "admin:read",
  "admin:write",
] as const;

export type Scope = (typeof VALID_SCOPES)[number];

export const DEFAULT_SCOPES: Scope[] = [
  "projects:read",
  "projects:write",
  "jobs:read",
  "jobs:write",
  "chat:read",
  "chat:write",
  "artifacts:read",
  "artifacts:write",
];

export const ALL_SCOPES: Scope[] = [...VALID_SCOPES];

export function parseScopes(scopeStr: string): Scope[] {
  if (!scopeStr || scopeStr.trim() === "") return [];
  return scopeStr
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Scope => VALID_SCOPES.includes(s as Scope));
}

export function scopesToString(scopes: Scope[]): string {
  return scopes.join(",");
}

export function hasScope(userScopes: Scope[], required: Scope): boolean {
  return userScopes.includes(required);
}
