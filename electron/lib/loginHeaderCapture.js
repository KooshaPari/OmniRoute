"use strict";

function captureConfiguredHeaders(tokenSources, requestHeaders, credentials) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(requestHeaders || {}).map(([name, value]) => [name.toLowerCase(), value])
  );

  for (const source of tokenSources || []) {
    if (source.type !== "header" || credentials[source.name]) continue;
    const value = normalizedHeaders[source.name.toLowerCase()];
    if (typeof value === "string" && value.trim()) {
      credentials[source.name] = value.trim();
    }
  }
}

module.exports = { captureConfiguredHeaders };
