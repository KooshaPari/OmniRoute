/**
 * Response validation for outbound fetch calls.
 *
 * A transport, proxy wrapper or test stub can resolve to something that is not a
 * Response. Every caller immediately dereferences `.headers`/`.status`/`.text()`,
 * so the failure surfaces as an opaque "Cannot read properties of undefined"
 * far from the real cause. Validate once at the boundary instead.
 */
export function ensureFetchResponse(response: unknown): Response {
  if (
    !response ||
    typeof (response as Response).headers !== "object" ||
    typeof (response as Response).text !== "function"
  ) {
    throw new Error("Upstream fetch returned an invalid response");
  }
  return response as Response;
}
