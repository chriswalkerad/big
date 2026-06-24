import { redirect } from "next/navigation";

/** The seeded project the app opens inside (see src/lib/seed-data.ts). */
const SEEDED_PROJECT_ID = "proj-eloise";

/**
 * The app always opens inside the seeded project's library, so the index route
 * redirects there. `redirect` (Next 16, App Router) throws `NEXT_REDIRECT` to
 * terminate rendering; it returns `never`, so no JSX is reached or returned.
 */
export default function Home(): never {
  redirect(`/p/${SEEDED_PROJECT_ID}`);
}
