// Skeleton shaped like the brief: header, headline, ranked rows.
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-10" aria-busy="true" aria-label="Loading the brief">
      <div className="flex justify-between border-b border-rule pb-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-8 w-full max-w-3xl" />
        <Skeleton className="h-8 w-2/3 max-w-2xl" />
      </div>
      <div>
        <Skeleton className="mb-3 h-6 w-64" />
        {Array.from({ length: 7 }).map((_, i) => (
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
