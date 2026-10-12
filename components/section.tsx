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
      <header className="flex flex-col gap-4 border-t border-rule pt-7 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p aria-hidden="true" className="tabular text-xs font-semibold tracking-wide text-accent">
            {String(number).padStart(2, "0")}
          </p>
          <h2 id={`${id}-heading`} className="mt-1.5 text-[1.6rem] font-semibold leading-tight tracking-[-0.015em]">
            <span className="sr-only">{number}. </span>
            {question}
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{lead}</p>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      <div className="mt-7">{children}</div>
    </section>
  );
}
