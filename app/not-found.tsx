import Link from "next/link";

export default function NotFound() {
  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">That topic or week does not exist. It may have been typed wrongly in the address bar.</p>
      <Link href="/" className="mt-4 inline-block underline">
        Back to the Intelligence Brief
      </Link>
    </section>
  );
}
