export const mapConfiguration = {
  tileUrl: 'https://mt{s}.google.com/vt/lyrs=m&hl=fr&gl=SN&x={x}&y={y}&z={z}',
  tileOptions: {
    subdomains: '0123',
    maxZoom: 20,
    attribution: 'Données cartographiques © Google',
  },
} as const;
