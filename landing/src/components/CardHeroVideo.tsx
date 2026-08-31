type Props = {
  src: string;
  poster?: string | null;
  className?: string;
};

export function CardHeroVideo({ src, poster, className = "" }: Props) {
  return (
    <video
      src={src}
      poster={poster || undefined}
      controls
      muted
      loop
      autoPlay
      playsInline
      preload="metadata"
      className={`h-full w-full object-contain ${className}`.trim()}
    />
  );
}
