import { cn } from "@/lib/utils";

type Variant = "flat" | "raised" | "inset";

const VARIANTS: Record<Variant, string> = {
  /**
   * The default. No border, no background — structure comes from the hairline
   * rules and spacing around it. Most panels in this design are `flat`; if
   * everything is a box again, the redesign has failed.
   */
  flat: "",
  /** Lifts off the paper. Reserve for things that overlay: modals, popovers, tooltips. */
  raised: "bg-paper-raised border border-rule rounded-lg shadow-raised",
  /** Recessed well. For inputs, code blocks, and grouped controls. */
  inset: "bg-paper-sunken border border-rule rounded-lg",
};

export function Surface({
  variant = "flat",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div className={cn(VARIANTS[variant], className)} {...props}>
      {children}
    </div>
  );
}
