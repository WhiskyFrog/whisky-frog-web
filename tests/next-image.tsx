import type { ImgHTMLAttributes } from "react";

type TestImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  unoptimized?: boolean;
};

/**
 * DOM-test stand-in for next/image. Production rendering still uses Next's
 * component; tests need only the resulting image semantics.
 */
export default function TestImage({
  priority: _priority,
  unoptimized: _unoptimized,
  ...props
}: TestImageProps) {
  return <img {...props} />;
}
