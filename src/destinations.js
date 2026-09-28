// Continents are intentionally curated rather than guessed from visitor or article text.
// Only countries present in the current destination catalogue or published articles are shown.
// Add a country here when expanding into new destinations.
export const CONTINENT_COUNTRIES = {
  'Asia': [
    'Afghanistan', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Bhutan',
    'Brunei', 'Cambodia', 'China', 'Cyprus', 'Georgia', 'India', 'Indonesia',
    'Iran', 'Iraq', 'Israel', 'Japan', 'Jordan', 'Kazakhstan', 'Kuwait',
    'Kyrgyzstan', 'Laos', 'Lebanon', 'Malaysia', 'Maldives', 'Mongolia',
    'Myanmar', 'Nepal', 'North Korea', 'Oman', 'Pakistan', 'Palestine',
    'Philippines', 'Qatar', 'Saudi Arabia', 'Singapore', 'South Korea',
    'Sri Lanka', 'Syria', 'Taiwan', 'Tajikistan', 'Thailand', 'Timor-Leste',
    'Turkey', 'Turkmenistan', 'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Yemen'
  ],
  'Europe': [
    'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina',
    'Bulgaria', 'Croatia', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France',
    'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Kosovo',
    'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Moldova',
    'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia', 'Norway',
    'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino', 'Serbia',
    'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine',
    'United Kingdom', 'Vatican City'
  ],
  'North America': [
    'Antigua and Barbuda', 'Bahamas', 'Barbados', 'Belize', 'Canada',
    'Costa Rica', 'Cuba', 'Dominica', 'Dominican Republic', 'El Salvador',
    'Grenada', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica', 'Mexico',
    'Nicaragua', 'Panama', 'Saint Kitts and Nevis', 'Saint Lucia',
    'Saint Vincent and the Grenadines', 'Trinidad and Tobago', 'United States'
  ],
  'South America': [
    'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador',
    'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela'
  ],
  'Africa': [
    'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
    'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros',
    'Democratic Republic of the Congo', 'Republic of the Congo',
    'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini',
    'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau',
    'Ivory Coast', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar',
    'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique',
    'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe',
    'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa',
    'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda',
    'Zambia', 'Zimbabwe'
  ],
  'Oceania': [
    'Australia', 'Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia',
    'Nauru', 'New Zealand', 'Palau', 'Papua New Guinea', 'Samoa',
    'Solomon Islands', 'Tonga', 'Tuvalu', 'Vanuatu'
  ]
};

export const CONTINENT_ORDER = [
  'Asia', 'Europe', 'North America', 'South America', 'Africa', 'Oceania',
  'Other destinations'
];

const collator = new Intl.Collator('en', { sensitivity: 'base' });
const regionOf = new Map(
  Object.entries(CONTINENT_COUNTRIES).flatMap(([continent, names]) =>
    names.map(name => [name.toLocaleLowerCase('en'), continent])
  )
);

const regionAliases = {
  'usa': 'North America',
  'united states of america': 'North America',
  'uk': 'Europe',
  'the netherlands': 'Europe',
  'czech republic': 'Europe',
  'türkiye': 'Asia',
  'viet nam': 'Asia',
  'côte d’ivoire': 'Africa',
  'south korea (republic of korea)': 'Asia'
};

export const STARTER_DESTINATIONS = [
  'Vietnam', 'Cambodia', 'Thailand', 'Laos', 'Japan', 'Singapore',
  'France', 'Indonesia', 'Malaysia', 'Italy', 'Spain', 'United States'
];

export function groupDestinationsByContinent(names) {
  const seen = new Set();
  const grouped = new Map();
  for (const raw of names) {
    if (typeof raw !== 'string') continue;
    const name = raw.trim();
    const key = name.toLocaleLowerCase('en');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const continent = regionOf.get(key) || regionAliases[key] || 'Other destinations';
    if (!grouped.has(continent)) grouped.set(continent, []);
    grouped.get(continent).push(name);
  }
  return CONTINENT_ORDER
    .filter(continent => grouped.has(continent))
    .map(continent => ({
      continent,
      countries: grouped.get(continent).sort((a, b) => collator.compare(a, b))
    }));
}
