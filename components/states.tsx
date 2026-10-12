// Shared empty and error states. Errors say what failed and what to do. No apologies.
import { AlertTriangle, Database } from "lucide-react";
import type { Loaded } from "@/lib/queries";

export function LoadError({ result }: { result: Extract<Loaded<unknown>, { ok: false }> }) {
  if (result.kind === "config" || result.kind === "schema") {
    return (
      <section className="max-w-2xl border-l-2 border-ink py-1 pl-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Database aria-hidden="true" className="size-5" />
          {result.kind === "config" ? "Database not connected" : "Database not set up"}
        </h1>
        <p className="mt-2 text-muted">{result.message}</p>
        <pre className="mt-4 overflow-x-auto rounded-md border border-rule bg-surface p-3 text-sm">
          {`npm run db:migrate\nnpm run db:seed`}
        </pre>
      </section>
    );
  }
  return <ErrorState title="Could not load this page" message={result.message} action="Reload the page. If it keeps failing, check the run log and the server logs." />;
}

export function ErrorState({ title, message, action }: { title: string; message: string; action: string }) {
  return (
    <section role="alert" className="max-w-2xl border-l-2 border-rising py-1 pl-5">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <AlertTriangle aria-hidden="true" className="size-5 text-rising" />
        {title}
      </h1>
      <p className="mt-2 break-words text-sm">{message}</p>
      <p className="mt-2 text-sm text-muted">{action}</p>
    </section>
  );
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}
