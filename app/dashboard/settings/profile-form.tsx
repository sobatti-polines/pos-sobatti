"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile } from "./actions";
import { Eye, EyeOff, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ProfileFormState = {
  error?: string | null;
  success?: boolean;
  message?: string | null;
};

const initialState: ProfileFormState = {
  error: null,
  success: false,
  message: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="rounded-full px-6 h-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-normal shrink-0"
      disabled={pending}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Menyimpan...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          Simpan Perubahan
        </span>
      )}
    </Button>
  );
}

export function ProfileForm({ initialUsername }: { initialUsername: string }) {
  const [state, formAction] = useActionState(updateProfile, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-sm flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          {state.message}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Username
          </label>
          <Input
            id="username"
            name="username"
            defaultValue={initialUsername}
            className="w-full sm:max-w-md"
            required
          />
          <p className="text-xs text-muted-foreground mt-2">
            Ini digunakan untuk login ke sistem.
          </p>
        </div>

        <div className="pt-4">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Kata Sandi Baru (Opsional)
          </label>
          <div className="relative sm:max-w-md">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Kosongkan jika tidak ingin diubah"
              className="pr-10 w-full"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Konfirmasi Kata Sandi Baru
          </label>
          <div className="relative sm:max-w-md">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Ulangi kata sandi baru"
              className="pr-10 w-full"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Sembunyikan konfirmasi kata sandi" : "Tampilkan konfirmasi kata sandi"}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <SubmitButton />
      </div>
    </form>
  );
}
