/** El panel y el popup no conocen cómo se persisten los datos. */
export async function request(type, payload = {}) {
  if (!globalThis.chrome?.runtime?.id) throw new Error('Carga la carpeta como extensión de Chrome para utilizar tus datos.');
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || 'No se pudo completar la operación.');
  return response.data;
}
