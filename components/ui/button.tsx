// shadcn/ui Button, restyled to our tokens: flat, ink on paper, no shadows.
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent shadow-[0_1px_0_0_rgb(0_0_0/0.04)] hover:bg-accent-strong",
        outline: "border border-rule bg-surface text-ink hover:border-ink/40",
        ghost: "text-ink hover:bg-ink/5",
        danger: "border border-rule bg-surface text-rising hover:border-rising/50",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";
