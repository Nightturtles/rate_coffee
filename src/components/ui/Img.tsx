/* eslint-disable @next/next/no-img-element -- remote hosts vary; sizing is handled by the CDNs via imgSrc */
import { imgSrc, imgSrcSet } from "@/lib/images";

/** A remote photo, cropped to its box. `width` is the CSS width it will render at (used for the srcset). */
export function Photo({ src, alt, width, sizes, priority, className = "" }: { src: string; alt: string; width: number; sizes?: string; priority?: boolean; className?: string }) {
  return (
    <img
      src={imgSrc(src, width)}
      srcSet={imgSrcSet(src, width)}
      sizes={sizes ?? `${width}px`}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

/**
 * Square thumbnail. `icon` is a brand mark, shown whole on white like an app icon; `src` is a photo,
 * cropped to fill. Without either it falls back to a quiet tile with the name's initial.
 */
export function Thumb({ src, icon, name, size = 64, className = "" }: { src?: string | null; icon?: string | null; name: string; size?: number; className?: string }) {
  return (
    <span className={`block shrink-0 overflow-hidden rounded-[2px] ${icon ? "bg-white" : "bg-surface-2"} ${className}`} style={{ width: size, height: size }} aria-hidden={!src && !icon}>
      {icon ? (
        <Photo src={icon} alt={name} width={size} className="!object-contain p-[10%]" />
      ) : src ? (
        <Photo src={src} alt={name} width={size} />
      ) : (
        <span className="font-display flex h-full w-full items-center justify-center text-muted" style={{ fontSize: size * 0.4, fontWeight: 300 }}>
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** Wide hero band for detail pages. */
export function Hero({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="aspect-[16/9] w-full overflow-hidden rounded-[2px] bg-surface-2 sm:aspect-[21/9]">
      <Photo src={src} alt={alt} width={768} sizes="(min-width: 768px) 768px, 100vw" priority />
    </div>
  );
}
