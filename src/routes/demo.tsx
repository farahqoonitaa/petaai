import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PROVISIONAL_NOTICE } from "@/lib/peta-data";
import { ProvisionalBanner } from "@/components/peta/primitives";

export const Route = createFileRoute("/demo")({
  component: DemoLayout,
});

const tabs = [
  { to: "/demo", label: "Coherence findings", exact: true },
  { to: "/demo/graph", label: "Program criticality", exact: false },
  { to: "/demo/simulator", label: "Policy flight simulator", exact: false },
] as const;

function DemoLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono">analyst workspace · RPJMN 2025–2029 (demo corpus)</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Coherence workspace</h1>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          last full pass · pass 4 of 4 · 9,412 pages
        </p>
      </div>

      <div className="mt-6">
        <ProvisionalBanner text={PROVISIONAL_NOTICE} />
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
