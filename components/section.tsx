// A numbered brief section: the question it answers, and one line on how to read it.
import { cn } from "@/lib/utils";

export function BriefSection({
  id,
  number,
  question,
  lead,
  aside,
  className,
  children,
}: {
  id: string;
  number: number;
  question: string;
  lead: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("scroll-mt-6", className)}>
      <header className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-t border-rule pt-6 sm:grid-cols-[3.25rem_1fr_auto] sm:items-start">
        <span aria-hidden="true" className="tabular font-serif text-4xl leading-none text-accent sm:text-5xl">
          {number}
        </span>
        <div>
          <h2 id={`${id}-heading`} className="text-xl font-semibold tracking-tight sm:text-2xl">
            <span className="sr-only">{number}. </span>
            {question}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{lead}</p>
        </div>
        {aside && <div className="col-span-2 mt-3 sm:col-span-1 sm:mt-0">{aside}</div>}
      </header>
      <div className="mt-6">{children}</div>
    </section>
  );
}
