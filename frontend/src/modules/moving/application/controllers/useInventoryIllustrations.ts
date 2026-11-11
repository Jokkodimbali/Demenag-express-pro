import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../../shared/application/context';
import {
  compressInventoryIllustration,
  readLegacyInventoryIllustration,
  removeLegacyInventoryIllustration,
} from '../services/inventory-illustrations';

export function useInventoryIllustrations(keys: string[], canManage: boolean) {
  const { api } = useApp();
  const [images, setImages] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const keySignature = keys.join('\u001f');

  useEffect(() => {
    let active = true;
    const imageKeys = keySignature ? keySignature.split('\u001f') : [];
    void Promise.all(
      imageKeys.map(async (key) => {
        const stored = await api.inventoryIllustration(key);
        if (stored) return [key, stored] as const;
        const legacy = canManage
          ? await readLegacyInventoryIllustration(key).catch(() => null)
          : null;
        if (legacy && canManage) {
          try {
            await api.saveInventoryIllustration(key, legacy);
            await removeLegacyInventoryIllustration(key);
          } catch {
            // L’image locale reste visible et sera retentée au prochain affichage.
          }
        }
        return [key, legacy] as const;
      }),
    )
      .then((entries) => {
        if (active)
          setImages(
            Object.fromEntries(entries.filter((entry) => entry[1])) as Record<string, string>,
          );
      })
      .catch(() => {
        if (active) setError("Les images enregistrées n'ont pas pu être chargées.");
      });
    return () => {
      active = false;
    };
  }, [api, canManage, keySignature]);

  const upload = useCallback(
    async (key: string, file: File | undefined) => {
      if (!file) return;
      setError('');
      try {
        const image = await compressInventoryIllustration(file);
        await api.saveInventoryIllustration(key, image);
        setImages((current) => ({ ...current, [key]: image }));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "L'image n'a pas pu être enregistrée.");
      }
    },
    [api],
  );

  return { images, error, upload };
}
