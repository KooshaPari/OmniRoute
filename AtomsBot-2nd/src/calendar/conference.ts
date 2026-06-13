export function getConferenceLink(event: any): string | undefined {
  // Prefer conferenceData entryPoints of type 'video'
  const eps: any[] = event?.conferenceData?.entryPoints || [];
  const video = eps.find((e) => e.entryPointType === 'video' && typeof e.uri === 'string' && e.uri.length > 0);
  if (video?.uri) return video.uri;
  // Fallback to hangoutLink
  if (typeof event?.hangoutLink === 'string' && event.hangoutLink.length > 0) return event.hangoutLink;
  // Fallback to any entry point URL
  const anyEp = eps.find((e) => typeof e?.uri === 'string' && e.uri.length > 0);
  if (anyEp?.uri) return anyEp.uri;
  // Finally fallback to Calendar htmlLink
  if (typeof event?.htmlLink === 'string' && event.htmlLink.length > 0) return event.htmlLink;
  return undefined;
}

