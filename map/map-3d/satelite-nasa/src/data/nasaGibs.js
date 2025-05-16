/**
 * nasaGibs.js
 * Funções para obter metadados e tiles da NASA GIBS (WMTS/WMS).
 */

// Retorna o XML de capabilities do serviço WMS
export async function fetchGibsCapabilities() {
  const url =
    'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GIBS GetCapabilities HTTP ${res.status}`);
  }
  return await res.text();
}

// Monta URL de tile WMTS dinâmico
export function makeTileUrl(x, y, z, layer, dateISO) {
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` +
    `${layer}/default/${dateISO}/${z}/${y}/${x}.jpg`
  );
}

// Carrega imagem de tile com retry em caso de falha
export async function loadImageWithRetry(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await img.decode();
      return img;
    } catch (err) {
      console.warn(`[GIBS] Erro ao carregar ${url}, tentativa ${attempt}`, err);
      if (attempt === retries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
