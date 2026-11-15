/** Écriture du montant en lettres, suivant numFr du fichier de référence. */
export function quoteAmountInFrench(value: number): string {
  let amount = Math.round(Math.abs(value || 0));
  if (!amount) return 'zéro';
  const units = [
    '',
    'un',
    'deux',
    'trois',
    'quatre',
    'cinq',
    'six',
    'sept',
    'huit',
    'neuf',
    'dix',
    'onze',
    'douze',
    'treize',
    'quatorze',
    'quinze',
    'seize',
  ];
  const tens = [
    '',
    '',
    'vingt',
    'trente',
    'quarante',
    'cinquante',
    'soixante',
    'soixante',
    'quatre-vingt',
    'quatre-vingt',
  ];
  const two = (number: number): string => {
    if (number <= 16) return units[number]!;
    if (number < 20) return `dix-${units[number - 10]}`;
    const ten = Math.floor(number / 10);
    const unit = number % 10;
    if (ten === 7 || ten === 9)
      return `${tens[ten]}${ten === 7 && unit === 1 ? '-et-' : '-'}${two(10 + unit)}`;
    if (ten === 8) return unit ? `quatre-vingt-${units[unit]}` : 'quatre-vingts';
    return `${tens[ten]}${unit === 1 ? '-et-un' : unit ? `-${units[unit]}` : ''}`;
  };
  const three = (number: number, last: boolean): string => {
    const hundreds = Math.floor(number / 100);
    const rest = number % 100;
    let result = hundreds
      ? hundreds === 1
        ? 'cent'
        : `${units[hundreds]}-cent${!rest && last ? 's' : ''}`
      : '';
    if (rest) result += `${result ? '-' : ''}${two(rest)}`;
    if (!last && result.endsWith('quatre-vingts')) result = result.slice(0, -1);
    return result;
  };
  const parts: string[] = [];
  for (const [size, label] of [
    [1e9, 'milliard'],
    [1e6, 'million'],
  ] as const) {
    const count = Math.floor(amount / size);
    if (count) {
      parts.push(`${three(count, true)} ${label}${count > 1 ? 's' : ''}`);
      amount %= size;
    }
  }
  const thousands = Math.floor(amount / 1000);
  if (thousands) {
    parts.push(thousands === 1 ? 'mille' : `${three(thousands, false)}-mille`);
    amount %= 1000;
  }
  if (amount) parts.push(three(amount, true));
  return parts.join(' ');
}
