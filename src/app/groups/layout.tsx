/**
 * /groups parent layout — passthrough.
 *
 * fn-15.5 round-12 (codex): NO AppShell here. Parent layouts in the
 * App Router wrap every child segment, so mounting AppShell at this
 * level forced /groups/[id] (plan detail, which has its own minimal
 * provider needs) to also pay for the full social shell. The list
 * route /groups/page.tsx now mounts AppShell directly, and
 * /groups/[id]/layout.tsx mounts its own ModalShell. This layout
 * stays as a pass-through so Next.js can still build the route tree.
 */
export default function GroupsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
