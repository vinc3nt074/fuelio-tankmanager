export const STORAGE_KEY = "fuelio:data:v1";

export const emptyData = () => ({ version: 1, vehicles: [], refuels: [] });

export function createId(prefix = "id") {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export function parseDecimal(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

export function monthKey(date) {
  return String(date ?? "").slice(0, 7);
}

export function filterByMonth(refuels, month, vehicleId = "all") {
  return refuels
    .filter((entry) => monthKey(entry.date) === month && (vehicleId === "all" || entry.vehicleId === vehicleId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function calculateSummary(refuels) {
  const costs = refuels.reduce((sum, entry) => sum + Number(entry.totalPrice || 0), 0);
  const liters = refuels.reduce((sum, entry) => sum + Number(entry.liters || 0), 0);
  return {
    costs,
    liters,
    count: refuels.length,
    averagePrice: liters > 0 ? costs / liters : 0,
  };
}

export function monthlyStatistics(refuels) {
  const groups = new Map();
  for (const entry of refuels) {
    const key = monthKey(entry.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, entries]) => ({ month, ...calculateSummary(entries) }));
}

export function loadStoredData(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.vehicles) || !Array.isArray(parsed.refuels)) {
      return emptyData();
    }
    return parsed;
  } catch {
    return emptyData();
  }
}

export function saveStoredData(data, storage = globalThis.localStorage) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value || 0);
}

export function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value || 0);
}

export function formatDate(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE").format(new Date(`${value}T12:00:00`));
}

export function formatMonth(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00`));
}

export function todayISO() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}
