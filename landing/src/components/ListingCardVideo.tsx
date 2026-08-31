type Props = {
  src: string;
  poster?: string | null;
  className?: string;
};

/** Muted loop on listing tiles — same motion language as /generations history. */
export function ListingCardVideo({ src, poster, className = "" }: Props) {
  return (
    <video
      src={src}
      poster={poster || undefined}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      className={`absolute inset-0 z-[2] h-full w-full object-cover ${className}`.trim()}
    />
  );
}
