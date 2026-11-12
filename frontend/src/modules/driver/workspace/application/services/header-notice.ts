export function showHeaderSuccess(message: string) {
  window.dispatchEvent(new CustomEvent('demenag:header-success', { detail: message }));
}
