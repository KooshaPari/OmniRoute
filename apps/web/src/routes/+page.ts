import { redirect } from "@sveltejs/kit";

// Root has no standalone product page. Send the shell straight to the dashboard.
// (A public landing page, if needed, lives at /landing.)
export function load() {
  throw redirect(307, "/dashboard");
}
