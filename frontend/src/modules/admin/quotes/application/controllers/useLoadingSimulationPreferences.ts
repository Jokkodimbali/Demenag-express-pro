import { useCallback } from 'react';
import { useApp } from '../../../../shared/application/context';
import { errorMessage } from '../../../../shared/application/error-message';

export function useLoadingSimulationPreferences() {
  const { api, catalogue, setCatalogue } = useApp();
  const laborSettings = catalogue?.settings.movingLaborPlanning;
  const blanketLengthCm = laborSettings?.blanketLengthCm ?? 204;
  const blanketWidthCm = laborSettings?.blanketWidthCm ?? 184;
  const blanketStock = laborSettings?.blanketStock ?? 20;

  const saveBlanketStock = useCallback(
    async (stock: number): Promise<string> => {
      if (!catalogue || stock === blanketStock) return '';
      try {
        const updated = await api.updateCatalogue({
          ...catalogue,
          settings: {
            ...catalogue.settings,
            movingLaborPlanning: {
              maxHandlingHours: 3,
              maxDayHours: 8,
              defaultStartHour: 8,
              maxMoversPerVehicle: 6,
              cubicMetersPerHourPerMover: 2.7,
              pauseMinutes: 30,
              heat: 1,
              wbgtAdj: 0,
              ...catalogue.settings.movingLaborPlanning,
              blanketLengthCm,
              blanketWidthCm,
              blanketStock: stock,
            },
          },
        });
        setCatalogue(updated);
        return '';
      } catch (cause) {
        return errorMessage(cause);
      }
    },
    [api, blanketLengthCm, blanketStock, blanketWidthCm, catalogue, setCatalogue],
  );

  const imageDataUrl = useCallback(async (path: string): Promise<string | null> => {
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      const image = new Image();
      image.src = URL.createObjectURL(await response.blob());
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      URL.revokeObjectURL(image.src);
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }, []);

  return { blanketLengthCm, blanketWidthCm, blanketStock, saveBlanketStock, imageDataUrl };
}
