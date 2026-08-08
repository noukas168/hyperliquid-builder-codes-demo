/**
 * The Basis mark: two horizontal bars, offset across and down, with the gap
 * between them stepping diagonally. The gap is the mark.
 *
 * Inlined rather than loaded from /brand/mark.svg because an <img> renders in
 * its own document and cannot inherit currentColor, which is the whole point of
 * the asset: the mark takes its colour from a text class, so it can never drift
 * from the brand token.
 *
 * The geometry is identical to public/brand/mark.svg, and both are generated
 * from the constants in scripts/generate-brand.mjs. That script is the place to
 * change it.
 *
 * Decorative here by default: in the header it sits beside the wordmark, and
 * announcing "Basis" twice helps nobody. Pass a label where it stands alone.
 */
export default function BasisMark({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="currentColor"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect x="4" y="10" width="20" height="4" rx="1" />
      <rect x="8" y="18" width="20" height="4" rx="1" />
    </svg>
  );
}
