// Open-Meteo — free, keyless, CORS-enabled weather + geocoding.
// We send only city name (to geocode) and lat/lon (to forecast). Nothing
// identifying about the patient leaves the device.

export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
}

export async function geocodeCity(
  city: string,
): Promise<GeocodeResult | null> {
  if (!city.trim()) return null;
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city.trim());
  url.searchParams.set("count", "1");
  url.searchParams.set("format", "json");
  const r = await fetch(url.toString());
  if (!r.ok) return null;
  const data = (await r.json()) as {
    results?: Array<{
      name: string;
      latitude: number;
      longitude: number;
      country?: string;
      admin1?: string;
      timezone?: string;
    }>;
  };
  const first = data.results?.[0];
  return first ?? null;
}

export interface CurrentWeather {
  fetched_at: string;
  city: string;
  latitude: number;
  longitude: number;
  temperature_c: number;
  apparent_c: number;
  weather_code: number;
  is_day: boolean;
  uv_index_max_today?: number;
  precip_probability_max_today?: number;
  min_temp_c_24h: number;
  max_temp_c_24h: number;
}

export async function fetchCurrentWeather({
  latitude,
  longitude,
  city,
}: {
  latitude: number;
  longitude: number;
  city: string;
}): Promise<CurrentWeather | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation_probability",
  );
  url.searchParams.set("daily", "uv_index_max,precipitation_probability_max");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");
  const r = await fetch(url.toString());
  if (!r.ok) return null;
  const data = (await r.json()) as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      weather_code?: number;
      is_day?: number;
    };
    hourly?: {
      temperature_2m?: number[];
    };
    daily?: {
      uv_index_max?: number[];
      precipitation_probability_max?: number[];
    };
  };
  const t = data.current?.temperature_2m;
  if (typeof t !== "number") return null;
  const hTemps = data.hourly?.temperature_2m ?? [];
  const next24 = hTemps.slice(0, 24);
  const min_temp_c_24h = next24.length ? Math.min(...next24) : t;
  const max_temp_c_24h = next24.length ? Math.max(...next24) : t;
  return {
    fetched_at: new Date().toISOString(),
    city,
    latitude,
    longitude,
    temperature_c: t,
    apparent_c: data.current?.apparent_temperature ?? t,
    weather_code: data.current?.weather_code ?? 0,
    is_day: (data.current?.is_day ?? 1) === 1,
    uv_index_max_today: data.daily?.uv_index_max?.[0],
    precip_probability_max_today:
      data.daily?.precipitation_probability_max?.[0],
    min_temp_c_24h,
    max_temp_c_24h,
  };
}

// WMO weather code grouping — coarse buckets for nudges.
export type WeatherCondition =
  | "clear"
  | "cloud"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "fog"
  | "other";

export function weatherCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloud";
  if (code >= 45 && code <= 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
  if (code >= 95) return "thunderstorm";
  return "other";
}
