// Korte, stabiele hash van een JSON-waarde (djb2), voor antwoordhashes en synchronisatie.
export function hashItem(item) {
  const s = JSON.stringify(item);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
