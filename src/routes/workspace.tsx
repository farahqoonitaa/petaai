import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/workspace")({
  ssr: false,
  component: WorkspaceLayout,
});

const tabs = [
  { to: "/workspace", label: "Run analysis", exact: true },
  { to: "/workspace/corpus", label: "Corpus", exact: false },
  { to: "/workspace/runs", label: "Runs", exact: false },
] as const;

function WorkspaceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16">
        <p className="label-mono">restoring session…</p>
      </div>
    );
  }

  if (!session) return <SignIn />;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono">live analyst workspace · your corpus, your runs</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Coherence engine</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] text-muted-foreground">{session.user.email}</p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="mt-1 font-mono text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            sign out
          </button>
        </div>
      </div>

      <nav className="mt-8 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`-mb-px border-b-2 px-4 py-3 text-sm transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="pt-8">
        <Outlet />
      </div>
    </div>
  );
}

function SignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/workspace` },
          });
    const { error } = await fn;
    setBusy(false);
    if (error) setMessage(error.message);
    else if (mode === "signup") setMessage("Account created. You can start indexing documents now.");
  }

  async function google() {
    setMessage(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) setMessage(result.error.message ?? "Google sign-in failed.");
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="label-mono">restricted · analyst workspace</p>
      <h1 className="mt-3 text-2xl font-semibold">Sign in to run analysis</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Your indexed corpus, runs and findings are private to your account. Planning documents never
        leave your workspace.
      </p>

      <button
        type="button"
        onClick={google}
        className="mt-8 w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-2"
      >
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          or email
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="analyst@bappenas.go.id"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {message ? <p className="mt-4 text-sm text-accent">{message}</p> : null}

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-6 font-mono text-[11px] text-muted-foreground hover:text-foreground"
      >
        {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
