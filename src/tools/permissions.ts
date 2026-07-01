let _sessionApproved = false;

export function isSessionApproved(): boolean {
  return _sessionApproved;
}

export function approveSession(): void {
  _sessionApproved = true;
}
