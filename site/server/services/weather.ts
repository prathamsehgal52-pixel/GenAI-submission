import { config } from '../config'
import { logger } from '../logger'
import { markIntegration } from './integrationStatus'

/**
 * Forecasts from Open-Meteo (free, no key). Only fixed Open-Meteo hosts are
 * ever requested, with validated numeric coordinates, so there is no SSRF
 * surface. Results are cached briefly per rounded location.
 */
export type DayForecast = { date: string; maxC: number; minC: number; precipitationChance: number | null; code: number | null }
export type Forecast = { locationName: string; days: DayForecast[]; fetchedAt: string }

const cache = new Map<string, { at: number; data: DayForecast[] }>()
const TTL = 30 * 60 * 1000

export async function getForecast(lat: number, lon: number, locationName: string): Promise<Forecast | null> {
  if (!config.WEATHER_ENABLED) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return { locationName, days: hit.data, fetchedAt: new Date(hit.at).toISOString() }
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    timezone: 'auto',
    forecast_days: '14',
  }).toString()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error(`status ${res.status}`)
    const j = (await res.json()) as {
      daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max?: (number | null)[]; weather_code?: (number | null)[] }
    }
    const days = j.daily.time.map((date, i) => ({
      date,
      maxC: j.daily.temperature_2m_max[i],
      minC: j.daily.temperature_2m_min[i],
      precipitationChance: j.daily.precipitation_probability_max?.[i] ?? null,
      code: j.daily.weather_code?.[i] ?? null,
    }))
    cache.set(key, { at: Date.now(), data: days })
    await markIntegration('weather', true)
    return { locationName, days, fetchedAt: new Date().toISOString() }
  } catch (err) {
    logger.warn({ err: String(err) }, 'weather fetch failed')
    await markIntegration('weather', false, String(err))
    return null
  }
}

export type Place = { name: string; region: string | null; country: string | null; latitude: number; longitude: number }

export async function searchPlaces(query: string): Promise<Place[] | null> {
  const q = query.trim().slice(0, 80)
  if (q.length < 2) return []
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.search = new URLSearchParams({ name: q, count: '6', language: 'en', format: 'json' }).toString()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error(`status ${res.status}`)
    const j = (await res.json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] }
    return (j.results ?? []).map((r) => ({ name: r.name, region: r.admin1 ?? null, country: r.country ?? null, latitude: r.latitude, longitude: r.longitude }))
  } catch (err) {
    logger.warn({ err: String(err) }, 'geocoding failed')
    return null
  }
}

/** A short, honest description of the expected temperature for a date. */
export function describeDay(d: DayForecast) {
  return `${Math.round(d.minC)}–${Math.round(d.maxC)}°C${d.precipitationChance != null && d.precipitationChance >= 50 ? `, ${d.precipitationChance}% chance of rain` : ''}`
}
