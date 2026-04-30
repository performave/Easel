import { useEffect } from "react";
import { Outlet, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  const status = useAuthStore((s) => s.status);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let cancelled = false;
    api
      .bootstrap()
      .then((info) => {
        if (cancelled) return;
        if (info.authenticated && info.domain) {
          setAuthenticated(info.domain);
        } else {
          setUnauthenticated();
        }
      })
      .catch(() => {
        if (!cancelled) setUnauthenticated();
      });
    return () => {
      cancelled = true;
    };
  }, [setAuthenticated, setUnauthenticated]);

  useEffect(() => {
    if (status === "unknown") return;
    if (status === "unauthenticated" && pathname !== "/login") {
      navigate({ to: "/login", replace: true });
    } else if (status === "authenticated" && (pathname === "/login" || pathname === "/")) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [status, pathname, navigate]);

  if (status === "unknown") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <>
      <Outlet />
      <Toaster richColors position="bottom-right" />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}
