import test from "node:test";
import assert from "node:assert/strict";
import { calculateSummary, filterByMonth, loadStoredData, monthlyStatistics, parseDecimal, saveStoredData, STORAGE_KEY } from "../src/domain.js";

const entries = [
  { id: "1", vehicleId: "a", date: "2026-09-02", createdAt: "2026-09-02", liters: 40, pricePerLiter: 1.7, totalPrice: 68 },
  { id: "2", vehicleId: "b", date: "2026-09-11", createdAt: "2026-09-11", liters: 20, pricePerLiter: 1.8, totalPrice: 36 },
  { id: "3", vehicleId: "a", date: "2026-08-20", createdAt: "2026-08-20", liters: 10, pricePerLiter: 1.6, totalPrice: 16 },
];

test("German decimal values are parsed", () => {
  assert.equal(parseDecimal("1,729"), 1.729);
  assert.equal(parseDecimal(" 42.5 "), 42.5);
  assert.equal(parseDecimal("invalid"), 0);
});

test("summary uses weighted price per liter", () => {
  const result = calculateSummary(entries.slice(0, 2));
  assert.equal(result.costs, 104);
  assert.equal(result.liters, 60);
  assert.equal(result.count, 2);
  assert.equal(result.averagePrice, 104 / 60);
});

test("month and vehicle filters work together", () => {
  assert.deepEqual(filterByMonth(entries, "2026-09", "a").map((item) => item.id), ["1"]);
  assert.equal(filterByMonth(entries, "2026-09").length, 2);
});

test("monthly statistics are chronologically sorted", () => {
  const stats = monthlyStatistics(entries);
  assert.deepEqual(stats.map((item) => item.month), ["2026-08", "2026-09"]);
  assert.equal(stats[1].costs, 104);
});

test("storage roundtrip and corrupt-data fallback", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const data = { version: 1, vehicles: [{ id: "a" }], refuels: entries };
  saveStoredData(data, storage);
  assert.equal(memory.has(STORAGE_KEY), true);
  assert.deepEqual(loadStoredData(storage), data);
  memory.set(STORAGE_KEY, "not-json");
  assert.deepEqual(loadStoredData(storage), { version: 1, vehicles: [], refuels: [] });
});
