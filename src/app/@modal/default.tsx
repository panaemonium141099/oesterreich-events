/**
 * Default content for the @modal parallel slot.
 *
 * Returns null whenever the URL doesn't match an intercepting route
 * inside @modal/. Without this file Next.js would error on routes that
 * have no matching modal segment (e.g. `/`, `/map`, `/blog/...`).
 */
export default function ModalDefault() {
  return null;
}
