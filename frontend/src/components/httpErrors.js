export function isHandledByGlobalInterceptor(status) {
  return status === 401 || status === 403 || !status || status >= 500;
}
