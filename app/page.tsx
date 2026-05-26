import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="text-2xl font-light tracking-tight text-foreground">
            POS
          </span>
          <p className="mt-2 text-sm text-muted-foreground">
            Masuk ke akun Anda
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
