const origin = 'https://fiestasguatemala.com';

export function getIndexNowKey() {
  const key = process.env.INDEXNOW_KEY?.trim() || '7d09a4910ca44fbb8ea731e25f0a645d';
  return /^[a-f0-9]{8,128}$/i.test(key) ? key : '';
}

export async function notifyIndexNow(...paths: string[]) {
  const key = getIndexNowKey();
  if (!key || !paths.length) return;
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'fiestasguatemala.com',
        key,
        keyLocation: origin + '/' + key + '.txt',
        urlList: [...new Set(paths)].map(path => origin + path),
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) console.warn('IndexNow devolvió', response.status);
  } catch (error) {
    console.warn('No se pudo notificar a IndexNow:', error);
  }
}
