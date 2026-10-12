// Skeleton shaped like the dashboard: SignalForge header, brief card, key numbers, ranked rows.
import { SignalMark } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading the SignalForge Weekly Intelligence Brief">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-11 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="rounded-2xl border border-rule bg-surface px-5 py-6 sm:px-8 sm:py-8">
        <p className="flex items-center gap-2 text-sm text-muted">
          <SignalMark size={18} className="text-muted motion-safe:animate-pulse" />
          Reading this week&apos;s signals…
        </p>
        <div className="mt-5 space-y-3">
          <Skeleton className="h-8 w-full max-w-3xl" />
          <Skeleton className="h-8 w-2/3 max-w-2xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-rule bg-surface p-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[2rem_1fr_5rem] items-center gap-3 border-b border-rule py-5 md:grid-cols-[2rem_1fr_5rem_8rem_7rem_9rem]">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="hidden h-6 w-20 md:block" />
            <Skeleton className="hidden h-7 w-24 md:block" />
            <Skeleton className="hidden h-3 w-32 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
