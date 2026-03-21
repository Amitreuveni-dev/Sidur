import type { WeatherResponse, WeatherCurrent } from './types';

const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=31.716&longitude=35.112&current=temperature_2m,precipitation,weathercode';

// Rain-related WMO weather codes
const RAIN_CODES = new Set([
  51, 53, 55, // drizzle
  56, 57,     // freezing drizzle
  61, 63, 65, // rain
  66, 67,     // freezing rain
  80, 81, 82, // rain showers
  95, 96, 99, // thunderstorm
]);

let cachedWeather: WeatherCurrent | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function fetchWeather(): Promise<WeatherCurrent | null> {
  const now = Date.now();
  if (cachedWeather && now - cacheTimestamp < CACHE_TTL) {
    return cachedWeather;
  }

  try {
    const res = await fetch(WEATHER_URL);
    if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

    const data = (await res.json()) as WeatherResponse;
    cachedWeather = data.current;
    cacheTimestamp = now;
    return data.current;
  } catch (err) {
    console.error('Failed to fetch weather:', err);
    return cachedWeather; // return stale cache if available
  }
}

export function isRaining(weather: WeatherCurrent): boolean {
  return weather.precipitation > 0 || RAIN_CODES.has(weather.weathercode);
}

export function isCold(weather: WeatherCurrent): boolean {
  return weather.temperature_2m < 10;
}
