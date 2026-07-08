import { Check, X } from "lucide-react";
import {
  PASSWORD_REQUIREMENTS,
  passwordChecks,
  passwordStrength,
} from "@/lib/password";

const STRENGTH_META = [
  { label: "Too weak", color: "bg-red", text: "text-red" },
  { label: "Weak", color: "bg-red", text: "text-red" },
  { label: "Fair", color: "bg-orange", text: "text-orange" },
  { label: "Good", color: "bg-orange", text: "text-orange" },
  { label: "Strong", color: "bg-green", text: "text-green" },
];

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordStrength(password);
  const checks = passwordChecks(password);
  const meta = STRENGTH_META[score] ?? STRENGTH_META[0];

  return (
    <div className="space-y-3">
      <div>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < score ? meta.color : "bg-secondary"
              }`}
            />
          ))}
        </div>
        {password && (
          <p className={`mt-1.5 text-xs font-semibold ${meta.text}`}>
            {meta.label}
          </p>
        )}
      </div>
      <ul className="space-y-1.5">
        {PASSWORD_REQUIREMENTS.map((req, i) => {
          const ok = checks[i];
          return (
            <li
              key={req.label}
              className={`flex items-center gap-2 text-xs ${
                ok ? "text-green" : "text-muted-foreground"
              }`}
            >
              {ok ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0" />
              )}
              {req.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}