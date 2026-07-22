import Image from "next/image";
import { LoginForm } from "@/components/login-form";
import loginLogo from "@/public/login-logo.jpeg";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src={loginLogo}
            alt="PLK POS"
            className="mb-4 rounded-xl"
            width={120}
            height={120}
            priority
          />
          <span className="text-2xl font-light tracking-tight text-foreground">
            PLK POS
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
