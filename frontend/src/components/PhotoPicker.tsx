import { uiText } from '../content/reference-ui-text';
import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';

type PhotoPickerProps = {
  label: string;
  files: File[];
  required?: boolean;
  maxPhotos?: number;
  validationError?: string;
  onChange: (files: File[]) => void;
};

export function PhotoPicker({
  label,
  files,
  required = false,
  maxPhotos = 5,
  validationError,
  onChange,
}: PhotoPickerProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  useEffect(() => {
    if (videoRef.current && cameraStream) videoRef.current.srcObject = cameraStream;
    return () => cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);
  function addFiles(selection: FileList | null) {
    if (!selection?.length) return;
    const selected = Array.from(selection);
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setError('Utilisez une image JPG, PNG ou WebP.');
      return;
    }
    if (files.length + selected.length > maxPhotos) {
      setError(`Vous pouvez ajouter ${maxPhotos} photo${maxPhotos > 1 ? 's' : ''} maximum.`);
    } else {
      setError('');
      onChange([...files, ...selected]);
    }
    if (galleryRef.current) galleryRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }
  async function openCamera() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraRef.current?.click();
      return;
    }
    setOpeningCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      setCameraStream(stream);
    } catch {
      setError(
        'Accès caméra refusé ou indisponible. Vérifiez les autorisations de votre navigateur.',
      );
      cameraRef.current?.click();
    } finally {
      setOpeningCamera(false);
    }
  }
  async function takePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || files.length >= maxPhotos) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    );
    if (image)
      onChange([...files, new File([image], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
    setCameraStream(null);
  }
  return (
    <div className="report-photo-picker">
      <p className="report-photo-picker-label" aria-required={required}>
        <Camera size={18} /> {label}{' '}
        <span>
          {files.length}/{maxPhotos}
        </span>
      </p>
      <div className="report-photo-picker-actions">
        <button
          type="button"
          className="button secondary small"
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus size={16} /> {uiText['choisirDesPhotos']}
        </button>
        <button
          type="button"
          className="button secondary small"
          onClick={() => void openCamera()}
          disabled={openingCamera || files.length >= maxPhotos}
        >
          <Camera size={16} /> {uiText['prendreUnePhoto']}
        </button>
      </div>
      <input
        ref={galleryRef}
        className="report-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(event) => addFiles(event.currentTarget.files)}
      />
      <input
        ref={cameraRef}
        className="report-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => addFiles(event.currentTarget.files)}
      />
      {files.length > 0 && (
        <div className="report-photo-previews" aria-label={uiText['apercuDesPhotosAjoutees']}>
          {files.map((file, index) =>
            previews[index] ? (
              <figure key={`${file.name}-${file.lastModified}-${index}`}>
                <img
                  src={previews[index]}
                  alt={`Aperçu de ${file.name || `la photo ${index + 1}`}`}
                />
                <figcaption>{file.name || `Photo ${index + 1}`}</figcaption>
                <button
                  type="button"
                  aria-label={`Retirer la photo ${index + 1}`}
                  onClick={() => onChange(files.filter((_, photoIndex) => photoIndex !== index))}
                >
                  <X size={15} />
                </button>
              </figure>
            ) : null,
          )}
        </div>
      )}
      {(validationError || error) && (
        <small className="field-error" role="alert">
          {validationError || error}
        </small>
      )}
      {cameraStream && (
        <div className="camera-dialog-backdrop" role="presentation">
          <section
            className="camera-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={uiText['prendreUnePhoto2']}
          >
            <video ref={videoRef} autoPlay playsInline muted />
            <p>
              {uiText['cadrezLeVehiculePuisPrenezLaPhoto']}
              {files.length}/{maxPhotos} {uiText['utiliseeS']}
            </p>
            <div>
              <button
                type="button"
                className="button secondary"
                onClick={() => setCameraStream(null)}
              >
                {uiText['annuler']}
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => void takePhoto()}
                disabled={files.length >= maxPhotos}
              >
                <Camera size={17} /> {uiText['capturerLaPhoto']}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
