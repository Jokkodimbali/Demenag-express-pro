# Règles de calcul

Document relevé dans le code du dépôt le 12 novembre 2026. Les calculs ne sont pas tous réalisés au même endroit : l’estimation de durée est dans le frontend ; le montant définitif est calculé côté backend. Les valeurs initiales peuvent être remplacées par les paramètres enregistrés dans PostgreSQL. Une modification du code source doit être accompagnée de la mise à jour des tests correspondants.

## Repères monétaires et unités

| Élément            | Règle                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| Devise             | XOF (FCFA)                                                                           |
| Montants persistés | Entiers ; le backend vérifie les limites d’entiers de base de données                |
| Volume             | m³                                                                                   |
| Poids              | kg                                                                                   |
| Durées             | Minutes et heures ; plusieurs étapes d’horaire sont arrondies par blocs de 5 minutes |
| Distance           | km pour les tranches tarifaires et minutes/km du trajet pour l’estimation de temps   |

## Tarif de transport et devis final

### Tranche et prix unitaire

Les bornes sont configurées (`distanceBounds`, initialement `[15, 25, 35]` dans le référentiel). La borne basse de la première tranche est exclusive ; les bornes suivantes inclusives.

| Condition de distance `d` | Tranche | Prix de transport                          |
| ------------------------- | ------- | ------------------------------------------ |
| `d < borne[0]`            | 0       | `vehicle.prices[0]`                        |
| `borne[0] ≤ d ≤ borne[1]` | 1       | `vehicle.prices[1]`                        |
| `borne[1] < d ≤ borne[2]` | 2       | `vehicle.prices[2]`                        |
| `d > borne[2]`            | 3       | `customPrice`, sinon 0 et prix « à fixer » |

La fonction `tierOf` applique les comparaisons `<`, `<=`, `<=`, sinon tranche 3. Une distance négative ou non finie est rejetée.

### Trajets multiples et jours creux

| Élément                     | Calcul                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------- |
| Premier aller-retour        | Prix unitaire complet                                                               |
| Trajets suivants            | `roundTo500(prix × clamp(pourcentage, 10, 100) / 100)` chacun                       |
| Pourcentage initial suivant | 60 % selon `defaultMovingLaborPlanning`; paramétrable                               |
| Jour creux                  | Lundi à jeudi inclus et jour du mois de 6 à 24 inclus                               |
| Remise jour creux           | `roundTo500(totalTransport × pourcentage / 100)` ; appliquée au transport seulement |

Si le pourcentage de trajets suivants est 100 %, une ligne de quantité égale au nombre de trajets est utilisée. Le prix à fixer au-delà de la dernière tranche doit être renseigné pour rendre le transport facturable.

### Main-d’œuvre et montage

| Ligne                           | Formule                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| Manœuvre, sans accès détaillé   | `quantité × settings.labourPrice`                                  |
| Supplément étage sans ascenseur | `étage × labourFloorPrice` par adresse concernée, étage RDC exclu  |
| Supplément étage avec ascenseur | `labourLiftPrice` par adresse concernée au-dessus du RDC           |
| Manœuvre totale                 | Tarif de base + suppléments origine + destination, puis × quantité |
| Prix personnalisé de manœuvre   | Remplace le prix unitaire calculé lorsqu’il est fourni et valide   |
| Bureau, armoire, lit            | Quantité × tarif d’assemblage de paramètres/référence              |

Les valeurs historiques de départ sont 6 500 FCFA de main-d’œuvre de base, 500 FCFA par étage et 500 FCFA par côté avec ascenseur. La grille détaillée de main-d’œuvre peut contenir des prix par étages et types d’accès et être persistée.

### Remises, extras et total

| Étape                          | Calcul/validation                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Sous-total                     | Somme des montants de chaque ligne, extras compris                                                |
| Remise en pourcentage          | `round(sousTotal × min(100, remise) / 100)`                                                       |
| Remise fixe                    | `min(remiseFCFA, sousTotal)`                                                                      |
| Total final                    | `sousTotal − remise effective`                                                                    |
| Ligne extra                    | `round(quantité × prixUnitaire)` ; libellé, quantité et prix doivent passer la validation backend |
| Montant de ligne et sous-total | Doivent rester entiers sûrs et sous la limite maximale stockable                                  |

La remise générale peut être fixe ou en pourcentage, avec motif facultatif. La remise de jour creux est une ligne négative séparée avant le calcul de la remise générale. Les unités de prix sont des entiers en FCFA.

### Tarifs de référence

Les chiffres suivants sont des valeurs de départ du fichier `shared/reference-tariff-defaults.ts`, pas la garantie des valeurs actives dans toute base.

| Véhicule | Tranche 0 | Tranche 1 | Tranche 2 |
| -------- | --------: | --------: | --------: |
| Trafic   |    15 000 |    18 500 |    22 000 |
| Sprinter |    28 000 |    34 500 |    41 500 |
| Master   |    25 000 |    31 000 |    37 000 |

Les prix des objets à assembler sont définis par objet, origine locale/importée et parfois format/taille dans `shared/reference-assembly-price-defaults.js`. La grille d’assemblage est prioritaire sur les valeurs par défaut. Pour un tarif numérique, l’importé vaut 1,5 fois le local ; pour une grille objet, le code cherche d’abord un prix exact par taille/origine, puis un prix de base et éventuellement un incrément de taille. La liste détaillée des prix reste dans le fichier source afin d’éviter une copie documentaire qui divergerait.

## Inventaire : volume et voyages estimés

### Volumes de base

Le tableau contient les bases utilisées lorsque l’objet ne définit pas déjà un format explicite dans `inventory.ts`. Les objets avec `volumeByFormat` prennent leurs trois volumes de référence Small/Moyen/Grand dans ce fichier de définition.

| Objet           | Volume de base m³ | Objet                          | Volume de base m³ |
| --------------- | ----------------: | ------------------------------ | ----------------: |
| Salon           |              0,60 | Table basse                    |             0,40* |
| Meuble TV       |             0,60* | Télévision                     |             0,25* |
| Table à manger  |              0,17 | Chaise                         |             0,25* |
| Buffet          |             1,50* | Bibliothèque                   |             1,20* |
| Vitrine         |             1,20* | Tapis                          |             0,15* |
| Lit             |              0,50 | Matelas                        |              0,25 |
| Armoire         |              0,80 | Coiffeuse                      |              0,60 |
| Commode         |              0,70 | Chevet                         |              0,20 |
| Bureau          |              0,90 | Réfrigérateur                  |              1,00 |
| Congélateur     |              0,90 | Cuisinière                     |              0,60 |
| Machine à laver |              0,50 | Micro-ondes                    |              0,10 |
| Climatiseur     |              0,40 | Ventilateur                    |              0,15 |
| Gaz             |              0,08 | Carton                         |              0,07 |
| Sac             |              0,10 | Vélo                           |              0,50 |
| Pot             |              0,15 | Objet personnalisé sans format |      0,50 (moyen) |

`*` Ces objets ont souvent des volumes par format qui remplacent leur volume de base. Les facteurs génériques small/medium/large sont `[0,6 ; 1 ; 1,6]` lorsque aucune table par format n’est définie. Le salon est non empilable et reçoit un facteur 1,25. Les dimensions personnalisées donnent `L × l × H / 1 000 000` avec les mesures attendues en centimètres.

### Démontage, logement et capacité

| Règle                                     | Calcul                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Volume démonté                            | Volume objet × facteur : lit 0,6 ; armoire 0,6 ; table à manger 0,6 ; bureau 0,7 ; climatiseur 1 ; autres objets démontables 0,8 |
| Objet personnalisé dimensionné et démonté | Volume dimensionnel × 0,8                                                                                                        |
| Objet personnalisé par format             | 0,3 / 0,5 / 0,8 m³ pour petit/moyen/grand, puis ×0,8 si démonté                                                                  |
| Volume indicatif annexes par logement     | Studio 1,5 ; F2 2,5 ; F3 3,5 ; F4 5 ; F5+ 6,5 ; Villa 9 m³                                                                       |
| Annexes                                   | Volume logement moins les cartons/sacs déjà comptés ; nul si désactivé                                                           |
| Volume total                              | Somme des groupes léger + mobilier + encombrant + lourd                                                                          |
| Taux de remplissage véhicule              | 75 % si fragile, sinon 85 %                                                                                                      |
| Trajets estimés                           | `ceil(volume / (volume véhicule × taux de remplissage))`, minimum 1 si le volume est positif                                     |

Le volume véhicule utilisé par l’estimateur est la valeur numérique du champ catalogue `vehicle.volume` (virgule décimale acceptée) ; en cas de valeur absente/invalide, l’estimateur retombe à 10 m³. Le paramètre manuel `trips` est ramené entre 1 et 99. Le calcul géométrique utilisé pour l’administration de flotte est distinct : `(longueur × hauteur × largeur − arche de roues) × 0,95`, avec arche estimée selon `wheelWidth`, `length`, 0,3 et `0,95 × 1,9`. Ne pas confondre capacité indicative de l’estimation et capacité géométrique affichée/calculée par l’outil de flotte.

### Poids de référence

Le poids d’objet est un modèle estimatif. Le détail par format ou taille se trouve dans `moving-estimate-inventory.ts`.

| Objet            | Poids de référence                                   |
| ---------------- | ---------------------------------------------------- |
| Réfrigérateur    | 30 / 65 / 110 kg petit/moyen/grand                   |
| Congélateur      | 35 / 50 / 70 kg                                      |
| Cuisinière       | 8 / 45 / 60 kg                                       |
| Machine à laver  | 55 / 70 / 80 kg                                      |
| Climatiseur      | 30 / 40 / 55 kg                                      |
| Carton           | 12 / 15 / 18 kg                                      |
| Sac              | 8 / 12 / 18 kg                                       |
| Télévision       | 8 / 15 / 25 kg                                       |
| Salon            | Poids par modules calculés selon le nombre de places |
| Matelas          | `10 + 8 × taille` kg                                 |
| Lit              | `30 + 10 × taille` kg                                |
| Armoire          | Poids par éléments/portes calculé selon la taille    |
| Table à manger   | `25 + 3 × taille` kg                                 |
| Annexes logement | 110 kg par m³ indicatif                              |

Les charges lourdes, fragiles, les escaliers, le démontage et les dimensions peuvent imposer plusieurs manutentionnaires pour un objet. Le poids maximal d’un item, pas uniquement le poids total, sert à cette estimation.

## Estimation de durée et d’équipe

Ces calculs de planification sont dans `frontend/src/modules/moving/domain/estimate/moving-estimate.ts`. Ils produisent un horaire estimatif, pas une mesure physique garantie.

| Facteur                 | Règle de base                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Débit de référence      | 2,7 m³/heure/manœuvreur (paramétrable)                                                                                                        |
| Débit par groupe        | Léger ×1,4 ; mobilier ×1 ; encombrant ×1,2 ; lourd ×0,72                                                                                      |
| Déchargement            | Multiplicateur de durée 1,2                                                                                                                   |
| Étages avec ascenseur   | `1,05 + facteurAscenseur × étages` ; facteurs léger 0,03, mobilier 0,05, encombrant 0,15, lourd 0,08                                          |
| Étages sans ascenseur   | `1 + facteurEscalier × étages`; facteurs 0,10 / 0,15 / 0,20 / 0,25 ; escaliers étroits multiplient le facteur par 1,4                         |
| Accès difficile         | Durées de site ×1,2 et distance ISO de portage doublée                                                                                        |
| Fragilité               | Durées de site ×1,1 ; capacité véhicule chargée à 75 %                                                                                        |
| Balcon                  | Chargement ×1,2                                                                                                                               |
| Densité                 | `sqrt(poids total / volume / 110)`, bornée entre 0,85 et 1,4                                                                                  |
| Préparation             | Si emballage ou logement non prêt : `0,45 × volume léger + 0,1 × autres groupes`, en heures/personne avant division par l’efficacité d’équipe |
| Mise en place de voyage | 15 minutes par vague de trajets parallèles par défaut                                                                                         |

### Démontage et manœuvres

| Objet démonté          |         Origine |     Destination |
| ---------------------- | --------------: | --------------: |
| Lit                    |          0,35 h |          0,50 h |
| Armoire                | 0,25 h × taille | 0,40 h × taille |
| Table à manger         |          0,15 h |          0,25 h |
| Bureau                 |          0,25 h |          0,40 h |
| Climatiseur            |          0,75 h |          1,25 h |
| Autre objet inventorié |          0,20 h |          0,30 h |
| Objet personnalisé     |          0,20 h |          0,30 h |

Les tâches de montage/démontage sont réparties en parallèle à partir des manœuvres menuisiers estimées ; le calcul compare le temps de manutention et le temps de menuiserie puis cherche une équipe suffisante pour respecter la durée maximale cible.

### Calcul d’équipe

| Étape                          | Formule résumée                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Limite ISO par site            | ≤1 m : 10 000 kg ; 1–20 m : baisse linéaire à 6 000 kg ; >20 m : `120 000 / distance` kg                                                                                  |
| Distance ISO                   | `distance de portage (15 m par défaut, ×2 si accès difficile) + (2 m ascenseur ou 15 m escalier) × étage`                                                                 |
| Équipe ISO                     | `max(1, ceil(poids/limite origine + poids/limite destination − 0,05))`                                                                                                    |
| Équipe volume                  | `max(ceil(volume/6), ceil(poids/max(100, 6×110))) + supplément escalier`                                                                                                  |
| Aide au portage                | Base 1 personne jusqu’à 25 kg, 2 jusqu’à 100 kg, 3 au-delà ; aide d’escalier possible si item >33 kg ; maximum de cette composante 4                                      |
| Équipe minimale                | Maximum des besoins escalier lourd, portage, équipe volume/ISO plafonnée par capacité d’équipe du véhicule, plus grande équipe item et 2 personnes par véhicule parallèle |
| Efficacité équipe par véhicule | Jusqu’à 2 : `n`; 2 à 4 : `2 + 0,75×(n−2)` ; au-delà : `3,5 + 0,4×(n−4)`                                                                                                   |

Les valeurs de portage, capacité, étages et équipe sont configurables en partie. Les formules donnent une estimation de charge et de durée, non une certification ergonomique.

### Trajet, horaires, pauses et chaleur

| Élément                            | Règle                                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Durée routière                     | Fournisseur/estimation du trajet selon distance, horaire, date, adresses, véhicule et état du péage ; une durée manuelle peut être passée en option |
| Aller chargé                       | durée route + 10 minutes                                                                                                                            |
| Retour à vide additionnel          | 85 % de la durée route + 10 minutes                                                                                                                 |
| Nombre de vagues                   | `ceil(trajets / véhicules parallèles)`                                                                                                              |
| Horaire affiché                    | segments généralement arrondis par incréments de 5 minutes                                                                                          |
| Limites de planification initiales | cible manutention 3 h ; journée cible 8 h ; début par défaut 08:00 ; durée totale max 12 h ; pause de 30 min                                        |
| Chaleur mensuelle Dakar            | WBGT de référence mensuel : `[22,22,23,23,25,27,28,28.5,29,28.5,26.5,24]` + correction paramétrable                                                 |
| Référence chaleur                  | 26, ou 25 pour classe de logement ≥4                                                                                                                |
| Fraction de travail                | écart WBGT ≤0 : 100 % ; ≤2 : 75 % ; ≤4 : 50 % ; sinon 25 %                                                                                          |
| Repos manuel                       | repos borné entre 5 et 45 min par heure ; temps de travail = 60 − repos                                                                             |

Le calendrier final des pauses, déjeuners et répartition sur plusieurs jours est construit après la génération des segments. Les estimations routières et thermiques dépendent de l’option et de la date ; elles peuvent donc évoluer sans changement des règles d’inventaire.

## Péages

| Donnée              | Règle                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Prix unitaire       | prix spécifique du véhicule s’il existe, sinon tarif lourd du point de péage                      |
| Nombre payé         | `trajets × 2` pour aller-retour, sinon `trajets`                                                  |
| Total de ligne      | quantité payée × tarif unitaire de péage                                                          |
| Origine des données | points de péage gérés en base ; un devis stocke ses prix/paramètres conformément à son instantané |

## Modes de facturation du devis

| Mode                                      | Effet sur les lignes et charges                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complet                                   | Inclut le transport, les manœuvres, les objets de montage et les frais/options retenus. Les lignes issues de l’inventaire sont rapprochées des options déjà saisies pour éviter le double compte. |
| Standard                                  | Conserve les prestations de base ; les options bureau/armoire/lit peuvent être exclues selon les règles du formulaire.                                                                            |
| Location avec chauffeur (`driver-rental`) | Le coût des manœuvres est mis à zéro dans le calcul comptable des coûts de ce devis. Le prix client dépend des lignes de location saisies.                                                        |

Les suppléments balcon, heures au-delà du seuil et autres extras sont des lignes séparées, validées par le serveur. Les règles détaillées de composition des lignes se trouvent dans `frontend/src/modules/admin/quotes/application/services/` et `backend/src/domain/pricing/pricing.ts`.

## Comptabilisation des devis définitifs

### Charges variables automatiques

| Écriture  | Quantité source                                                                                        | Montant                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Revenu    | Montant total du devis final                                                                           | Total client figé                                                             |
| Manœuvres | Mode non-location : équipe du devis final, puis équipe de réservation/estimation/inventaire en recours | `nombre × moverCostPerMove` (valeur initiale 5 000 FCFA)                      |
| Menuisier | Items démontés et certains items explicitement marqués menuisier ; le climatiseur est exclu            | Somme des quantités × prix de main-d’œuvre comptable par objet/taille/origine |

Le mode location chauffeur force le coût manœuvre à 0. Les prix de vente du montage et les coûts comptables de menuisier sont deux grilles séparées (`reference-assembly-price-defaults` et `reference-assembly-payroll-prices`). Les coûts calculés sont archivés avec le devis, puis les écritures automatiques sont liées à l’identifiant/type de devis ; la contrainte unique empêche les doublons.

### Prévisions et charges mensuelles

Le moteur `simulateAccounting` consolide le journal par mois et applique la configuration comptable. Il distingue les écritures enregistrées des projections ; une prévision ne signifie pas nécessairement qu’une écriture réelle a été payée.

| Indicateur de prévision          | Formule centrale                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Revenus mensuels                 | Somme des écritures de type revenu du mois                                                                                    |
| Charges du journal               | Somme des charges hors catégories automatiques/fixes exclues du calcul pour éviter un double compte                           |
| Salaires                         | Écriture fixe si postée, sinon somme des salaires configurés                                                                  |
| Publicité                        | Somme des budgets publicitaires configurés pour le mois                                                                       |
| Résultat/profit                  | revenus − charges journal − salaires − publicité                                                                              |
| Amortissement flotte mensuel     | valeur flotte / (années × 12), plafonné au reste de la valeur ; achats véhicule s’ajoutent à la base à partir du mois d’achat |
| Amortissement annexes            | valeur de chaque annexe / (durée en années × 12), plafonné au solde de l’actif                                                |
| Dette mensuelle cible            | dette configurée / durée de remboursement ; les écritures versées et reliquats sont suivis séparément                         |
| Réserve véhicule mensuelle cible | objectif véhicule / 12 ; versement journalier/configuré peut être supérieur                                                   |
| Assurance mensuelle estimée      | nombre de véhicules × assurance annuelle / 12                                                                                 |
| Réserve légale cible             | pourcentage du solde comptable positif, plafonné à un pourcentage du capital flotte et annexes                                |
| Impôt SUARL simulé               | taux d’IS × résultat taxable positif après amortissements ; régime et mois de démarrage selon configuration                   |
| Trésorerie estimée               | profit − dette payée − réserve véhicule payée − réserve légale payée − impôt simulé                                           |

La comptabilité et les prévisions sont un outil de gestion interne. Les taux, charges et écritures manuelles dépendent de la configuration courante. Le tableau ne remplace pas la validation par un professionnel comptable et fiscal.

## Sources et tests de non-régression

| Sujet                            | Sources principales                                                                                                        | Tests présents                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Estimation de travail/inventaire | `frontend/src/modules/moving/domain/estimate/`                                                                             | `frontend/tests/moving-estimate.test.ts`, `loading-simulation-details.test.ts`                     |
| Capacité véhicules               | `frontend/src/modules/moving/domain/vehicle-dimensions.ts`, `backend/src/domain/fleet/vehicle-capacity.ts`                 | `frontend/tests/vehicle-capacity.test.ts`                                                          |
| Tarifs et devis                  | `backend/src/domain/pricing/`, `shared/reference-tariff-defaults.ts`                                                       | `frontend/tests/reference-pricing.test.ts`, `reference-price-parity.test.ts`, backend domain tests |
| Comptabilité                     | `backend/src/domain/accounting/accounting-costs.ts`, `frontend/src/modules/admin/accounting/domain/accounting-forecast.ts` | `frontend/tests/accounting-forecast.test.ts`, `backend/tests/integration/accounting.ts`            |
| Configuration de référence       | `shared/reference-tariff-defaults.ts` et `shared/reference-assembly-*.js`                                                  | `frontend/tests/reference-settings-parity.test.ts`                                                 |

Les tests établissent les comportements qu’ils couvrent. Ils ne prouvent pas automatiquement que toutes les données de production sont correctes ou que chaque parcours visuel correspond à un fichier de référence.
