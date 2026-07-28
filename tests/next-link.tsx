import type { AnchorHTMLAttributes } from "react";

/**
 * DOM-test stand-in for next/link. A local href renders as the same semantic
 * anchor and retains native focus and keyboard activation behavior.
 */
export default function TestLink(
  props: AnchorHTMLAttributes<HTMLAnchorElement>,
) {
  return <a {...props} />;
}
