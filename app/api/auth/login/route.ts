import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { message: "Username/Email and password are required" },
      { status: 400 }
    );
  }

  // Handle username login by appending default domain if no @ is present
  const loginEmail = email.includes("@") ? email : `${email}@sobats.com`;

  // Build a response object so we can attach Set-Cookie headers from Supabase
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.headers
            .get("cookie")
            ?.split(";")
            .map((c) => {
              const [name, ...rest] = c.trim().split("=");
              return { name, value: rest.join("=") };
            }) ?? [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password,
  });

  if (error || !user) {
    return NextResponse.json(
      { message: "Username/Email atau kata sandi salah. Coba lagi." },
      { status: 401 }
    );
  }

  // Check if user is active in the pengguna table
  const username = loginEmail.split("@")[0];
  const { data: pengguna } = await supabase
    .from("pengguna")
    .select("aktif")
    .eq("username", username)
    .maybeSingle();

  if (pengguna && !pengguna.aktif) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { message: "Akun Anda dinonaktifkan. Silakan hubungi admin." },
      { status: 401 }
    );
  }

  const role = user.user_metadata?.role;

  return NextResponse.json({ ok: true, role }, { 
    headers: response.headers 
  });
}
