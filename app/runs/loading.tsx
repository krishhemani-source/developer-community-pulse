import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading run log">
      <Skeleton className="mb-8 h-8 w-40" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b border-rule py-3">
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-56" />
          <Skeleton className="ml-auto hidden h-5 w-64 sm:block" />
        </div>
      ))}
    </div>
  );
}
