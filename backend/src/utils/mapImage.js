import http from 'http';
import https from 'https';

export async function downloadImageBuffer(url) {
  if (!url) {
    throw new Error('Image URL is required');
  }

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;

    const request = client.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        response.resume();
        reject(new Error(`Failed to download image: ${response.statusCode} ${response.statusMessage || ''}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });

    request.on('error', reject);
  });
}
