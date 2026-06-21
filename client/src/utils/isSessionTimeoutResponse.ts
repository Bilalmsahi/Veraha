export function isSessionTimeoutResponse(data: unknown): boolean {
  const responseData = data as { error?: string; meta?: { reason?: string } } | undefined;
  return (
    responseData?.meta?.reason === 'session_timeout' ||
    Boolean(responseData?.error?.toLowerCase().includes('inactivity'))
  );
}
