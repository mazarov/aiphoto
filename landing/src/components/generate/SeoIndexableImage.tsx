type SeoIndexableImageProps = {
  src: string;
  srcSet?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  width: number | null;
  height: number | null;
  className?: string;
};

/** One imgproxy URL in `src`. No data-src, 1×1 placeholder, or noscript copy. */
export function SeoIndexableImage({
  src,
  srcSet,
  alt,
  sizes,
  priority = false,
  width,
  height,
  className = "absolute inset-0 h-full w-full object-cover",
}: SeoIndexableImageProps) {
  return (
    <img
      src={src}
      srcSet={srcSet}
      alt={alt}
      sizes={sizes}
      width={width && width > 0 ? width : undefined}
      height={height && height > 0 ? height : undefined}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={className}
    />
  );
}
