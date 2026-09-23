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

export function loadAllImages(urls) {
  return Promise.all(urls.map(url => loadImage(url).promise));
}

// ================================================================================================================================================================================================================================================
// getCachedImage

export function getCachedImage(url) {
  return cache[url] || null;
}