import type { Catalogue } from '../../domain/model';
import { defaultQuoteTerms } from '../../domain/quote-terms';
import { referenceSettingsText as text } from '../../content/reference-settings-text';

export function QuoteTermsSettings({ catalogue }: { catalogue: Catalogue }) {
  return (
    <section className="reference-settings-wide reference-settings-card reference-quote-terms">
      <div className="reference-settings-section-heading">
        <span className="reference-settings-card-title">{text.quoteTermsTitle}</span>
        <button
          type="button"
          className="reference-settings-reset"
          onClick={(event) => {
            const form = event.currentTarget.form;
            const textarea = form?.elements.namedItem('quoteTerms');
            if (textarea instanceof HTMLTextAreaElement) textarea.value = defaultQuoteTerms;
            form?.requestSubmit();
          }}
        >
          {text.quoteTermsReset}
        </button>
      </div>
      <span className="reference-settings-description">{text.quoteTermsDescription}</span>
      <label className="reference-quote-terms-toggle">
        <input type="hidden" name="quoteTermsEnabled" value="off" />
        <input
          type="checkbox"
          name="quoteTermsEnabled"
          value="on"
          defaultChecked={catalogue.settings.quoteTermsEnabled !== false}
        />
        {text.quoteTermsToggle}
      </label>
      <textarea
        name="quoteTerms"
        rows={12}
        defaultValue={catalogue.settings.quoteTerms || defaultQuoteTerms}
        aria-label={text.quoteTermsAccessibleLabel}
      />
    </section>
  );
}
