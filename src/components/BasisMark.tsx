/**
 * The Basis mark: three columns of ascending height on a shared baseline.
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
      <rect x="4" y="16" width="6" height="12" />
      <rect x="13" y="10" width="6" height="18" />
      <rect x="22" y="4" width="6" height="24" />
    </svg>
  );
}
