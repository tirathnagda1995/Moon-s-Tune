export interface City {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  timezone: string;
  latitude: number;
  longitude: number;
  region: string;
  cover?: number;
  aliases?: string[];
}
const rows: [
  string,
  string,
  string,
  string,
  number,
  number,
  string,
  number?,
][] = [
  ["Tokyo", "Japan", "JP", "Asia/Tokyo", 35.68, 139.69, "Asia", 0],
  ["Mumbai", "India", "IN", "Asia/Kolkata", 19.08, 72.88, "Asia", 1],
  [
    "London",
    "United Kingdom",
    "GB",
    "Europe/London",
    51.51,
    -0.13,
    "Europe",
    2,
  ],
  ["Lisbon", "Portugal", "PT", "Europe/Lisbon", 38.72, -9.14, "Europe", 3],
  [
    "New York",
    "United States",
    "US",
    "America/New_York",
    40.71,
    -74.01,
    "Americas",
  ],
  ["Paris", "France", "FR", "Europe/Paris", 48.86, 2.35, "Europe"],
  ["Berlin", "Germany", "DE", "Europe/Berlin", 52.52, 13.4, "Europe"],
  ["Toronto", "Canada", "CA", "America/Toronto", 43.65, -79.38, "Americas"],
  [
    "São Paulo",
    "Brazil",
    "BR",
    "America/Sao_Paulo",
    -23.55,
    -46.63,
    "Americas",
  ],
  ["Dubai", "United Arab Emirates", "AE", "Asia/Dubai", 25.2, 55.27, "Asia"],
  ["Singapore", "Singapore", "SG", "Asia/Singapore", 1.35, 103.82, "Asia"],
  ["Edmonton", "Canada", "CA", "America/Edmonton", 53.55, -113.49, "Americas"],
  ["Tehran", "Iran", "IR", "Asia/Tehran", 35.69, 51.39, "Asia"],
  ["Delhi", "India", "IN", "Asia/Kolkata", 28.61, 77.21, "Asia"],
  ["Ahmedabad", "India", "IN", "Asia/Kolkata", 23.02, 72.57, "Asia"],
  ["Bengaluru", "India", "IN", "Asia/Kolkata", 12.97, 77.59, "Asia"],
  ["Chennai", "India", "IN", "Asia/Kolkata", 13.08, 80.27, "Asia"],
  ["Kolkata", "India", "IN", "Asia/Kolkata", 22.57, 88.36, "Asia"],
  ["Pune", "India", "IN", "Asia/Kolkata", 18.52, 73.86, "Asia"],
  ["Hyderabad", "India", "IN", "Asia/Kolkata", 17.39, 78.49, "Asia"],
  ["Seoul", "South Korea", "KR", "Asia/Seoul", 37.57, 126.98, "Asia"],
  ["Bangkok", "Thailand", "TH", "Asia/Bangkok", 13.76, 100.5, "Asia"],
  ["Jakarta", "Indonesia", "ID", "Asia/Jakarta", -6.21, 106.85, "Asia"],
  ["Manila", "Philippines", "PH", "Asia/Manila", 14.6, 120.98, "Asia"],
  ["Taipei", "Taiwan", "TW", "Asia/Taipei", 25.03, 121.57, "Asia"],
  ["Hong Kong", "Hong Kong", "HK", "Asia/Hong_Kong", 22.32, 114.17, "Asia"],
  ["Shanghai", "China", "CN", "Asia/Shanghai", 31.23, 121.47, "Asia"],
  ["Beijing", "China", "CN", "Asia/Shanghai", 39.9, 116.41, "Asia"],
  ["Hanoi", "Vietnam", "VN", "Asia/Ho_Chi_Minh", 21.03, 105.85, "Asia"],
  ["Istanbul", "Türkiye", "TR", "Europe/Istanbul", 41.01, 28.98, "Europe"],
  ["Rome", "Italy", "IT", "Europe/Rome", 41.9, 12.5, "Europe"],
  ["Madrid", "Spain", "ES", "Europe/Madrid", 40.42, -3.7, "Europe"],
  ["Barcelona", "Spain", "ES", "Europe/Madrid", 41.39, 2.17, "Europe"],
  ["Amsterdam", "Netherlands", "NL", "Europe/Amsterdam", 52.37, 4.9, "Europe"],
  ["Stockholm", "Sweden", "SE", "Europe/Stockholm", 59.33, 18.07, "Europe"],
  ["Oslo", "Norway", "NO", "Europe/Oslo", 59.91, 10.75, "Europe"],
  ["Copenhagen", "Denmark", "DK", "Europe/Copenhagen", 55.68, 12.57, "Europe"],
  ["Warsaw", "Poland", "PL", "Europe/Warsaw", 52.23, 21.01, "Europe"],
  ["Prague", "Czechia", "CZ", "Europe/Prague", 50.08, 14.44, "Europe"],
  ["Vienna", "Austria", "AT", "Europe/Vienna", 48.21, 16.37, "Europe"],
  ["Athens", "Greece", "GR", "Europe/Athens", 37.98, 23.73, "Europe"],
  ["Dublin", "Ireland", "IE", "Europe/Dublin", 53.35, -6.26, "Europe"],
  ["Lagos", "Nigeria", "NG", "Africa/Lagos", 6.52, 3.38, "Africa"],
  ["Nairobi", "Kenya", "KE", "Africa/Nairobi", -1.29, 36.82, "Africa"],
  [
    "Cape Town",
    "South Africa",
    "ZA",
    "Africa/Johannesburg",
    -33.92,
    18.42,
    "Africa",
  ],
  ["Cairo", "Egypt", "EG", "Africa/Cairo", 30.04, 31.24, "Africa"],
  ["Accra", "Ghana", "GH", "Africa/Accra", 5.6, -0.19, "Africa"],
  ["Marrakesh", "Morocco", "MA", "Africa/Casablanca", 31.63, -7.98, "Africa"],
  [
    "Mexico City",
    "Mexico",
    "MX",
    "America/Mexico_City",
    19.43,
    -99.13,
    "Americas",
  ],
  [
    "Buenos Aires",
    "Argentina",
    "AR",
    "America/Argentina/Buenos_Aires",
    -34.6,
    -58.38,
    "Americas",
  ],
  ["Bogotá", "Colombia", "CO", "America/Bogota", 4.71, -74.07, "Americas"],
  ["Lima", "Peru", "PE", "America/Lima", -12.05, -77.04, "Americas"],
  ["Santiago", "Chile", "CL", "America/Santiago", -33.45, -70.67, "Americas"],
  [
    "Vancouver",
    "Canada",
    "CA",
    "America/Vancouver",
    49.28,
    -123.12,
    "Americas",
  ],
  ["Montréal", "Canada", "CA", "America/Toronto", 45.5, -73.57, "Americas"],
  [
    "Los Angeles",
    "United States",
    "US",
    "America/Los_Angeles",
    34.05,
    -118.24,
    "Americas",
  ],
  [
    "San Francisco",
    "United States",
    "US",
    "America/Los_Angeles",
    37.77,
    -122.42,
    "Americas",
  ],
  [
    "Chicago",
    "United States",
    "US",
    "America/Chicago",
    41.88,
    -87.63,
    "Americas",
  ],
  ["Sydney", "Australia", "AU", "Australia/Sydney", -33.87, 151.21, "Oceania"],
  [
    "Melbourne",
    "Australia",
    "AU",
    "Australia/Melbourne",
    -37.81,
    144.96,
    "Oceania",
  ],
  [
    "Auckland",
    "New Zealand",
    "NZ",
    "Pacific/Auckland",
    -36.85,
    174.76,
    "Oceania",
  ],
  [
    "Honolulu",
    "United States",
    "US",
    "Pacific/Honolulu",
    21.31,
    -157.86,
    "Oceania",
  ],
  ["Kathmandu", "Nepal", "NP", "Asia/Kathmandu", 27.72, 85.32, "Asia"],
  ["Dhaka", "Bangladesh", "BD", "Asia/Dhaka", 23.81, 90.41, "Asia"],
  ["Karachi", "Pakistan", "PK", "Asia/Karachi", 24.86, 67.01, "Asia"],
  ["Colombo", "Sri Lanka", "LK", "Asia/Colombo", 6.93, 79.86, "Asia"],
];
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const cities: City[] = rows.map(
  ([
    name,
    country,
    countryCode,
    timezone,
    latitude,
    longitude,
    region,
    cover,
  ]) => ({
    id:
      normalize(name).replace(/[^a-z0-9]+/g, "-") +
      "-" +
      countryCode.toLowerCase(),
    name,
    country,
    countryCode,
    timezone,
    latitude,
    longitude,
    region,
    cover,
    aliases:
      name === "Mumbai"
        ? ["Bombay", "मुंबई"]
        : name === "Tokyo"
          ? ["東京"]
          : name === "Tehran"
            ? ["تهران"]
            : name === "Delhi"
              ? ["New Delhi"]
              : name === "Bengaluru"
                ? ["Bangalore"]
                : [],
  }),
);
export function cityById(id: string) {
  return cities.find((c) => c.id === id);
}
export function searchCities(query: string) {
  const q = normalize(query.trim());
  return cities.filter((c) =>
    normalize([c.name, c.country, ...(c.aliases ?? [])].join(" ")).includes(q),
  );
}
