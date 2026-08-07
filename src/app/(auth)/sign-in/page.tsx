"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { Brand } from "@/components/shell/brand";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? "Sign in failed");
        return;
      }
      router.push("/");
    } catch {
      setError("Could not reach the server -- please check your connection and try again.");
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border p-8 shadow-sm">
        <Brand className="mx-auto my-6 block h-20 w-auto" />
        <h1 className="text-lg font-semibold">Sign in</h1>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm">Email</Label>
          <Input id="email" type="email" className="h-11" placeholder="you@restaurant.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              className="h-11 pr-10"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide" : "Show"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowForgotPassword((v) => !v)}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </button>
          {showForgotPassword && (
            <p className="text-sm text-muted-foreground">
              Contact your restaurant owner or Super Admin to reset your password for you.
            </p>
          )}
        </div>
        {error && <p className="text-base text-destructive">{error}</p>}
        <Button type="submit" className="h-12 w-full text-base">Sign in</Button>
      </form>
    </div>
  );
}
