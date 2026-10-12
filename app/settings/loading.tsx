import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading settings">
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3 border-b border-rule pb-5">
          <Skeleton className="h-9 w-full max-w-xl" />
          <Skeleton className="h-14 w-full max-w-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((__, j) => (
              <Skeleton key={j} className="h-6 w-24" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
