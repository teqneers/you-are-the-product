// What kind of site a domain is, e.g. apotheken-umschau.de → health. Runs locally, no network:
// a hand-curated list of well-known sites first, then conservative keyword rules on the domain name.
import data from '../data/site-categories.json';

export const SITE_CATEGORIES = [
  'health',
  'jobs',
  'finance',
  'news',
  'shopping',
  'travel',
  'dating',
  'religion',
  'politics',
  'adult',
  'kids',
  'education',
  'sports',
  'entertainment',
  'social',
  'gaming',
  'food',
  'real-estate',
  'cars',
  'tech',
] as const;

export type SiteCategory = (typeof SITE_CATEGORIES)[number];

/**
 * Categories close to the GDPR Art. 9 "special categories" of personal data:
 * health, sex life (dating, adult), religious beliefs and political opinions.
 */
export const SENSITIVE: ReadonlySet<SiteCategory> = new Set<SiteCategory>([
  'health',
  'dating',
  'religion',
  'politics',
  'adult',
]);

const KNOWN = new Map<string, SiteCategory>();
for (const [category, domains] of Object.entries(data as Record<SiteCategory, string[]>)) {
  for (const domain of domains) KNOWN.set(domain, category as SiteCategory);
}

/** Second-level labels under country codes (co.uk, com.br, or.jp …): never the site's own name. */
const GENERIC_SLD = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'or', 'ne', 'go', 'gv', 'gob', 'ltd', 'plc']);

/**
 * Keyword rules on the site's own name label (without TLD), checked in this order; the first match wins.
 * `(^|-)` and `($|-)` anchor a keyword at the start or end of a word, since domains have no spaces.
 * Compounds (zahnarztpraxis, online-apotheke) are why most keywords are not anchored on both sides;
 * every keyword that is part of an unrelated common word is anchored or excluded (see the tests).
 */
const RULES: ReadonlyArray<readonly [SiteCategory, RegExp]> = [
  ['adult', /porn|xxx|hentai|erotik|erotic|fetis[c]?h|bdsm|swinger|nsfw|camgirl|bordell|brothel|(^|-)sex(?!t)|(^|-)escort/],
  ['dating', /dating|dejting|deitti|flirt|singleboerse|singles|partnersuche|partnervermittlung|celibataire|solteros|solteiros|incontri|randki|seznamka/],
  [
    'health',
    /apothe[kc]|apotek|apteka|apteekki|lekarna|farmacia|pharma|(?<!schw)arzt|aerzt|klinik|clinic|spital(?!ity)|ospedale|szpital|sairaala|nemocnice|krankenhaus|krankenkasse|health|gesundheit|(^|-)sante($|-)|(^|-)salud($|-)|(^|-)saude($|-)|zdrowie|gezondheid|terveys|sundhed|(^|-)(medizin|medical|medic|medico|medecin)|physiothera|psychothera|therapie|therapy|terapia|schwanger|pregnan|grossesse|embarazo|gravidanza/,
  ],
  [
    'religion',
    /(^|-)kirche|kirche($|-)|kirchengemeinde|church(?!ill)|bible|bibel|biblia|bijbel|islam(?!abad)|moschee|mosque|mosquee|moske|quran|koran|synagog|jewish|juedisch|katholisch|catholic|cattolic|katolick|evangelisch|evangeli(?!on)|bistum|dioezese|diozese|diocese|diocesi|pfarrei|pfarramt|parish|parrocchia|paroisse|parafia|parroquia|vatican|vatikan|buddhis|hindu(?!stan)/,
  ],
  [
    'politics',
    /partei|(^|-)parti($|-)|(^|-)partito|(^|-)partido|partij|(green|labou?r|libertarian|socialist|democratic|communist|pirate|conservative|republican|reform)-?party|democrats|republicans|parlament|parliament|bundestag|landtag|petition|politik|politic|politique|polityka|politiek|politiikka/,
  ],
  [
    'finance',
    /(^|-)bank(?!ett)|(volks|spar|post|raiffeisen|landes|direkt|hypo|sparda|kreis|staats|privat|online|genossenschafts|commerz|deutsche|investment|gemeinde|stadt)bank|banking|(^|-)banco|(^|-)banca(?!rel)|banque|sparkasse|kredit|credit|versicherung|insurance|(^|-)seguros?($|-)|assicurazion|verzekering|ubezpieczen|pojist|forsikring|forsakring|vakuutus|finanz|financ|finans|invest(?!igat)|aktien|bitcoin|crypto|krypto|steuerberat|hypothek|mortgage|hipoteca|(^|-)loans?($|-)/,
  ],
  [
    'jobs',
    /(^|-)job|jobs($|-)|karriere|career|stellen(markt|angebot|anzeige|boerse|portal|suche)|(^|-)emploi|empleo|(^|-)lavoro|(^|-)praca($|-)|(^|-)prace($|-)|vacature|(^|-)vagas($|-)|(^|-)rekry|recruit|rekrut|bewerbung|ausbildung|azubi|freelance/,
  ],
  ['kids', /kinder|(^|-)kids|kids($|-)|(^|-)baby|spielzeug|(^|-)toys($|-)|enfant|bambin|dzieci|dziecko|kodomo|eltern/],
  [
    'education',
    /^uni-|universit|universidad|universidade|uniwersytet|univerzit|yliopisto|hochschule|schule|school|ecole|escuela|scuola|szkola|skola|koulu|akademie|academy|academia|akademia|gymnasium|lernen|learn|nachhilfe|tutor|studium|studien|student|dictionary|woerterbuch|dizionario|diccionario|dictionnaire|slownik|ordbog|ordbok|sanakirja/,
  ],
  [
    'travel',
    /hotel|hostel|(?<![pk])reise|travel|urlaub|ferien|(^|-)fewo|flug|flight|airline|airport|camping|kreuzfahrt|cruise|voyage|viaje|viaggi|reizen|podroz|cestovn|ryokou/,
  ],
  [
    'real-estate',
    /(^|-)immo(?!rt)|immobil|makler|makelaar|realestate|real-estate|realty|realtor|wohnung|hausverwaltung|inmobiliaria|imobiliaria|immobiliare|immobilier|nieruchomosci|(^|-)bolig|bostad|(^|-)asunto|fudosan/,
  ],
  [
    'sports',
    /fussball|football|futbol|calcio|voetbal|fotboll|jalkapallo|soccer|(^|-)sport(?!wett)|(?<!tran|pas)sports?($|-)|fitness|(^|-)tennis|(^|-)golf|handball|basketball|volleyball|hockey|marathon|(^|-)yoga|^(1-)?(fc|tsv|vfb|vfl)-/,
  ],
  [
    'cars',
    /(^|-)auto(?!r|mat|nom|graph|cad|desk)|auto($|-)|^cars-|(?<!os)cars($|-)|(^|-)kfz|motor(?!ola)|fahrzeug|gebrauchtwagen|neuwagen|wohnmobil|reifen|(^|-)tyres|(^|-)coches|voiture|samochod/,
  ],
  [
    'food',
    /rezept|recipe|recette|receta|ricett|recept|przepis|receita|resepti|opskrift|kochen|cooking|backen(?!d)|restaurant|ristorante|trattoria|pizz|sushi|(^|-)burger|doener|kebab|bistro|brasserie|gasthaus|gasthof|wirtshaus|biergarten|baeckerei|bakery|metzgerei|catering|partyservice|weingut|winery|brauerei|brewery|food|lecker/,
  ],
  ['gaming', /games|gaming|gamer|(^|-)spiele|jeux|juegos|giochi|esport|minecraft|fortnite|pokemon/],
  [
    'entertainment',
    /(^|-)kino|cinema|film|movie|musik|music|musique|musica|muziek|muzyka|musiikki|radio(?!log)|konzert|concert|theater|theatre|teatro|comedy|manga|anime|podcast/,
  ],
  ['tech', /software|computer|hardware|hosting|linux|android|iphone|developer|programmier|coding|webdesign/],
  ['shopping', /(?<!work|photo)shop|outlet|fashion|schuhe|shoes|chaussure|zapato|scarpe|kaufhaus|moebel|furniture/],
];

/** Lowercase ASCII form: ä → ae, ß → ss, é → e. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** The site's own name in a hostname: "online-apotheke" in shop.online-apotheke.co.uk. */
function siteName(labels: string[]): string | null {
  const rest = labels.slice(0, -1);
  if (rest.length > 1 && GENERIC_SLD.has(rest.at(-1) ?? '')) rest.pop();
  return rest.at(-1) || null;
}

/** Category from the keyword rules alone, for a site name like "online-apotheke" (exported for tests). */
export function guessCategory(name: string): SiteCategory | null {
  const text = normalize(name);
  for (const [category, pattern] of RULES) if (pattern.test(text)) return category;
  return null;
}

/**
 * Category of a site, e.g. "apotheken-umschau.de" → "health", or null if unknown.
 * Accepts a registrable domain or a full hostname: the curated list is tried for the name itself,
 * then with subdomains stripped one by one, and only then the keyword rules on the site's name.
 */
export function categoryOf(domain: string): SiteCategory | null {
  const host = domain.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return null;
  const labels = host.split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    const hit = KNOWN.get(labels.slice(i).join('.'));
    if (hit) return hit;
  }
  const name = siteName(labels);
  return name ? guessCategory(name) : null;
}
