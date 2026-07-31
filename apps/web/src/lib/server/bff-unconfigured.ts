const message = 'Backend endpoint is not configured. Set PUBLIC_OMNIROUTE_BFF_URL for this deployment.';

export function bffUnconfiguredResponse(): Response {
  return Response.json(
    {
      error: 'BFF_NOT_CONFIGURED',
      message,
      remediation: 'Configure PUBLIC_OMNIROUTE_BFF_URL with the HTTPS BFF origin before deploying web.',
    },
    { status: 503 },
  );
}
