let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>): void {
  _getToken = fn;
}

export function getToken(): Promise<string | null> {
  return _getToken ? _getToken() : Promise.resolve(null);
}
