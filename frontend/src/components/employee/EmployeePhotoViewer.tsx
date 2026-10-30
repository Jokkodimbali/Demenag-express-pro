import { uiText } from '../../content/reference-ui-text';
import { useState } from 'react';
import { Modal } from '../Modal';
export function EmployeePhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  return (
    <Modal
      titleId="employee-photo-title"
      onClose={onClose}
      busy={false}
      className="employee-photo-viewer"
    >
      <div className="employee-photo-toolbar">
        <span id="employee-photo-title">{uiText['photo3']}</span>
        <button onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label={uiText['reduire']}>
          −
        </button>
        <span>{Math.round(zoom * 100)} %</span>
        <button
          onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
          aria-label={uiText['agrandir']}
        >
          +
        </button>
        <a href={src} download="photo.jpg">
          {uiText['telecharger']}
        </a>
        <button onClick={onClose} aria-label={uiText['fermer']}>
          ×
        </button>
      </div>
      <div
        className="employee-photo-scroll"
        onWheel={(event) => {
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setZoom((z) => Math.max(1, Math.min(4, z + (event.deltaY < 0 ? 0.25 : -0.25))));
          }
        }}
      >
        <img
          src={src}
          alt={uiText['photoAgrandie']}
          style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
        />
      </div>
    </Modal>
  );
}
