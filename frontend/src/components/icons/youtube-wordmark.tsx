import type { SVGProps } from "react";

type YouTubePlayLogoProps = SVGProps<SVGSVGElement>;

export function YouTubePlayLogo({ className, ...props }: YouTubePlayLogoProps) {
  return (
    <svg
      viewBox="0 0 28 20"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <rect width="28" height="20" rx="5" className="fill-red-600" />
      <path d="M11.15 5.85v8.3L18.55 10l-7.4-4.15Z" className="fill-white" />
    </svg>
  );
}

type YouTubeWordmarkProps = {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
};

export function YouTubeWordmark({
  className,
  iconClassName,
  textClassName,
}: YouTubeWordmarkProps) {
  return (
    <span className={className}>
      <YouTubePlayLogo className={iconClassName} />
      <span className={textClassName}>YouTube</span>
    </span>
  );
}
