import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const KASIR_ALLOWED = ["/pos", "/dashboard/tutup-kasir", "/dashboard/attendance/scan", "/dashboard/attendance/history"];
const KARYAWAN_ALLOWED = ["/dashboard", "/dashboard/attendance/scan", "/dashboard/attendance/history"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return response;
  }

  const role = user.user_metadata?.role;
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/dashboard")) {
    return response;
  }

  if (role === "KASIR") {
    if (!KASIR_ALLOWED.includes(pathname)) {
      return NextResponse.redirect(new URL("/pos", request.url));
    }
  }

  if (role === "KARYAWAN") {
    if (!KARYAWAN_ALLOWED.includes(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: "/dashboard/:path*",
};
