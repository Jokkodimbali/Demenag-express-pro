import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { dataUrl } from '../application/validation/forms';

type TracePoint = { x: number; y: number };

export function VehiclePhotoEditor({
  label,
  value,
  onChange,
  dimensions,
  measurements,
  previewClassName,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (image: string) => void;
  dimensions: { width: number; height: number };
  measurements: { className: string; label: string }[];
  previewClassName: string;
  required?: boolean;
}) {
  const [error, setError] = useState('');
  const [tracing, setTracing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [points, setPoints] = useState<TracePoint[]>([]);
  const drag = useRef<{ x: number; y: number } | null>(null);

  async function chooseFile(file: File | null) {
    if (!file) return;
    setError('');
    try {
      const source = await dataUrl(file, value);
      onChange(await normalizeImage(source));
      setPoints([]);
    } catch {
      setError('Image trop volumineuse. Choisissez un fichier inférieur à 2,5 Mo.');
    }
  }

  function normalizeImage(source: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Canvas indisponible'));
        const scale = Math.max(
          dimensions.width / image.naturalWidth,
          dimensions.height / image.naturalHeight,
        );
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(
          image,
          (dimensions.width - width) / 2,
          (dimensions.height - height) / 2,
          width,
          height,
        );
        resolve(canvas.toDataURL('image/webp', 0.9));
      };
      image.onerror = () => reject(new Error('Image illisible'));
      image.src = source;
    });
  }

  function autoCutout() {
    if (!value) return;
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return setError('Le détourage automatique est indisponible sur ce navigateur.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = pixels;
      const width = canvas.width;
      const height = canvas.height;
      const count = width * height;
      const queue = new Uint32Array(count);
      const seen = new Uint8Array(count);
      const corners = [0, (width - 1) * 4, (height - 1) * width * 4, (count - 1) * 4];
      const background = [0, 1, 2].map(
        (channel) =>
          corners.reduce((sum, index) => sum + data[index + channel], 0) / corners.length,
      );
      let head = 0;
      let tail = 0;
      const enqueue = (index: number) => {
        if (seen[index]) return;
        seen[index] = 1;
        const pixel = index * 4;
        const distance =
          Math.abs(data[pixel] - background[0]) +
          Math.abs(data[pixel + 1] - background[1]) +
          Math.abs(data[pixel + 2] - background[2]);
        if (distance > 78 || data[pixel + 3] < 12) return;
        data[pixel + 3] = 0;
        queue[tail++] = index;
      };
      for (let x = 0; x < width; x++) {
        enqueue(x);
        enqueue((height - 1) * width + x);
      }
      for (let y = 1; y < height - 1; y++) {
        enqueue(y * width);
        enqueue(y * width + width - 1);
      }
      while (head < tail) {
        const index = queue[head++];
        const x = index % width;
        if (x > 0) enqueue(index - 1);
        if (x + 1 < width) enqueue(index + 1);
        if (index >= width) enqueue(index - width);
        if (index + width < count) enqueue(index + width);
      }
      context.putImageData(pixels, 0, 0);
      onChange(canvas.toDataURL('image/webp', 0.9));
      setError('');
    };
    image.onerror = () => setError('Cette image ne peut pas être traitée.');
    image.src = value;
  }

  function addTracePoint(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.max(0, Math.min(1000, ((event.clientX - bounds.left) / bounds.width) * 1000)),
      y: Math.max(0, Math.min(1000, ((event.clientY - bounds.top) / bounds.height) * 1000)),
    };
    setPoints((current) => [...current, point]);
  }

  function applyTrace() {
    if (points.length < 3 || !value) return;
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return setError('Le détourage manuel est indisponible sur ce navigateur.');
      context.fillStyle = '#27292D';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.beginPath();
      points.forEach((point, index) => {
        const x = (point.x / 1000) * canvas.width;
        const y = (point.y / 1000) * canvas.height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.clip();
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      context.beginPath();
      points.forEach((point, index) => {
        const x = (point.x / 1000) * canvas.width;
        const y = (point.y / 1000) * canvas.height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.strokeStyle = 'rgba(39,41,45,0.55)';
      context.lineWidth = 2;
      context.stroke();
      onChange(canvas.toDataURL('image/webp', 0.9));
      setTracing(false);
      setPoints([]);
      setError('');
    };
    image.onerror = () => setError('Cette image ne peut pas être traitée.');
    image.src = value;
  }

  function applyCrop() {
    if (!value) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext('2d');
      if (!context) return setError('Le cadrage est indisponible sur ce navigateur.');
      context.fillStyle = '#27292D';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom;
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (canvas.width - width) / 2 + offset.x, (canvas.height - height) / 2 + offset.y, width, height);
      onChange(canvas.toDataURL('image/webp', 0.9));
      setAdjusting(false);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
      setError('');
    };
    image.onerror = () => setError('Cette image ne peut pas être cadrée.');
    image.src = value;
  }

  return (
    <div className="vehicle-photo-editor">
      <div
        className={`vehicle-photo-preview vehicle-dimension-view ${previewClassName}`}
        style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
      >
        {value ? (
          <img src={value} alt={`Aperçu · ${label}`} />
        ) : (
          <span className="vehicle-photo-placeholder">
            {label} · {dimensions.width} × {dimensions.height} px
          </span>
        )}
        {measurements.map((measurement) => (
          <span className={measurement.className} key={measurement.className}>
            {measurement.label}
          </span>
        ))}
        <label className="vehicle-photo-upload-overlay" aria-label={`Importer ${label}`}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-required={required && !value}
            onChange={(event) => void chooseFile(event.currentTarget.files?.item(0) ?? null)}
          />
          <span>
            {value ? 'Cliquer pour remplacer la photo' : 'Cliquer pour importer la photo'}
          </span>
        </label>
      </div>
      <p className="muted vehicle-photo-hint">
        Toute taille d’image acceptée (2,5 Mo maximum). L’image est centrée et cadrée au format
        {` ${dimensions.width} × ${dimensions.height} px`}.
      </p>
      {value && (
        <>
          <div className="vehicle-photo-actions">
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
                setAdjusting(true);
              }}
            >
              Ajuster le cadrage
            </button>
            <button type="button" className="button secondary small" onClick={autoCutout}>
              Détourage automatique
            </button>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                setPoints([]);
                setTracing(true);
              }}
            >
              Détourer à la main
            </button>
          </div>
        </>
      )}
      {error && <p className="alert error">{error}</p>}
      {adjusting && value && (
        <Modal
          titleId="vehicle-crop-title"
          busy={false}
          onClose={() => setAdjusting(false)}
          className="account-dialog vehicle-cutout-dialog"
        >
          <h2 id="vehicle-crop-title">Ajuster le cadrage · {label}</h2>
          <p className="muted">Glissez la photo et réglez le zoom pour cadrer le véhicule.</p>
          <div
            className="vehicle-cutout-canvas"
            style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}`, touchAction: 'none' }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerMove={(event) => {
              if (!drag.current || event.buttons !== 1) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const dx = ((event.clientX - drag.current.x) / bounds.width) * dimensions.width;
              const dy = ((event.clientY - drag.current.y) / bounds.height) * dimensions.height;
              drag.current = { x: event.clientX, y: event.clientY };
              setOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
            }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
          >
            <img
              src={value}
              alt="Cadrage de la photo du véhicule"
              draggable={false}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: '100%',
                height: '100%',
                maxWidth: 'none',
                objectFit: 'cover',
                transform: `translate(calc(-50% + ${(offset.x / dimensions.width) * 100}%), calc(-50% + ${(offset.y / dimensions.height) * 100}%)) scale(${zoom})`,
              }}
            />
          </div>
          <label className="vehicle-crop-zoom">
            <span>Zoom</span>
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          </label>
          <div className="dialog-actions">
            <button type="button" className="button secondary" onClick={() => setAdjusting(false)}>Annuler</button>
            <button type="button" className="button primary" onClick={applyCrop}>Valider le cadrage</button>
          </div>
        </Modal>
      )}
      {tracing && value && (
        <Modal
          titleId="vehicle-cutout-title"
          busy={false}
          onClose={() => setTracing(false)}
          className="account-dialog vehicle-cutout-dialog"
        >
          <h2 id="vehicle-cutout-title">Détourage manuel · {label}</h2>
          <p className="muted">
            Maintenez le clic (ou le doigt) et suivez le contour du véhicule. Faites le tour complet
            avant d’appliquer le détourage.
          </p>
          <div
            className="vehicle-cutout-canvas"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              addTracePoint(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1) addTracePoint(event);
            }}
          >
            <img src={value} alt="Photo du véhicule à détourer" draggable={false} />
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              {points.length > 0 && (
                <polyline
                  points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke="#f6d73c"
                  strokeWidth="5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>
          <div className="dialog-actions">
            <button type="button" className="button secondary" onClick={() => setPoints([])}>
              Effacer le tracé
            </button>
            <button
              type="button"
              className="button primary"
              disabled={points.length < 3}
              onClick={applyTrace}
            >
              Appliquer le détourage
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
