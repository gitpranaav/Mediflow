import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/src/lib/auth/session";

const PUBLIC_PATHS = new Set(["/login", "/receptionist/login"]);

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const relaxedAuth = process.env.NODE_ENV !== "production" && process.env.CLINIQ_RELAXED_AUTH === "true";
  const session = await verifySessionToken(request.cookies.get(getSessionCookieName())?.value);

  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_PATHS.has(pathname);
  const isDoctorRoute = pathname.startsWith("/doctor");
  const isReceptionistRoute = pathname.startsWith("/receptionist");
  const isLoggedIn = Boolean(session);

  if (!isLoggedIn && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = isReceptionistRoute ? "/receptionist/login" : "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isLoggedIn && isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    if (session?.role === "receptionist") {
      redirectUrl.pathname = "/receptionist/patients";
      return NextResponse.redirect(redirectUrl);
    }
    if (session?.role === "doctor" || relaxedAuth) {
      redirectUrl.pathname = "/doctor";
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  if (isLoggedIn && isDoctorRoute) {
    if (!relaxedAuth && session?.role !== "doctor") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("reason", "forbidden");
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isLoggedIn && isReceptionistRoute) {
    if (!relaxedAuth && session?.role !== "receptionist") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("reason", "forbidden");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
