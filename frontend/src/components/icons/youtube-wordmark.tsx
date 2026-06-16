import type { ImgHTMLAttributes } from "react";

type YouTubePlayLogoProps = ImgHTMLAttributes<HTMLImageElement>;

export function YouTubePlayLogo({ className, ...props }: YouTubePlayLogoProps) {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden="true"
      className={className}
      draggable={false}
      {...props}
    />
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
