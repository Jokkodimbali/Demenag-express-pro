import { ChevronLeft, ChevronRight, Download, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccounting } from '../application/controllers/useAccounting';
import { accountingText } from '../content/accounting';
import { money } from '../domain/format';
import { routes } from '../routing/routes';

export function AdminAccounting() {
  const {
    month,
    setMonth,
    all,
    setAll,
    entries,
    loading,
    busy,
    error,
    form,
    setForm,
    pendingVoid,
    setPendingVoid,
    totals,
    addEntry,
    voidEntry,
    title,
    maxCategory,
    categories,
    shiftMonth,
    exportCsv,
  } = useAccounting();
  return (
    <section className="accounting-page">
      <div className="section-heading">
        <div>
          <h2>{accountingText.title}</h2>
          <p>{accountingText.description}</p>
        </div>
      </div>
      <div className="accounting-period">
        <button
          className="accounting-period-arrow"
          aria-label={accountingText.previousMonth}
          onClick={() => {
            setAll(false);
            setMonth(shiftMonth(month, -1));
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <strong>{all ? accountingText.allPeriods : title}</strong>
        <button
          className="accounting-period-arrow"
          aria-label={accountingText.nextMonth}
          onClick={() => {
            setAll(false);
            setMonth(shiftMonth(month, 1));
          }}
        >
          <ChevronRight size={20} />
        </button>
        <button
          className={`accounting-all ${all ? 'active' : ''}`}
          onClick={() => setAll((value) => !value)}
        >
          {accountingText.all}
        </button>
      </div>
      <div className="accounting-stats">
        <article>
          <span>{accountingText.revenues}</span>
          <strong className="accounting-positive">{money(totals.revenue)}</strong>
          <small>
            {entries.filter((entry) => entry.type === 'revenu').length}
            {accountingText.entryCount}
          </small>
        </article>
        <article>
          <span>{accountingText.charges}</span>
          <strong className="accounting-negative">{money(totals.charges)}</strong>
          <small>
            {entries.filter((entry) => entry.type === 'charge').length}
            {accountingText.entryCount}
          </small>
        </article>
        <article>
          <span>{accountingText.balance}</span>
          <strong className={totals.balance < 0 ? 'accounting-negative' : 'accounting-positive'}>
            {money(totals.balance)}
          </strong>
          <small>{accountingText.balanceHint}</small>
        </article>
      </div>
      <p className="caption">{accountingText.invoicedNote}</p>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <div className="accounting-columns">
        <form className="accounting-panel accounting-form" onSubmit={addEntry}>
          <h3>{accountingText.addEntry}</h3>
          <div className="accounting-type">
            {(['charge', 'revenu'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={form.type === type ? 'active' : ''}
                onClick={() => setForm({ ...form, type, category: categories[type][0] })}
              >
                {type === 'charge' ? accountingText.charge : accountingText.revenue}
              </button>
            ))}
          </div>
          <div className="accounting-form-grid">
            <label>
              {accountingText.date}
              <input
                type="date"
                required
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </label>
            <label>
              {accountingText.category}
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {categories[form.type].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {accountingText.label}
            <input
              value={form.label}
              maxLength={200}
              placeholder={
                form.type === 'charge'
                  ? accountingText.chargeExample
                  : accountingText.revenueExample
              }
              onChange={(event) => setForm({ ...form, label: event.target.value })}
            />
          </label>
          <label>
            {accountingText.amount}
            <input
              type="number"
              required
              min={1}
              max={1000000000}
              step={1}
              value={form.amount || ''}
              onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
            />
          </label>
          <button className="button primary" disabled={busy}>
            {accountingText.add}
          </button>
          <p className="caption">{accountingText.autoNote}</p>
        </form>
        <div className="accounting-panel">
          <h3>{accountingText.chargeBreakdown}</h3>
          {totals.byCategory.length === 0 && <p className="caption">{accountingText.noCharges}</p>}
          {totals.byCategory.map(([category, amount]) => (
            <div className="accounting-category" key={category}>
              <div>
                <span>{category}</span>
                <strong>{money(amount)}</strong>
              </div>
              <div className="accounting-bar">
                <span
                  style={{ width: `${Math.max(4, Math.round((amount / maxCategory) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="accounting-panel accounting-journal">
        <div className="accounting-journal-head">
          <h3>
            {accountingText.journal}
            {entries.length}
            {accountingText.entryCount}
          </h3>
          <button
            className="button secondary small"
            disabled={loading}
            onClick={() => exportCsv(entries, all ? 'complet' : month)}
          >
            <Download size={16} /> {accountingText.export}
          </button>
        </div>
        {loading ? (
          <p role="status">{accountingText.loading}</p>
        ) : entries.length === 0 ? (
          <p className="caption">{accountingText.empty}</p>
        ) : (
          entries.map((entry) => (
            <div className="accounting-row" key={entry.id}>
              <div>
                <strong>{entry.label}</strong>
                <span>
                  {new Date(`${entry.date}T12:00:00Z`).toLocaleDateString('fr-FR', {
                    timeZone: 'UTC',
                  })}{' '}
                  · {entry.category} {entry.automatic && <b>{accountingText.auto}</b>}
                </span>
                {entry.bookingId && (
                  <Link
                    to={`${routes.administrationBookings}?q=${encodeURIComponent(entry.bookingReference ?? '')}&detail=${entry.bookingId}`}
                  >
                    {accountingText.viewBooking}
                  </Link>
                )}
              </div>
              <strong
                className={entry.type === 'charge' ? 'accounting-negative' : 'accounting-positive'}
              >
                {entry.type === 'charge' ? '− ' : '+ '}
                {money(entry.amount)}
              </strong>
              {entry.automatic ? (
                <span className="accounting-row-spacer" />
              ) : (
                <button
                  className="accounting-void"
                  title={accountingText.voidEntry}
                  aria-label={accountingText.voidEntryLabel(entry.label)}
                  onClick={() => setPendingVoid(entry)}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
      {pendingVoid && (
        <div
          className="accounting-confirm-backdrop"
          role="presentation"
          onClick={() => setPendingVoid(null)}
        >
          <div
            className="accounting-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="accounting-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="accounting-confirm-title">{accountingText.confirmTitle}</h3>
            <p>
              {pendingVoid.label} · {money(pendingVoid.amount)}. {accountingText.confirmDescription}
            </p>
            <div>
              <button className="button secondary" onClick={() => setPendingVoid(null)}>
                {accountingText.keep}
              </button>
              <button className="button primary" disabled={busy} onClick={voidEntry}>
                {accountingText.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
