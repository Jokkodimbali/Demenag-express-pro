import { jsPDF } from 'jspdf';
import type { Catalogue, TollPoint } from '../../../shared/domain/model';
import { inventoryItems } from '../../../moving/domain/inventory/inventory';
import { referenceInventoryKey } from '../../../moving/domain/inventory/inventory-assembly';
import { assemblyUnitPrice, labourUnitPrice } from '../../../moving/domain/pricing/labour-price';
import { defaultRentalKitConfiguration } from '../../../moving/domain/rental-kit';

type Kind = 'client' | 'agent';
const money = (value: number) => `${Math.round(value || 0).toLocaleString('fr-FR')} FCFA`;
const pdfText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFC')
    .replace(/[\u2009\u202f\u00a0\u2007]/gu, ' ')
    .replace(/[’‘]/gu, "'")
    .replace(/→/gu, '>')
    .replace(/[–—]/gu, '-')
    .replace(/œ/gu, 'oe')
    .replace(/Œ/gu, 'OE')
    .replace(/×/gu, 'x');

export function createTariffDocument(
  catalogue: Catalogue,
  kind: Kind,
  today = new Date(),
  tollPoints: TollPoint[] = [],
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = kind === 'client' ? 15 : 16;
  const width = 210 - margin * 2;
  const settings = catalogue.settings;
  const vehicles = catalogue.vehicles.filter((vehicle) => vehicle.active !== false);
  let y = kind === 'client' ? 49 : 74;
  let page = 1;
  const date = today.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const furniture = inventoryItems.filter(
    (item) => !['carton', 'sac', 'gaz', 'pot', 'climatiseur', 'tapis', 'velo'].includes(item.key),
  );

  function footer() {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 146, 152);
    doc.text(
      pdfText(
        `Demenag Express Pro · ${kind === 'agent' ? 'Guide tarifaire pour agent IA' : 'Nos tarifs'} · ${date}`,
      ),
      margin,
      289,
    );
    doc.text(`Page ${page}`, 210 - margin, 289, { align: 'right' });
  }
  function nextPage() {
    footer();
    doc.addPage();
    page += 1;
    y = 20;
  }
  function room(height: number) {
    if (y + height > 280) nextPage();
  }
  function title(label: string) {
    room(14);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(kind === 'client' ? 13 : 14);
    doc.setTextColor(30, 32, 35);
    doc.text(pdfText(label), margin, y);
    doc.setDrawColor(246, 215, 60);
    doc.setLineWidth(0.9);
    doc.line(margin, y + 2.2, margin + 18, y + 2.2);
    y += 8;
  }
  function paragraph(value: string, bullet = false) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(kind === 'client' ? 9 : 9.5);
    doc.setTextColor(50, 56, 62);
    const lines = doc.splitTextToSize(
      pdfText(`${bullet ? '- ' : ''}${value}`),
      width - (bullet ? 3 : 0),
    ) as string[];
    for (const line of lines) {
      room(5);
      doc.text(line, margin + (bullet ? 3 : 0), y);
      y += 4.5;
    }
    y += bullet ? 0.6 : 1.5;
  }
  function table(
    headers: string[],
    rows: string[][],
    weights: number[],
    alignRight: number[] = [],
  ) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => (weight / total) * width);
    const drawRow = (cells: string[], heading: boolean, index: number) => {
      const split = cells.map(
        (cell, cellIndex) => doc.splitTextToSize(pdfText(cell), widths[cellIndex] - 4) as string[],
      );
      const rowHeight = Math.max(7, ...split.map((lines) => lines.length * 4.1 + 2));
      room(rowHeight + 1);
      if (heading) {
        doc.setFillColor(30, 32, 35);
        doc.rect(margin, y - 4.3, width, rowHeight, 'F');
      } else if (index % 2) {
        doc.setFillColor(246, 247, 248);
        doc.rect(margin, y - 4.3, width, rowHeight, 'F');
      }
      let x = margin;
      split.forEach((lines, cellIndex) => {
        doc.setFont(
          'helvetica',
          heading || cellIndex === 0 || alignRight.includes(cellIndex) ? 'bold' : 'normal',
        );
        doc.setFontSize(heading ? 8.3 : 9);
        doc.setTextColor(heading ? 255 : 30, heading ? 255 : 32, heading ? 255 : 35);
        doc.text(
          lines,
          alignRight.includes(cellIndex) ? x + widths[cellIndex] - 2 : x + 2,
          y,
          alignRight.includes(cellIndex) ? { align: 'right' } : undefined,
        );
        x += widths[cellIndex];
      });
      y += rowHeight;
    };
    drawRow(headers, true, 0);
    rows.forEach((row, index) => drawRow(row, false, index));
    y += 3;
  }
  function header(label: string, subtitle: string) {
    doc.setFillColor(30, 32, 35);
    doc.rect(0, 0, 210, kind === 'client' ? 40 : 62, 'F');
    doc.setFillColor(246, 215, 60);
    doc.rect(0, kind === 'client' ? 40 : 62, 210, 1.6, 'F');
    if (settings.invoiceLogo?.startsWith('data:image/')) {
      try {
        doc.addImage(settings.invoiceLogo, 'PNG', margin, kind === 'client' ? 9 : 14, 22, 22);
      } catch {
        /* unsupported image format */
      }
    }
    const x = margin + (settings.invoiceLogo ? 28 : 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(kind === 'client' ? 21 : 20);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfText(label), x, kind === 'client' ? 19 : 22);
    doc.setFontSize(10.5);
    doc.setTextColor(246, 215, 60);
    doc.text(pdfText(subtitle), x, kind === 'client' ? 26 : 29);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(214, 218, 222);
    const description =
      kind === 'client'
        ? `Tarifs en vigueur au ${date} · devis gratuit`
        : `Document destiné à un agent conversationnel. Valeurs extraites de la base le ${date}. Monnaie : franc CFA (FCFA).`;
    doc.text(
      doc.splitTextToSize(pdfText(description), width - (x - margin)) as string[],
      x,
      kind === 'client' ? 32 : 42,
    );
  }

  if (kind === 'client') {
    header('Nos tarifs', 'Demenag Express Pro · Déménagement à Dakar et environs');
    title('1. Transport');
    table(
      ['Véhicule', 'Moins de 15 km', '15 à 25 km', '25 à 35 km', 'Plus de 35 km'],
      vehicles.map((vehicle) => [
        vehicle.shortName || vehicle.name,
        ...vehicle.prices.map(money),
        'Sur devis',
      ]),
      [34, 17, 17, 17, 15],
      [1, 2, 3, 4],
    );
    paragraph(
      'Le prix est compté par aller-retour effectué entre votre ancien et votre nouveau logement. Le nombre d’allers-retours dépend du volume de vos affaires et du véhicule choisi.',
    );
    title('2. Manœuvres');
    table(
      ['Situation', 'Prix par manœuvre'],
      [
        ['Rez-de-chaussée des deux côtés', money(settings.labourPrice)],
        [
          'Par étage sans ascenseur (départ ou arrivée)',
          `+ ${money(settings.labourFloorPrice ?? 500)}`,
        ],
        ['Avec ascenseur (départ ou arrivée)', `+ ${money(settings.labourLiftPrice ?? 500)}`],
        [
          'Exemple : 3e sans ascenseur vers un rez-de-chaussée',
          money(
            labourUnitPrice(settings, { fromFloor: 3, toFloor: 0, fromLift: false, toLift: false }),
          ),
        ],
      ],
      [70, 30],
      [1],
    );
    paragraph(
      'Le nombre de manœuvres conseillé (2 au minimum) dépend du volume, du poids des meubles et des étages. Il est indiqué sur votre devis.',
    );
    title('3. Démontage et remontage');
    table(
      ['Meuble', 'Local', 'Importé'],
      furniture.map((item) => {
        const key = referenceInventoryKey(item.key);
        return [
          item.label,
          money(assemblyUnitPrice(settings, key, 'local', item.defaultSize, item.defaultSize)),
          money(assemblyUnitPrice(settings, key, 'import', item.defaultSize, item.defaultSize)),
        ];
      }),
      [50, 25, 25],
      [1, 2],
    );
    paragraph(
      '« Local » : meuble fabriqué au Sénégal. « Importé » : meuble d’importation. Le prix varie avec la taille (places, battants).',
    );
    title('4. Location avec chauffeur');
    paragraph(
      `Véhicule propre + chauffeur + matériel fourni. Transport au tarif de la section 1, sans manœuvres facturés. Dépassement du planning : ${money(settings.rentalOvertimeHourlyRate ?? 10000)} par heure, compté à la minute.`,
    );
    title('5. Bon à savoir');
    [
      `Devis gratuit, établi d’après votre inventaire. Devis provisoire valable ${settings.quoteValidityDays ?? 15} jours ; le devis final confirme le montant.`,
      'Péages éventuels à votre charge, indiqués à part.',
      'Passage par le balcon ou distance de plus de 35 km : supplément ou prix sur devis.',
      'Vos affaires doivent être prêtes à charger le jour J et passer par le chemin prévu (escalier ou balcon). Sinon, le déménagement n’aura pas lieu.',
      `Paiement : ${[settings.paymentWave !== false ? 'Wave' : '', settings.paymentCash !== false ? 'espèces' : ''].filter(Boolean).join(' ou ')}.`,
    ].forEach((line) => paragraph(line, true));
    paragraph(
      `Demandez votre devis · WhatsApp / Tél. ${settings.whatsappPhone || settings.businessPhone}`,
    );
  } else {
    header('Guide tarifaire complet', 'Demenag Express Pro · Dakar, Sénégal');
    title('0. Règles pour l’agent IA');
    [
      'Ne jamais inventer un prix : utiliser uniquement les montants de ce document. Si une information manque, dire que Demenag Express confirmera et proposer un devis personnalisé.',
      'Toujours annoncer les montants en FCFA, avec une espace pour les milliers (ex. 35 000 FCFA).',
      'Le prix donné par l’agent est une ESTIMATION (devis provisoire). Le prix définitif figure sur le devis final envoyé par Demenag Express après le déménagement.',
      'Le transport est facturé PAR ALLER-RETOUR effectué. Si le déménagement demande plus d’allers-retours que prévu, le total augmente.',
      'Au-delà de 35 km, le prix du transport n’est pas dans la grille : il est fixé au cas par cas par Demenag Express. Répondre « sur devis ».',
      'Les péages sont à la charge du client et ne sont jamais inclus dans le total.',
      'Les remises sont décidées uniquement par Demenag Express. L’agent ne promet jamais de remise.',
      'Questions à poser pour estimer : date et heure, adresses de départ et d’arrivée, étages et ascenseur, liste des meubles, démontage/remontage, matériel prêt ou non, passage, type de prestation.',
      'Rappeler les conditions de chargement : elles doivent être respectées le jour J, sinon le déménagement n’aura pas lieu.',
    ].forEach((line) => paragraph(line, true));
    title('1. Les deux formules');
    paragraph(
      'Déménagement complet : transport + manœuvres + menuiserie + suppléments éventuels − remise éventuelle.',
    );
    paragraph(
      'Location avec chauffeur : véhicule, chauffeur et matériel fournis. Le client fournit ses propres manœuvres. Dépassement facturé à la minute.',
    );
    paragraph(
      `Dépassement en location : minutes × ${money(settings.rentalOvertimeHourlyRate ?? 10000)} ÷ 60.`,
    );
    (settings.rentalKitConfiguration?.length
      ? settings.rentalKitConfiguration
      : defaultRentalKitConfiguration
    ).forEach((item) => paragraph(item.label, true));
    title('2. Véhicules');
    table(
      ['Véhicule', 'Longueur', 'Largeur', 'Entre roues', 'Hauteur', 'Volume utile'],
      vehicles.map((vehicle) => [
        vehicle.shortName || vehicle.name,
        vehicle.length,
        vehicle.width,
        vehicle.wheelWidth,
        vehicle.height,
        vehicle.volume,
      ]),
      [30, 14, 14, 14, 14, 16],
      [1, 2, 3, 4, 5],
    );
    title('3. Transport (prix par aller-retour)');
    table(
      ['Véhicule', 'Moins de 15 km', '15 à 25 km', '25 à 35 km', 'Plus de 35 km'],
      vehicles.map((vehicle) => [
        vehicle.shortName || vehicle.name,
        ...vehicle.prices.map(money),
        'Sur devis',
      ]),
      [30, 18, 18, 18, 18],
      [1, 2, 3, 4],
    );
    paragraph(
      'Tranches de distance : moins de 15 km ; de 15 à 25 km ; de 25 à 35 km ; plus de 35 km = prix fixé manuellement. Formule : prix d’un aller-retour × nombre d’allers-retours.',
    );
    title('4. Manœuvres (déménagement complet uniquement)');
    paragraph(
      'Prix d’un manœuvre = prix de base + supplément d’étage au départ + supplément d’étage à l’arrivée.',
    );
    table(
      ['Élément', 'Montant'],
      [
        ['Prix de base par manœuvre', money(settings.labourPrice)],
        ['Supplément par étage SANS ascenseur', money(settings.labourFloorPrice ?? 500)],
        ['Supplément AVEC ascenseur', money(settings.labourLiftPrice ?? 500)],
      ],
      [70, 30],
      [1],
    );
    title('5. Menuisier · démontage et remontage');
    table(
      ['Meuble', 'Rubrique', 'Local', 'Importé'],
      furniture.map((item) => {
        const key = referenceInventoryKey(item.key);
        return [
          item.label,
          item.section,
          money(assemblyUnitPrice(settings, key, 'local', item.defaultSize, item.defaultSize)),
          money(assemblyUnitPrice(settings, key, 'import', item.defaultSize, item.defaultSize)),
        ];
      }),
      [36, 30, 16, 16],
      [2, 3],
    );
    const sized = furniture.filter((item) => item.sizeLabel);
    if (sized.length) {
      title('Prix selon la taille');
      table(
        ['Meuble', 'Taille', 'Local', 'Importé'],
        sized.flatMap((item) => {
          const key = referenceInventoryKey(item.key);
          const range =
            key === 'salon'
              ? [1, 10]
              : key === 'tablem'
                ? [2, 12]
                : key === 'armoire'
                  ? [1, 8]
                  : [1, 4];
          return Array.from({ length: range[1] - range[0] + 1 }, (_, offset) => {
            const size = range[0] + offset;
            return [
              item.label,
              `${size} ${item.sizeLabel}`,
              money(assemblyUnitPrice(settings, key, 'local', size, item.defaultSize)),
              money(assemblyUnitPrice(settings, key, 'import', size, item.defaultSize)),
            ];
          });
        }),
        [30, 24, 18, 18],
        [2, 3],
      );
    }
    title('6. Suppléments et cas particuliers');
    [
      'Passage par le balcon : supplément sur devis.',
      'Distance supérieure à 35 km : transport sur devis.',
      'Matériel non emballé : durée supplémentaire.',
      'Les objets lourds peuvent demander plus de manœuvres.',
    ].forEach((line) => paragraph(line, true));
    if (tollPoints.length) {
      title('7. Péages (à la charge du client, non inclus)');
      table(
        ['Péage', 'Axe', ...vehicles.map((vehicle) => vehicle.shortName || vehicle.name)],
        tollPoints.map((point) => [
          point.name,
          point.axis,
          ...vehicles.map((vehicle) => money(point.vehiclePrices[vehicle.id] ?? point.heavyPrice)),
        ]),
        [34, 30, ...vehicles.map(() => 14)],
        vehicles.map((_, index) => index + 2),
      );
      paragraph('Prix par passage. Un aller-retour passe généralement deux fois au même péage.');
    }
    title('8. Paiement, remise et validité');
    paragraph(
      `Modes de paiement : ${[settings.paymentWave !== false ? 'Wave' : '', settings.paymentCash !== false ? 'espèces' : ''].filter(Boolean).join(' et ') || 'à préciser'}.`,
    );
    paragraph(`Validité d’un devis provisoire : ${settings.quoteValidityDays ?? 15} jours.`);
    title('9. Système de calcul du devis, étape par étape');
    [
      'Volume de chaque objet : gabarit, taille, encombrement et démontage selon le type.',
      'Affaires annexes : forfait selon le logement, diminué des cartons et sacs déjà comptés.',
      'Volume utile : dimensions intérieures moins passages de roue, puis coefficient utile de 0,95.',
      'Allers-retours : arrondi supérieur de volume total ÷ (volume utile × remplissage). Remplissage 85 %, ou 75 % si objets fragiles.',
      'Manœuvres : volume, poids, étages, ascenseur, objets lourds et durée plafond. Minimum 2.',
      `Planning : chargement, déchargement, trajets, ${settings.movingLaborPlanning?.tripSetupMinutes ?? 15} minutes de mise en place par voyage et pauses.`,
      'Prix : transport + manœuvres + menuisier + suppléments − remise. Péages indiqués à part.',
    ].forEach((line) => paragraph(line, true));
    title('Règles de stabilité');
    [
      'Les prix sont figés pour chaque réservation au moment de sa création.',
      'Les volumes des véhicules suivent les paramètres actuels.',
      'Mode automatique : inventaire met à jour allers-retours et manœuvres. Mode manuel : l’admin fixe ces valeurs.',
      'Le devis final rend le montant définitif.',
    ].forEach((line) => paragraph(line, true));
    title('10. Autres exemples chiffrés (calculés par le logiciel)');
    const examples = [
      {
        name: 'Studio, RDC vers RDC, 10 km',
        vehicle: vehicles.find((item) => item.id === 'trafic') ?? vehicles[0],
        tier: 0,
        trips: 1,
        movers: 2,
        from: 0,
        to: 0,
        lift: false,
        overtime: 0,
      },
      {
        name: 'F3, 3e sans ascenseur vers 1er sans ascenseur, 20 km',
        vehicle: vehicles.find((item) => item.id === 'sprinter') ?? vehicles[0],
        tier: 1,
        trips: 2,
        movers: 4,
        from: 3,
        to: 1,
        lift: false,
        overtime: 0,
      },
      {
        name: 'Villa, RDC vers 4e avec ascenseur, 30 km',
        vehicle: vehicles.find((item) => item.id === 'master') ?? vehicles[vehicles.length - 1],
        tier: 2,
        trips: 2,
        movers: 5,
        from: 0,
        to: 4,
        lift: true,
        overtime: 0,
      },
      {
        name: 'Location avec chauffeur, 12 km, dépassement de 30 min',
        vehicle: vehicles.find((item) => item.id === 'sprinter') ?? vehicles[0],
        tier: 0,
        trips: 1,
        movers: 0,
        from: 0,
        to: 0,
        lift: false,
        overtime: 30,
      },
    ];
    examples.forEach((example, index) => {
      if (!example.vehicle) return;
      const transport = example.vehicle.prices[example.tier] * example.trips;
      const labour =
        example.movers *
        labourUnitPrice(settings, {
          fromFloor: example.from,
          toFloor: example.to,
          fromLift: false,
          toLift: example.lift,
        });
      const overtime = Math.round(
        (example.overtime * (settings.rentalOvertimeHourlyRate ?? 10000)) / 60,
      );
      title(`Exemple ${index + 1} · ${example.name}`);
      table(
        ['Ligne', 'Qté', 'P.U.', 'Montant'],
        [
          [
            'Transport',
            String(example.trips),
            money(example.vehicle.prices[example.tier]),
            money(transport),
          ],
          ...(example.movers
            ? [['Manœuvres', String(example.movers), money(labour / example.movers), money(labour)]]
            : []),
          ...(overtime
            ? [
                [
                  'Dépassement',
                  `${example.overtime} min`,
                  money(settings.rentalOvertimeHourlyRate ?? 10000),
                  money(overtime),
                ],
              ]
            : []),
          ['TOTAL', '', '', money(transport + labour + overtime)],
        ],
        [56, 10, 16, 16],
        [1, 2, 3],
      );
    });
    title('11. Réponses types');
    [
      [
        'Combien coûte un déménagement ?',
        `Cela dépend de la distance, du véhicule, des allers-retours, des étages et du mobilier. Le transport commence à ${money(vehicles[0]?.prices[0] ?? 0)} par aller-retour pour ${vehicles[0]?.shortName ?? 'un véhicule'}.`,
      ],
      [
        'C’est quoi la location avec chauffeur ?',
        `Nous fournissons le véhicule, le chauffeur et le matériel ; vous fournissez vos manœuvres. Chaque heure au-delà de la fin prévue coûte ${money(settings.rentalOvertimeHourlyRate ?? 10000)}.`,
      ],
      [
        'Le prix peut-il changer ?',
        'Oui, le transport est facturé par aller-retour réellement effectué. Le devis final confirme le montant.',
      ],
      [
        'Les péages sont-ils compris ?',
        'Non, ils sont à votre charge et indiqués à part sur le devis.',
      ],
      ['Vous allez à Thiès / Mbour ?', 'Oui, au-delà de 35 km le prix est fixé sur devis.'],
    ].forEach(([question, answer]) => {
      paragraph(question);
      paragraph(answer, true);
    });
    title('12. Données structurées (lecture machine)');
    [
      'devise = FCFA',
      'unite_transport = aller-retour',
      ...vehicles.flatMap((vehicle) =>
        [0, 1, 2].map(
          (tier) =>
            `transport.${vehicle.id}.${['moins_15km', '15_25km', '25_35km'][tier]} = ${vehicle.prices[tier]}`,
        ),
      ),
      ...vehicles.map((vehicle) => `transport.${vehicle.id}.plus_35km = sur_devis`),
      `manoeuvre.base = ${settings.labourPrice}`,
      `manoeuvre.supplement_par_etage_sans_ascenseur = ${settings.labourFloorPrice ?? 500}`,
      `manoeuvre.supplement_avec_ascenseur = ${settings.labourLiftPrice ?? 500}`,
      `location.depassement_par_heure = ${settings.rentalOvertimeHourlyRate ?? 10000}`,
      'peages.inclus_dans_total = non',
      'calcul.allers_retours = ceil(volume_total / (volume_utile * remplissage))',
      'calcul.remplissage = 0.85 (0.75 si objets fragiles)',
      'calcul.total = transport + manoeuvres + menuisier + supplements - remise',
      ...furniture.map((item) => {
        const key = referenceInventoryKey(item.key);
        return `menuisier.${key} = local:${assemblyUnitPrice(settings, key, 'local', item.defaultSize, item.defaultSize)} ; importe:${assemblyUnitPrice(settings, key, 'import', item.defaultSize, item.defaultSize)}`;
      }),
    ].forEach((line) => paragraph(line));
  }
  footer();
  return doc;
}

export async function exportTariffDocument(
  catalogue: Catalogue,
  kind: Kind,
  share = false,
  tollPoints: TollPoint[] = [],
) {
  const doc = createTariffDocument(catalogue, kind, new Date(), tollPoints);
  const name = `${kind === 'client' ? 'Grille-tarifaire' : 'Guide-tarifaire'}-Demenag-Express-${new Date().toISOString().slice(0, 10)}.pdf`;
  const blob = doc.output('blob');
  if (share && navigator.canShare) {
    const file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title:
          kind === 'client' ? 'Nos tarifs · Demenag Express' : 'Guide tarifaire Demenag Express',
      });
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
