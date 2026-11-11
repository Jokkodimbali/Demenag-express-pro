import { useAdminData } from '../application/controllers/useAdminData';
import { visibleUiText } from '../../../shared/content/visible-ui-text';

export function AdminData() {
  const { items, loading, busy, error, notice, restore, purge } = useAdminData();

  return (
    <section className="admin-data-page">
      <div className="admin-data-intro">
        <h2>{visibleUiText.text77}</h2>
        <p>{visibleUiText.text78}</p>
      </div>
      <div className="admin-data-card">
        <h3>
          {visibleUiText.text79}
          {items.length}
        </h3>
        {loading && <p role="status">{visibleUiText.text80}</p>}
        {!loading && !items.length && <p>{visibleUiText.text81}</p>}
        {items.map((item) => (
          <article key={item.booking.id} className="admin-data-trash-item">
            <div>
              <strong>
                {item.booking.reference} · {item.booking.customerName}
              </strong>
              <span>
                {item.booking.fromAddress || '—'} → {item.booking.toAddress || '—'}
              </span>
              <small>
                {visibleUiText.text82}
                {new Date(item.deletedAt).toLocaleString('fr-FR')}
              </small>
            </div>
            <div>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void restore(item.booking.id)}
              >
                {visibleUiText.text83}
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={() => void purge(item)}>
                {visibleUiText.text84}
              </button>
            </div>
          </article>
        ))}
      </div>
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
