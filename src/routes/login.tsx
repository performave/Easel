import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/login")({
  component: Login,
});

const DEFAULT_DOMAIN = "canvas.duke.edu";

function Login() {
  const [domain, setDomain] = useState(DEFAULT_DOMAIN);
  const [pending, setPending] = useState(false);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const info = await api.beginLogin(domain);
      if (info.authenticated && info.domain) {
        setAuthenticated(info.domain);
        toast.success(`Signed in to ${info.domain}`);
      } else {
        toast.error("Login did not complete");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Login failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in to Canvas</CardTitle>
          <CardDescription>
            Enter your school's Canvas domain. A browser window will open for SSO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Canvas domain</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="canvas.duke.edu"
                autoComplete="off"
                autoFocus
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Waiting for sign-in…" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
