// shared/image-loader.js

const cache = {};

// ================================================================================================================================================================================================================================================
// loadImage

export function loadImage(url) {
  if (cache[url]) return cache[url];

  const entry = { img: new Image(), status: 'loading', url };
  entry.promise = new Promise((resolve, reject) => {
    entry.img.onload = () => { entry.status = 'ok'; resolve(entry.img); };
    entry.img.onerror = () => {
      entry.status = 'error';
      reject(new Error(`Failed to load: ${url}`));
    };
  });
  entry.img.src = url;
  cache[url] = entry;
  return entry;
}

// ================================================================================================================================================================================================================================================
// loadAllImages
// onProgress(feitas, total) é chamado a cada imagem que termina (ou falha).

export function loadAllImages(urls, onProgress = null) {
  let done = 0;
  return Promise.all(urls.map(url => loadImage(url).promise.finally(() => {
    done++;
    if (onProgress) onProgress(done, urls.length);
  })));
}

// ================================================================================================================================================================================================================================================
// getCachedImage

export function getCachedImage(url) {
  return cache[url] || null;
}