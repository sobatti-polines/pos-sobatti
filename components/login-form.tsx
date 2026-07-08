"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FieldErrors = {
  identifier?: string;
  password?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function validate(fields: { identifier?: string; password?: string }): FieldErrors {
    const errors: FieldErrors = {};
    if (fields.identifier !== undefined) {
      if (!fields.identifier.trim()) {
        errors.identifier = "Masukkan username atau email";
      }
    }
    if (fields.password !== undefined) {
      if (!fields.password) {
        errors.password = "Masukkan kata sandi";
      }
    }
    return errors;
  }



  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const errors = validate({ identifier, password });
    setFieldErrors(errors);
    setTouched({ identifier: true, password: true });

    if (errors.identifier || errors.password) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: identifier, password }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setServerError(data.message || "Username/Email atau kata sandi salah. Coba lagi.");
          return;
        }

        const { role } = await res.json();
        
        router.refresh();
        if (role === "KASIR") {
          router.push("/pos");
        } else if (role === "KARYAWAN") {
          router.push("/attendance/scan");
        } else {
          router.push("/dashboard");
        }
      } catch {
        setServerError("Koneksi gagal. Periksa jaringan Anda.");
      }
    });
  }

  const hasAnyError = Object.values(fieldErrors).some(Boolean);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm" noValidate>
      {serverError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-[6px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Username atau Email</Label>
          <Input
            id="identifier"
            type="text"
            placeholder="admin atau nama@perusahaan.com"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
            }}
            aria-invalid={!!fieldErrors.identifier}
            aria-describedby={fieldErrors.identifier ? "identifier-error" : undefined}
            disabled={isPending}
            autoComplete="username"
            autoFocus
          />
          {fieldErrors.identifier && (
            <p id="identifier-error" className="text-xs text-destructive" role="alert">
              {fieldErrors.identifier}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Masukkan kata sandi"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              disabled={isPending}
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Sembunyikan" : "Tampilkan"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" className="text-xs text-destructive" role="alert">
              {fieldErrors.password}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className={cn(
          "mt-6 w-full rounded-full h-10 px-4 text-base font-normal",
          hasAnyError && touched.identifier && touched.password && "animate-[shake_0.3s_ease-in-out]"
        )}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Masuk
          </span>
        ) : (
          "Masuk"
        )}
      </Button>
    </form>
  );
}
