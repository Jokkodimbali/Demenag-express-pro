import type {
  Catalogue,
  ClientQuestion,
  Driver,
  QuoteInput,
  Settings,
  User,
  Vehicle,
} from '../../domain/model';
import { messages } from '../../content/fr';
import { vehicleCapacity } from '../../domain/vehicle-capacity';
import { createLabourPriceMatrix } from '../../domain/labour-price';
import { referenceInventoryKey } from '../../domain/inventory-assembly';
import { normalizePaymentQr } from '../services/payment-qr';

const role = (value: FormDataEntryValue | null): User['role'] =>
  value === 'admin' ? 'admin' : 'client';
const integer = (value: FormDataEntryValue | null) => Number(value);
const tuple = (values: number[]): [number, number, number] => [values[0], values[1], values[2]];
const normalizeBusinessPhone = (value: string) => {
  let digits = value.replace(/\D/gu, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('221') && digits.length === 12) return `+${digits}`;
  return digits.length === 9 ? `+221${digits}` : value.trim();
};

export function questionnaireFromForm(data: FormData, existing: ClientQuestion[]) {
  const rawCount = data.get('questionnaire.count');
  if (typeof rawCount !== 'string' || rawCount.trim() === '') return existing;
  const count = Number(rawCount);
  if (!Number.isInteger(count) || count < 0 || count > 100) return existing;

  return Array.from({ length: count }, (_, index): ClientQuestion => {
    const field = (name: string) => String(data.get(`questionnaire.${index}.${name}`) ?? '');
    const current = existing.find((question) => question.id === field('id'));
    const hint = field('hint').trim();
    return {
      id: field('id'),
      group: field('group').trim(),
      label: field('label').trim(),
      ...(hint ? { hint } : {}),
      answerType: field('answerType') === 'yes_no' ? 'yes_no' : 'text',
      required: field('required') === 'true' || current?.required === true,
      active: field('active') !== 'false' && current?.active !== false,
    };
  });
}

export function userFromForm(data: FormData): Omit<User, 'id'> {
  return {
    name: String(data.get('name')),
    phone: String(data.get('phone')),
    role: role(data.get('role')),
    active: data.get('active') === 'on',
  };
}

export function quoteFromForm(
  data: FormData,
  version: number,
  extraLines: QuoteInput['extraLines'],
  options: NonNullable<QuoteInput['options']>,
  tolls: NonNullable<QuoteInput['tolls']> = [],
): QuoteInput {
  return {
    kind: data.get('kind') === 'final' ? 'final' : 'provisional',
    trips: integer(data.get('trips')),
    customPrice: data.get('customPrice') ? integer(data.get('customPrice')) : null,
    discount: integer(data.get('discount')),
    discountType: data.get('discountType') === 'pct' ? 'pct' : 'fcfa',
    discountReason: String(data.get('discountReason') ?? ''),
    notes: String(data.get('notes')),
    extraLines,
    tolls,
    options,
    version,
  };
}

export async function dataUrl(file: FormDataEntryValue | null, fallback: string): Promise<string> {
  if (!(file instanceof File) || file.size === 0) return fallback;
  if (file.size > 2_500_000) throw new Error(messages.imageTropVolumineuse);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error());
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function driverFromForm(
  data: FormData,
  existing: Driver,
): Promise<Omit<Driver, 'userId'>> {
  const photo =
    data.get('removePhoto') === 'on' ? '' : await dataUrl(data.get('photo'), existing.photo ?? '');
  return {
    ...existing,
    name: String(data.get('name')),
    phone: String(data.get('phone')),
    photo: photo || null,
    active: data.get('active') === 'on',
    vehicleId: String(data.get('vehicleId')) || null,
  };
}

export async function vehicleFromForm(data: FormData, existing: Vehicle): Promise<Vehicle> {
  const length = String(data.get('length'));
  const height = String(data.get('height'));
  const width = String(data.get('width'));
  const wheelWidth = String(data.get('wheelWidth'));
  return {
    ...existing,
    name: String(data.get('name')).trim(),
    shortName: String(
      data.get('shortName') ||
        existing.shortName ||
        String(data.get('name')).trim().split(/\s+/).at(-1),
    ).trim(),
    volume: vehicleCapacity(length, height, width, wheelWidth),
    length,
    height,
    width,
    wheelWidth,
    active: data.get('active') === 'on',
    image: await imageValue(data.get('image'), existing.image),
    interior: await imageValue(data.get('interior'), existing.interior),
  };
}

async function imageValue(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value === 'string') return value || fallback;
  return dataUrl(value, fallback);
}

export async function catalogueFromForm(data: FormData, catalogue: Catalogue): Promise<Catalogue> {
  const numberField = (name: string, fallback: number) =>
    data.has(name) ? Number(data.get(name)) : fallback;
  const montageP = { ...(catalogue.settings.montageP ?? {}) };
  for (const [legacyKey, canonicalKey] of Object.entries({
    'table-manger': 'tablem',
    bibliotheque: 'biblio',
    congelateur: 'congel',
    'machine-laver': 'mal',
    'micro-ondes': 'micro',
    climatiseur: 'clim',
    ventilateur: 'ventilo',
  })) {
    if (montageP[legacyKey] && !montageP[canonicalKey])
      montageP[canonicalKey] = montageP[legacyKey];
    delete montageP[legacyKey];
  }
  for (const [name, value] of data.entries()) {
    const match = /^montageP\.([^.]+)\.(?:(local|import|u|uI)|(sz)\.(\d+)\.(local|import))$/.exec(
      name,
    );
    if (!match) continue;
    const [, formKey, baseOrigin, , size, sizeOrigin] = match;
    const key = referenceInventoryKey(formKey);
    const configured = montageP[key];
    const current =
      typeof configured === 'number'
        ? { local: configured, import: Math.round(configured * 1.5) }
        : (configured ?? {});
    if (size && sizeOrigin) {
      montageP[key] = {
        ...current,
        sz: {
          ...(current.sz ?? {}),
          [size]: { ...(current.sz?.[size] ?? {}), [sizeOrigin]: integer(value) },
        },
      };
    } else if (baseOrigin) {
      montageP[key] = { ...current, [baseOrigin]: integer(value) };
    }
  }
  const labourPrice = numberField('labourPrice', catalogue.settings.labourPrice);
  const labourFloorPrice = numberField(
    'labourFloorPrice',
    catalogue.settings.labourFloorPrice ?? 500,
  );
  const labourLiftPrice = numberField('labourLiftPrice', catalogue.settings.labourLiftPrice ?? 500);
  const whatsappCountryCode = String(
    data.get('w.cc') ?? catalogue.settings.whatsappCountryCode ?? '221',
  ).replace(/\D/g, '');
  let whatsappLocalNumber = String(
    data.get('w.biz') ?? catalogue.settings.whatsappPhone ?? '',
  ).replace(/\D/g, '');
  if (whatsappLocalNumber.startsWith('00')) whatsappLocalNumber = whatsappLocalNumber.slice(2);
  const normalizedWhatsAppNumber = whatsappLocalNumber.replace(/^0+/, '');
  const whatsappDigits =
    normalizedWhatsAppNumber.length <= 9
      ? whatsappCountryCode + normalizedWhatsAppNumber
      : normalizedWhatsAppNumber;
  const movingLaborPlanning = {
    ...catalogue.settings.movingLaborPlanning,
    maxHandlingHours: numberField(
      'movingLaborPlanning.maxHandlingHours',
      catalogue.settings.movingLaborPlanning?.maxHandlingHours ?? 3,
    ),
    maxDayHours: numberField(
      'movingLaborPlanning.maxDayHours',
      catalogue.settings.movingLaborPlanning?.maxDayHours ?? 8,
    ),
    defaultStartHour: numberField(
      'movingLaborPlanning.defaultStartHour',
      catalogue.settings.movingLaborPlanning?.defaultStartHour ?? 8,
    ),
    maxMoversPerVehicle: numberField(
      'movingLaborPlanning.maxMoversPerVehicle',
      catalogue.settings.movingLaborPlanning?.maxMoversPerVehicle ?? 6,
    ),
    cubicMetersPerHourPerMover: numberField(
      'movingLaborPlanning.cubicMetersPerHourPerMover',
      catalogue.settings.movingLaborPlanning?.cubicMetersPerHourPerMover ?? 2.7,
    ),
    pauseMinutes: numberField(
      'movingLaborPlanning.pauseMinutes',
      catalogue.settings.movingLaborPlanning?.pauseMinutes ?? 30,
    ),
    teamVolumePerMover: numberField(
      'movingLaborPlanning.teamVolumePerMover',
      catalogue.settings.movingLaborPlanning?.teamVolumePerMover ?? 6,
    ),
    tripSetupMinutes: numberField(
      'movingLaborPlanning.tripSetupMinutes',
      catalogue.settings.movingLaborPlanning?.tripSetupMinutes ?? 15,
    ),
    handlingCalibration: numberField(
      'movingLaborPlanning.handlingCalibration',
      catalogue.settings.movingLaborPlanning?.handlingCalibration ?? 1,
    ),
    carryDistanceMeters: numberField(
      'movingLaborPlanning.carryDistanceMeters',
      catalogue.settings.movingLaborPlanning?.carryDistanceMeters ?? 15,
    ),
    heat: numberField(
      'movingLaborPlanning.heat',
      catalogue.settings.movingLaborPlanning?.heat ?? 1,
    ),
    wbgtAdj: numberField(
      'movingLaborPlanning.wbgtAdj',
      catalogue.settings.movingLaborPlanning?.wbgtAdj ?? 0,
    ),
    blanketLengthCm: numberField(
      'movingLaborPlanning.blanketLengthCm',
      catalogue.settings.movingLaborPlanning?.blanketLengthCm ?? 204,
    ),
    blanketWidthCm: numberField(
      'movingLaborPlanning.blanketWidthCm',
      catalogue.settings.movingLaborPlanning?.blanketWidthCm ?? 184,
    ),
    blanketStock: numberField(
      'movingLaborPlanning.blanketStock',
      catalogue.settings.movingLaborPlanning?.blanketStock ?? 20,
    ),
  };
  const kitCount = Number(data.get('rentalKitConfiguration.count'));
  const rentalKitConfiguration =
    Number.isInteger(kitCount) && kitCount >= 0 && kitCount <= 100
      ? await Promise.all(
          Array.from({ length: kitCount }, async (_, index) => {
            const field = (name: string) =>
              String(data.get(`rentalKitConfiguration.${index}.${name}`) ?? '');
            const current = catalogue.settings.rentalKitConfiguration?.find(
              (item) => item.id === field('id'),
            );
            const image =
              data.get(`rentalKitConfiguration.${index}.removeImage`) === 'on'
                ? ''
                : await dataUrl(
                    data.get(`rentalKitConfiguration.${index}.imageFile`),
                    field('image') || current?.image || '',
                  );
            return {
              id: field('id'),
              label: field('label').trim(),
              rule: field('rule') as NonNullable<
                Settings['rentalKitConfiguration']
              >[number]['rule'],
              quantity: Math.max(0, integer(data.get(`rentalKitConfiguration.${index}.quantity`))),
              image,
            };
          }),
        ).then((items) => items.filter((item) => item.label))
      : (catalogue.settings.rentalKitConfiguration ?? []);
  const labourMatrix = createLabourPriceMatrix({
    ...catalogue.settings,
    labourPrice,
    labourFloorPrice,
    labourLiftPrice,
  });
  return {
    ...catalogue,
    vehicles: catalogue.vehicles.map((vehicle) => ({
      ...vehicle,
      prices: tuple(
        [0, 1, 2].map((index) => numberField(`${vehicle.id}-${index}`, vehicle.prices[index])),
      ),
    })),
    settings: {
      ...catalogue.settings,
      distanceBounds: [15, 25, 35],
      labourPrice,
      labourFloorPrice,
      labourLiftPrice,
      labourMatrix,
      assemblyPrice: numberField('assembly', catalogue.settings.assemblyPrice),
      montageP,
      movingLaborPlanning,
      questionnaire: questionnaireFromForm(data, catalogue.settings.questionnaire ?? []),
      whatsappPhone: `+${whatsappDigits}`,
      whatsappCountryCode,
      whatsappMode: String(
        data.get('w.mode') ?? catalogue.settings.whatsappMode ?? 'api',
      ) as Settings['whatsappMode'],
      whatsappQuoteTemplate: String(
        data.get('w.tpl') ?? catalogue.settings.whatsappQuoteTemplate ?? '',
      ),
      whatsappProvisionalTemplate: String(
        data.get('w.tplP') ?? catalogue.settings.whatsappProvisionalTemplate ?? '',
      ),
      contactFirstTemplate: String(
        data.get('contactFirstTemplate') ?? catalogue.settings.contactFirstTemplate ?? '{ref} {prenom}',
      ),
      contactLastTemplate: String(
        data.get('contactLastTemplate') ?? catalogue.settings.contactLastTemplate ?? '{nom} · {date}',
      ),
      businessEmail: String(data.get('businessEmail') ?? catalogue.settings.businessEmail ?? ''),
      businessAddress: String(
        data.get('businessAddress') ?? catalogue.settings.businessAddress ?? '',
      ).trim(),
      businessPhone: normalizeBusinessPhone(
        String(data.get('businessPhone') ?? catalogue.settings.businessPhone ?? ''),
      ),
      businessNinea: String(data.get('businessNinea') ?? catalogue.settings.businessNinea ?? ''),
      businessRccm: String(data.get('businessRccm') ?? catalogue.settings.businessRccm ?? ''),
      quoteValidityDays: Math.max(
        0,
        integer(
          data.get('quoteValidityDays') ?? String(catalogue.settings.quoteValidityDays ?? 15),
        ),
      ),
      bookingDepositPercent: Math.max(
        0,
        Math.min(
          100,
          integer(
            data.get('bookingDepositPercent') ??
              String(catalogue.settings.bookingDepositPercent ?? 0),
          ),
        ),
      ),
      quoteTerms: String(data.get('quoteTerms') ?? catalogue.settings.quoteTerms ?? ''),
      quoteTermsEnabled:
        data.getAll('quoteTermsEnabled').length === 0
          ? (catalogue.settings.quoteTermsEnabled ?? true)
          : data.getAll('quoteTermsEnabled').includes('on'),
      rentalOvertimeHourlyRate: Math.max(
        0,
        integer(
          data.get('rentalOvertimeHourlyRate') ??
            String(catalogue.settings.rentalOvertimeHourlyRate ?? 10000),
        ),
      ),
      rentalKitConfiguration,
      paymentWave: data.has('paymentWaveConfigured')
        ? data.get('paymentWave') === 'on'
        : catalogue.settings.paymentWave,
      paymentCash: data.has('paymentCashConfigured')
        ? data.get('paymentCash') === 'on'
        : catalogue.settings.paymentCash,
      paymentQr: await (async () => {
        const file = data.get('paymentQr');
        if (file instanceof File && file.size > 0) return normalizePaymentQr(file);
        if (data.get('removePaymentQr') === 'on') return null;
        return catalogue.settings.paymentQr ?? null;
      })(),
    },
  };
}
