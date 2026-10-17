const origin = process.env.RENDER_API_ORIGIN;
if (!origin) throw new Error('RENDER_API_ORIGIN doit contenir l’URL HTTPS du backend Render.');
const url = new URL(origin);
if (
  url.protocol !== 'https:' ||
  url.username ||
  url.password ||
  url.pathname !== '/' ||
  url.search ||
  url.hash
)
  throw new Error('RENDER_API_ORIGIN doit être une origine HTTPS sans chemin ni identifiants.');

export const config = {
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api/:path*', destination: `${url.origin}/api/:path*` },
    { source: '/(.*)', destination: '/index.html' },
  ],
};
