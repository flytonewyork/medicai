"use client";

import { useEffect, useState } from "react";
import {
  fetchCurrentWeather,
  type CurrentWeather,
} from "~/lib/weather/open-meteo";
import { useSettings } from "~/hooks/use-settings";

const CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function useWeather(): CurrentWeather | null {
  const s = useSettings();
  const city = s?.home_city;
  const lat = s?.home_lat;
  const lon = s?.home_lon;
  const [weather, setWeather] = useState<CurrentWeather | null>(null);

  useEffect(() => {
    if (!city || typeof lat !== "number" || typeof lon !== "number") {
      setWeather(null);
      return;
    }
    // Check localStorage cache first
    const key = `anchor_weather_${lat}_${lon}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as CurrentWeather;
        const age = Date.now() - new Date(parsed.fetched_at).getTime();
        if (age < CACHE_MAX_AGE_MS) {
          setWeather(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    void (async () => {
      try {
        const w = await fetchCurrentWeather({
          latitude: lat,
          longitude: lon,
          city,
        });
        if (w) {
          setWeather(w);
          try {
            localStorage.setItem(key, JSON.stringify(w));
          } catch {
            // ignore quota
          }
        }
      } catch {
        setWeather(null);
      }
    })();
  }, [city, lat, lon]);

  return weather;
}
