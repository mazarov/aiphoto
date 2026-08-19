type HeaderReader = { headers: { get(name: string): string | null } };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const ACQUISITION_VISITOR_HEADER = "x-promptshot-visitor-id";
export const ACQUISITION_SESSION_HEADER = "x-promptshot-session-id";

function readUuid(request: HeaderReader, name: string): string | null {
  const value = request.headers.get(name)?.trim() || "";
  return UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

export function readAcquisitionRequestIds(request: HeaderReader): {
  visitorId: string | null;
  sessionId: string | null;
} {
  return {
    visitorId: readUuid(request, ACQUISITION_VISITOR_HEADER),
    sessionId: readUuid(request, ACQUISITION_SESSION_HEADER),
  };
}
