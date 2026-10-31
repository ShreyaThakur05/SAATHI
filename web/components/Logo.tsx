/* The Saathi mark. A plain <img> keeps this usable in server and client components alike. */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={size > 64 ? "/brand/saathi-logo.png" : "/brand/saathi-logo-128.png"}
      width={size}
      height={size}
      alt=""
      aria-hidden
      className={className}
      draggable={false}
    />
  );
}
