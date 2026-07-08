export interface PasswordCheck {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordCheck[] = [
  { label: "Minimum 12 characters", test: (pw) => pw.length >= 12 },
  { label: "At least one uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "At least one lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "At least one number", test: (pw) => /[0-9]/.test(pw) },
  {
    label: "At least one special character",
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
];

export function passwordChecks(pw: string): boolean[] {
  return PASSWORD_REQUIREMENTS.map((r) => r.test(pw));
}

export function isPasswordValid(pw: string): boolean {
  return PASSWORD_REQUIREMENTS.every((r) => r.test(pw));
}

/** Returns strength 0-4 based on how many requirements are met. */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  return passwordChecks(pw).filter(Boolean).length;
}

/** Simple client-side rate limiter backed by localStorage. Best-effort only. */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  if (typeof window === "undefined") return { allowed: true, retryAfterMs: 0 };
  const storeKey = `rl:${key}`;
  const now = Date.now();
  let stamps: number[] = [];
  try {
    stamps = JSON.parse(localStorage.getItem(storeKey) ?? "[]");
  } catch {
    stamps = [];
  }
  stamps = stamps.filter((t) => now - t < windowMs);
  if (stamps.length >= maxAttempts) {
    const retryAfterMs = windowMs - (now - stamps[0]);
    return { allowed: false, retryAfterMs };
  }
  stamps.push(now);
  localStorage.setItem(storeKey, JSON.stringify(stamps));
  return { allowed: true, retryAfterMs: 0 };
}