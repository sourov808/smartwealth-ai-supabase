import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The brand mark. Serif, lowercase, with an accent point — a masthead rather
 * than a logo lockup. Replaces the icon-in-a-rounded-box that made the app look
 * like every other dashboard template.
 *
 * `href` is nullable because the auth screen shows this to signed-out users,
 * where linking to /dashboard would bounce them through a redirect straight
 * back to where they already are. Pass `href={null}` there.
 */
export function Wordmark({
  href = "/dashboard",
  className,
}: {
  href?: string | null;
  className?: string;
}) {
  const classes = cn(
    "display inline-flex items-baseline gap-1 text-xl text-ink",
    className
  );

  const content = (
    <>
      <span>track</span>
      <span className="h-1 w-1 translate-y-[-2px] rounded-full bg-accent" aria-hidden />
    </>
  );

  if (href === null) {
    return <span className={classes}>{content}</span>;
  }

  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
