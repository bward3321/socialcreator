import { cn } from "@/lib/utils";

const variants = {
  default: "bg-surface border border-border text-zinc-400",
  success: "bg-accent/10 text-accent border border-accent/20",
  danger: "bg-danger/10 text-danger border border-danger/20",
  warning: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  purple: "bg-purple/10 text-purple border border-purple/20",
};

export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: keyof typeof variants;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
