import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { Role } from "@prisma/client";
import { MANAGER_ONLY_ROUTES } from "@/lib/permissions/rbac";

export default auth((req) => {
  const { nextUrl, auth: session } = req as any;
  const pathname = nextUrl.pathname;

  // Always allow Next.js internals, static files, and assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Public routes
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    // If already logged in, redirect to dashboard
    if (session?.user && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // API routes — skip middleware (handled by route handlers)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Protected routes: require authentication
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user as any;

  // Force password change
  if (user.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  // Manager-only route check
  const isManagerOnlyRoute = MANAGER_ONLY_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isManagerOnlyRoute && user.role !== Role.MANAGER) {
    return NextResponse.redirect(new URL("/dashboard?error=forbidden", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
