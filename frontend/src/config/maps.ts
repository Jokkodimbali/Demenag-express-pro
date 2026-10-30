export const mapConfiguration = {
  tileUrl: 'https://mt{s}.google.com/vt/lyrs=m,traffic&hl=fr&gl=SN&x={x}&y={y}&z={z}',
  tileOptions: {
    subdomains: '0123',
    maxZoom: 20,
    attribution: 'Données cartographiques et trafic © Google',
  },
} as const;

export const liveTrafficTileUrl = () =>
  `${mapConfiguration.tileUrl}&t=${Math.floor(Date.now() / 120000)}`;
