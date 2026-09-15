import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3, CalendarDays, CarFront, ChevronRight, CircleDollarSign, Droplets, Fuel,
  Download, Gauge, History, LayoutDashboard, Menu, Pencil, Plus, ReceiptText, Save,
  Search, Settings2, Share2, Trash2, TrendingUp, X,
} from "lucide-react";
import {
  calculateSummary, createId, filterByMonth, formatCurrency, formatDate, formatMonth,
  formatNumber, loadStoredData, monthKey, monthlyStatistics, parseDecimal, saveStoredData, todayISO,
} from "./domain.js";
import "./styles.css";

const currentMonth = monthKey(todayISO());
const navItems = [
  ["dashboard", "Übersicht", LayoutDashboard],
  ["history", "Historie", History],
  ["billing", "Abrechnung", ReceiptText],
  ["statistics", "Statistik", BarChart3],
  ["vehicles", "Fahrzeuge", CarFront],
];

let pdfModulesPromise;
function loadPdfModules() {
  pdfModulesPromise ??= Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return pdfModulesPromise;
}

async function buildInvoicePdf({ month, selectedCar, entries, summary, vehicles }) {
  const [{ jsPDF }, { default: autoTable }] = await loadPdfModules();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const vehicleName = selectedCar?.name ?? "Alle Fahrzeuge";
  const fileVehicle = vehicleName.replace(/[^a-zA-Z0-9äöüÄÖÜß-]+/g, "-").replace(/^-|-$/g, "");
  const filename = `Fuelio-Abrechnung-${month}-${fileVehicle || "Fahrzeuge"}.pdf`;

  doc.setFillColor(13, 37, 32);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setTextColor(105, 231, 211);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("FUELIO", 16, 18);
  doc.setTextColor(235, 244, 241);
  doc.setFontSize(11);
  doc.text("MONATSABRECHNUNG", 16, 29);
  doc.setFontSize(18);
  doc.text(formatMonth(month), pageWidth - 16, 18, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(selectedCar ? `${selectedCar.name} · ${selectedCar.licensePlate} · ${selectedCar.type}` : "Alle Fahrzeuge", pageWidth - 16, 29, { align: "right" });

  const kpis = [
    ["GESAMTKOSTEN", formatCurrency(summary.costs)],
    ["GETANKTE LITER", `${formatNumber(summary.liters)} l`],
    ["Ø PREIS / LITER", `${formatNumber(summary.averagePrice, 3)} €`],
    ["TANKVORGÄNGE", String(summary.count)],
  ];
  const boxWidth = (pageWidth - 32 - 9) / 4;
  kpis.forEach(([label, value], index) => {
    const x = 16 + index * (boxWidth + 3);
    doc.setFillColor(240, 245, 243);
    doc.roundedRect(x, 49, boxWidth, 23, 2, 2, "F");
    doc.setTextColor(102, 116, 112);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label, x + 4, 57);
    doc.setTextColor(23, 32, 31);
    doc.setFontSize(12);
    doc.text(value, x + 4, 66);
  });

  const includeVehicle = !selectedCar;
  const head = [["Datum", ...(includeVehicle ? ["Fahrzeug"] : []), "Kilometerstand", "Liter", "Preis/Liter", "Gesamtbetrag"]];
  const body = entries.map((entry) => [
    formatDate(entry.date),
    ...(includeVehicle ? [vehicles.find((car) => car.id === entry.vehicleId)?.name ?? "–"] : []),
    `${formatNumber(entry.mileage, 0)} km`,
    `${formatNumber(entry.liters)} l`,
    `${formatNumber(entry.pricePerLiter, 3)} €`,
    formatCurrency(entry.totalPrice),
  ]);

  autoTable(doc, {
    startY: 80,
    head,
    body: body.length ? body : [["Keine Tankvorgänge in diesem Zeitraum.", ...Array(head[0].length - 1).fill("")]],
    foot: [["Gesamtsumme", ...Array(head[0].length - 2).fill(""), formatCurrency(summary.costs)]],
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, textColor: [35, 45, 43], lineColor: [222, 229, 226], lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: [225, 235, 232], textColor: [63, 83, 78], fontStyle: "bold" },
    footStyles: { fillColor: [240, 245, 243], textColor: [13, 37, 32], fontStyle: "bold" },
    columnStyles: { [head[0].length - 1]: { halign: "right", fontStyle: "bold" } },
    didDrawPage: () => {
      doc.setTextColor(130, 143, 139);
      doc.setFontSize(7);
      doc.text(`Erstellt mit Fuelio · ${new Intl.DateTimeFormat("de-DE").format(new Date())}`, 16, doc.internal.pageSize.getHeight() - 8);
      doc.text(`Seite ${doc.getNumberOfPages()}`, pageWidth - 16, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    },
  });

  return { doc, filename };
}

function App() {
  const [data, setData] = useState(loadStoredData);
  const [view, setView] = useState("dashboard");
  const [refuelModal, setRefuelModal] = useState(null);
  const [vehicleModal, setVehicleModal] = useState(null);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => saveStoredData(data), [data]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message) => setToast(message);
  const openAdd = () => {
    if (!data.vehicles.length) {
      setVehicleModal({});
      showToast("Lege zuerst ein Fahrzeug an.");
      return;
    }
    setRefuelModal({ date: todayISO(), vehicleId: data.vehicles[0].id });
  };

  const saveRefuel = (entry) => {
    setData((previous) => ({
      ...previous,
      refuels: entry.id
        ? previous.refuels.map((item) => item.id === entry.id ? entry : item)
        : [...previous.refuels, { ...entry, id: createId("fuel"), createdAt: new Date().toISOString() }],
    }));
    setRefuelModal(null);
    showToast(entry.id ? "Tankvorgang aktualisiert." : "Tankvorgang gespeichert.");
  };

  const deleteRefuel = (id) => {
    if (!window.confirm("Diesen Tankvorgang wirklich löschen?")) return;
    setData((previous) => ({ ...previous, refuels: previous.refuels.filter((item) => item.id !== id) }));
    showToast("Tankvorgang gelöscht.");
  };

  const saveVehicle = (vehicle) => {
    setData((previous) => ({
      ...previous,
      vehicles: vehicle.id
        ? previous.vehicles.map((item) => item.id === vehicle.id ? vehicle : item)
        : [...previous.vehicles, { ...vehicle, id: createId("car") }],
    }));
    setVehicleModal(null);
    showToast(vehicle.id ? "Fahrzeug aktualisiert." : "Fahrzeug angelegt.");
  };

  const deleteVehicle = (id) => {
    if (data.refuels.some((entry) => entry.vehicleId === id)) {
      showToast("Fahrzeug hat Tankvorgänge und kann nicht gelöscht werden.");
      return;
    }
    if (!window.confirm("Dieses Fahrzeug wirklich löschen?")) return;
    setData((previous) => ({ ...previous, vehicles: previous.vehicles.filter((item) => item.id !== id) }));
    showToast("Fahrzeug gelöscht.");
  };

  const navigate = (next) => { setView(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const activeLabel = navItems.find(([id]) => id === view)?.[1];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Fuel size={22} /></span><span>Fuelio</span></div>
        <nav className="side-nav" aria-label="Hauptnavigation">
          {navItems.map(([id, label, Icon]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}>
              <Icon size={20} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="storage-note"><span className="status-dot" />Lokal gespeichert<small>Nur auf diesem Gerät</small></div>
      </aside>
      {menuOpen && <button className="menu-scrim" aria-label="Menü schließen" onClick={() => setMenuOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Menü öffnen"><Menu /></button>
          <div><p className="eyebrow">Fuelio · Tankmanager</p><h1>{activeLabel}</h1></div>
          <button className="primary-action desktop-add" onClick={openAdd}><Plus size={20} />Tankvorgang</button>
        </header>

        {view === "dashboard" && <Dashboard data={data} onAdd={openAdd} onNavigate={navigate} />}
        {view === "history" && <HistoryView data={data} onEdit={setRefuelModal} onDelete={deleteRefuel} />}
        {view === "billing" && <BillingView data={data} />}
        {view === "statistics" && <StatisticsView data={data} />}
        {view === "vehicles" && <VehiclesView data={data} onAdd={() => setVehicleModal({})} onEdit={setVehicleModal} onDelete={deleteVehicle} />}
      </main>

      <button className="fab" onClick={openAdd} aria-label="Tankvorgang hinzufügen"><Plus size={27} /></button>
      <nav className="bottom-nav" aria-label="Mobile Navigation">
        {navItems.slice(0, 4).map(([id, label, Icon]) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={20} /><span>{label}</span></button>
        ))}
      </nav>

      {refuelModal && <RefuelModal initial={refuelModal} vehicles={data.vehicles} onSave={saveRefuel} onClose={() => setRefuelModal(null)} />}
      {vehicleModal && <VehicleModal initial={vehicleModal} onSave={saveVehicle} onClose={() => setVehicleModal(null)} />}
      {toast && <div className="toast" role="status"><span className="status-dot" />{toast}</div>}
    </div>
  );
}

function Dashboard({ data, onAdd, onNavigate }) {
  const monthEntries = useMemo(() => filterByMonth(data.refuels, currentMonth), [data.refuels]);
  const summary = calculateSummary(monthEntries);
  const last = [...data.refuels].sort((a, b) => b.date.localeCompare(a.date))[0];
  const vehicleName = (id) => data.vehicles.find((car) => car.id === id)?.name ?? "Unbekannt";

  return <section className="content-stack page-enter">
    <div className="hero-card">
      <div><span className="pill"><CalendarDays size={14} />{formatMonth(currentMonth)}</span><p>Tankkosten diesen Monat</p><strong>{formatCurrency(summary.costs)}</strong><span className="hero-subline">{summary.count ? `${summary.count} ${summary.count === 1 ? "Tankvorgang" : "Tankvorgänge"} erfasst` : "Noch keine Tankvorgänge erfasst"}</span></div>
      <button className="hero-add" onClick={onAdd}><Plus size={22} /><span>Tankvorgang hinzufügen</span></button>
    </div>

    <div className="metric-grid">
      <Metric icon={Droplets} label="Getankte Liter" value={`${formatNumber(summary.liters)} l`} tone="cyan" />
      <Metric icon={ReceiptText} label="Tankvorgänge" value={String(summary.count)} tone="violet" />
      <Metric icon={TrendingUp} label="Ø Preis / Liter" value={`${formatNumber(summary.averagePrice, 3)} €`} tone="green" />
      <Metric icon={CircleDollarSign} label="Gesamtkosten" value={formatCurrency(calculateSummary(data.refuels).costs)} tone="amber" />
    </div>

    <div className="split-grid">
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">Zuletzt erfasst</p><h2>Letzter Tankvorgang</h2></div><button className="text-button" onClick={() => onNavigate("history")}>Alle anzeigen <ChevronRight size={16} /></button></div>
        {last ? <div className="last-entry">
          <span className="entry-icon"><Fuel /></span>
          <div><strong>{vehicleName(last.vehicleId)}</strong><span>{formatDate(last.date)}{last.station ? ` · ${last.station}` : ""}</span></div>
          <div className="entry-numbers"><strong>{formatCurrency(last.totalPrice)}</strong><span>{formatNumber(last.liters)} l · {formatNumber(last.pricePerLiter, 3)} €/l</span></div>
        </div> : <EmptyState icon={Fuel} title="Bereit für den ersten Eintrag" text="Lege ein Fahrzeug an und erfasse deinen ersten Tankvorgang." action="Jetzt starten" onAction={onAdd} />}
      </section>
      <button className="report-cta" onClick={() => onNavigate("billing")}>
        <span className="report-icon"><ReceiptText /></span><span><small>Monatsabschluss</small><strong>Abrechnung erstellen</strong><em>Übersichtlich, druckfertig, professionell</em></span><ChevronRight />
      </button>
    </div>
  </section>;
}

function Metric({ icon: Icon, label, value, tone }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}><Icon /></span><div><p>{label}</p><strong>{value}</strong></div></article>;
}

function HistoryView({ data, onEdit, onDelete }) {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [vehicle, setVehicle] = useState("all");
  const years = [...new Set(data.refuels.map((entry) => entry.date.slice(0, 4)))].sort().reverse();
  const entries = [...data.refuels]
    .filter((entry) => (!month || entry.date.slice(5, 7) === month) && (!year || entry.date.startsWith(year)) && (vehicle === "all" || entry.vehicleId === vehicle))
    .sort((a, b) => b.date.localeCompare(a.date));
  const vehicleName = (id) => data.vehicles.find((car) => car.id === id)?.name ?? "Gelöschtes Fahrzeug";

  return <section className="content-stack page-enter">
    <div className="filter-bar">
      <span className="filter-title"><Settings2 size={18} /> Filter</span>
      <label><span>Monat</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Alle</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{new Intl.DateTimeFormat("de-DE", { month: "long" }).format(new Date(2024, i, 1))}</option>)}</select></label>
      <label><span>Jahr</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Alle</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Fahrzeug</span><select value={vehicle} onChange={(event) => setVehicle(event.target.value)}><option value="all">Alle Fahrzeuge</option>{data.vehicles.map((car) => <option key={car.id} value={car.id}>{car.name}</option>)}</select></label>
      {(month || year || vehicle !== "all") && <button className="text-button" onClick={() => { setMonth(""); setYear(""); setVehicle("all"); }}>Zurücksetzen</button>}
    </div>
    <div className="panel">
      <div className="panel-heading"><div><p className="eyebrow">{entries.length} Einträge</p><h2>Tankhistorie</h2></div><span className="panel-total">{formatCurrency(calculateSummary(entries).costs)}</span></div>
      {entries.length ? <div className="history-list">{entries.map((entry) => <article className="history-row" key={entry.id}>
        <div className="date-badge"><strong>{entry.date.slice(8, 10)}</strong><span>{new Intl.DateTimeFormat("de-DE", { month: "short" }).format(new Date(`${entry.date}T12:00:00`))}</span></div>
        <div className="history-main"><strong>{vehicleName(entry.vehicleId)}</strong><span>{entry.station || "Tankstelle nicht angegeben"} · {formatNumber(entry.mileage, 0)} km</span></div>
        <div className="history-volume"><strong>{formatNumber(entry.liters)} l</strong><span>{formatNumber(entry.pricePerLiter, 3)} €/l</span></div>
        <strong className="history-price">{formatCurrency(entry.totalPrice)}</strong>
        <div className="row-actions"><button className="icon-button" onClick={() => onEdit(entry)} aria-label="Tankvorgang bearbeiten"><Pencil size={17} /></button><button className="icon-button danger" onClick={() => onDelete(entry.id)} aria-label="Tankvorgang löschen"><Trash2 size={17} /></button></div>
      </article>)}</div> : <EmptyState icon={Search} title="Keine Einträge gefunden" text="Für die gewählten Filter sind keine Tankvorgänge vorhanden." />}
    </div>
  </section>;
}

function BillingView({ data }) {
  const [month, setMonth] = useState(currentMonth);
  const [vehicle, setVehicle] = useState(data.vehicles[0]?.id ?? "all");
  const [created, setCreated] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const entries = filterByMonth(data.refuels, month, vehicle);
  const summary = calculateSummary(entries);
  const selectedCar = data.vehicles.find((car) => car.id === vehicle);
  useEffect(() => { loadPdfModules(); }, []);
  const createPdf = () => buildInvoicePdf({ month, selectedCar, entries, summary, vehicles: data.vehicles });
  const downloadPdf = async () => {
    setPdfStatus("PDF wird erstellt …");
    const { doc, filename } = await createPdf();
    doc.save(filename);
    setPdfStatus("PDF wurde erstellt.");
  };
  const sharePdf = async () => {
    setPdfStatus("PDF wird für das Teilen vorbereitet …");
    const { doc, filename } = await createPdf();
    const file = new File([doc.output("blob")], filename, { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: `Fuelio Monatsabrechnung ${formatMonth(month)}`, text: `Tankabrechnung für ${selectedCar?.name ?? "alle Fahrzeuge"}`, files: [file] });
        setPdfStatus("Abrechnung wurde geteilt.");
      } catch (error) {
        if (error?.name !== "AbortError") setPdfStatus("Teilen war nicht möglich. Bitte erneut versuchen.");
      }
      return;
    }
    doc.save(filename);
    setPdfStatus("Direktes Teilen wird hier nicht unterstützt. Die PDF wurde heruntergeladen und kann anschließend geteilt werden.");
  };

  return <section className="content-stack page-enter">
    <div className="billing-controls no-print">
      <div><p className="eyebrow">Druckfertiger Monatsabschluss</p><h2>Abrechnung konfigurieren</h2></div>
      <label><span>Abrechnungsmonat</span><input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setCreated(false); }} /></label>
      <label><span>Fahrzeug</span><select value={vehicle} onChange={(event) => { setVehicle(event.target.value); setCreated(false); }}><option value="all">Alle Fahrzeuge</option>{data.vehicles.map((car) => <option key={car.id} value={car.id}>{car.name} · {car.licensePlate}</option>)}</select></label>
      <button className="primary-action" onClick={() => setCreated(true)}><ReceiptText size={19} />Monatsabrechnung erstellen</button>
    </div>

    {!created ? <div className="panel preview-placeholder"><span className="document-shape"><ReceiptText /></span><h2>Deine Abrechnung ist einen Klick entfernt</h2><p>Wähle Monat und Fahrzeug aus. Anschließend kannst du eine echte PDF erstellen, speichern oder direkt über dein Smartphone teilen.</p></div>
    : <article className="print-sheet">
      <div className="report-header"><div><span className="brand report-brand"><span className="brand-mark"><Fuel size={19} /></span>Fuelio</span><p>Monatsabrechnung</p></div><div className="report-actions no-print"><button className="secondary-action" onClick={downloadPdf}><Download size={18} />PDF speichern</button><button className="share-action" onClick={sharePdf}><Share2 size={18} />Abrechnung teilen</button></div></div>
      {pdfStatus && <p className="action-note no-print" role="status">{pdfStatus}</p>}
      <div className="report-title"><div><p>Abrechnungszeitraum</p><h2>{formatMonth(month)}</h2></div><div><p>Fahrzeug</p><h3>{selectedCar?.name ?? "Alle Fahrzeuge"}</h3><span>{selectedCar ? `${selectedCar.licensePlate} · ${selectedCar.type}` : `${data.vehicles.length} Fahrzeuge`}</span></div></div>
      <div className="report-kpis"><div><span>Gesamtkosten</span><strong>{formatCurrency(summary.costs)}</strong></div><div><span>Getankte Liter</span><strong>{formatNumber(summary.liters)} l</strong></div><div><span>Ø Preis / Liter</span><strong>{formatNumber(summary.averagePrice, 3)} €</strong></div><div><span>Tankvorgänge</span><strong>{summary.count}</strong></div></div>
      <div className="table-wrap"><table><thead><tr><th>Datum</th>{vehicle === "all" && <th>Fahrzeug</th>}<th>km-Stand</th><th>Liter</th><th>Preis/Liter</th><th>Gesamt</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td>{formatDate(entry.date)}</td>{vehicle === "all" && <td>{data.vehicles.find((car) => car.id === entry.vehicleId)?.name ?? "–"}</td>}<td>{formatNumber(entry.mileage, 0)} km</td><td>{formatNumber(entry.liters)} l</td><td>{formatNumber(entry.pricePerLiter, 3)} €</td><td><strong>{formatCurrency(entry.totalPrice)}</strong></td></tr>)}{!entries.length && <tr><td colSpan={vehicle === "all" ? 6 : 5} className="empty-cell">Keine Tankvorgänge in diesem Zeitraum.</td></tr>}</tbody><tfoot><tr><td colSpan={vehicle === "all" ? 5 : 4}>Gesamtsumme</td><td>{formatCurrency(summary.costs)}</td></tr></tfoot></table></div>
      <footer className="report-footer"><span>Erstellt mit Fuelio</span><span>{new Intl.DateTimeFormat("de-DE").format(new Date())}</span></footer>
    </article>}
  </section>;
}

function StatisticsView({ data }) {
  const stats = monthlyStatistics(data.refuels).slice(-12);
  const totals = calculateSummary(data.refuels);
  const maxCosts = Math.max(1, ...stats.map((item) => item.costs));
  const maxLiters = Math.max(1, ...stats.map((item) => item.liters));
  const maxPrice = Math.max(1, ...stats.map((item) => item.averagePrice));
  return <section className="content-stack page-enter">
    <div className="stats-summary"><div><p className="eyebrow">Seit Beginn</p><h2>{formatCurrency(totals.costs)}</h2><span>Gesamtkosten aus {totals.count} {totals.count === 1 ? "Tankvorgang" : "Tankvorgängen"}</span></div><span className="stats-orb"><TrendingUp /></span></div>
    {stats.length ? <div className="chart-grid">
      <BarPanel title="Kosten pro Monat" subtitle="Monatliche Ausgaben" data={stats} max={maxCosts} value={(item) => item.costs} format={formatCurrency} tone="cyan" />
      <BarPanel title="Liter pro Monat" subtitle="Getankte Menge" data={stats} max={maxLiters} value={(item) => item.liters} format={(value) => `${formatNumber(value)} l`} tone="violet" />
      <BarPanel title="Kraftstoffpreis" subtitle="Gewichteter Durchschnitt" data={stats} max={maxPrice} value={(item) => item.averagePrice} format={(value) => `${formatNumber(value, 3)} €`} tone="green" />
    </div> : <div className="panel"><EmptyState icon={BarChart3} title="Noch keine Statistiken" text="Sobald du Tankvorgänge erfasst, siehst du hier deine monatliche Entwicklung." /></div>}
  </section>;
}

function BarPanel({ title, subtitle, data, max, value, format, tone }) {
  return <article className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">{subtitle}</p><h2>{title}</h2></div></div><div className="bars">{data.map((item) => <div className="bar-column" key={item.month}><span className="bar-value">{format(value(item))}</span><div className="bar-track"><i className={tone} style={{ height: `${Math.max(5, value(item) / max * 100)}%` }} /></div><span>{new Intl.DateTimeFormat("de-DE", { month: "short" }).format(new Date(`${item.month}-01T12:00:00`))}</span></div>)}</div></article>;
}

function VehiclesView({ data, onAdd, onEdit, onDelete }) {
  return <section className="content-stack page-enter"><div className="section-intro"><div><p className="eyebrow">Deine Garage</p><h2>Fahrzeuge verwalten</h2><span>Lege alle Fahrzeuge an, für die du Tankvorgänge erfassen möchtest.</span></div><button className="primary-action" onClick={onAdd}><Plus size={19} />Fahrzeug anlegen</button></div>
    {data.vehicles.length ? <div className="vehicle-grid">{data.vehicles.map((car) => { const entries = data.refuels.filter((item) => item.vehicleId === car.id); const total = calculateSummary(entries); return <article className="vehicle-card" key={car.id}><div className="vehicle-top"><span className="vehicle-icon"><CarFront /></span><div className="row-actions"><button className="icon-button" onClick={() => onEdit(car)} aria-label="Fahrzeug bearbeiten"><Pencil size={17} /></button><button className="icon-button danger" onClick={() => onDelete(car.id)} aria-label="Fahrzeug löschen"><Trash2 size={17} /></button></div></div><h3>{car.name}</h3><span className="license-plate">{car.licensePlate}</span><p>{car.type}</p><div className="vehicle-stats"><span><strong>{entries.length}</strong> Tankvorgänge</span><span><strong>{formatCurrency(total.costs)}</strong> Gesamtkosten</span></div></article>; })}</div>
    : <div className="panel"><EmptyState icon={CarFront} title="Noch kein Fahrzeug angelegt" text="Erstelle dein erstes Fahrzeug, um Tankvorgänge zuzuordnen." action="Fahrzeug anlegen" onAction={onAdd} /></div>}
  </section>;
}

function RefuelModal({ initial, vehicles, onSave, onClose }) {
  const [form, setForm] = useState({ date: todayISO(), vehicleId: vehicles[0]?.id ?? "", mileage: "", liters: "", pricePerLiter: "", totalPrice: "", station: "", note: "", ...initial });
  const [errors, setErrors] = useState({});
  const update = (field, value) => {
    setForm((previous) => {
      const next = { ...previous, [field]: value };
      const liters = parseDecimal(next.liters);
      if (field === "liters") {
        if (parseDecimal(next.pricePerLiter)) next.totalPrice = (liters * parseDecimal(next.pricePerLiter)).toFixed(2);
        else if (liters && parseDecimal(next.totalPrice)) next.pricePerLiter = (parseDecimal(next.totalPrice) / liters).toFixed(3);
      }
      if (field === "pricePerLiter" && liters) next.totalPrice = (liters * parseDecimal(value)).toFixed(2);
      if (field === "totalPrice" && liters) next.pricePerLiter = (parseDecimal(value) / liters).toFixed(3);
      return next;
    });
    setErrors((previous) => ({ ...previous, [field]: "" }));
  };
  const submit = (event) => {
    event.preventDefault();
    const required = ["date", "vehicleId", "mileage", "liters", "pricePerLiter", "totalPrice"];
    const nextErrors = Object.fromEntries(required.filter((field) => !String(form[field] ?? "").trim() || (field !== "date" && field !== "vehicleId" && parseDecimal(form[field]) <= 0)).map((field) => [field, "Bitte gültig ausfüllen."]));
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    onSave({ ...form, mileage: parseDecimal(form.mileage), liters: parseDecimal(form.liters), pricePerLiter: parseDecimal(form.pricePerLiter), totalPrice: parseDecimal(form.totalPrice), station: form.station.trim(), note: form.note.trim() });
  };
  return <Modal title={form.id ? "Tankvorgang bearbeiten" : "Tankvorgang hinzufügen"} subtitle="Alle Pflichtfelder sind mit * markiert." onClose={onClose}><form onSubmit={submit} className="form-grid">
    <Field label="Datum *" error={errors.date}><input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} /></Field>
    <Field label="Fahrzeug *" error={errors.vehicleId}><select value={form.vehicleId} onChange={(e) => update("vehicleId", e.target.value)}>{vehicles.map((car) => <option value={car.id} key={car.id}>{car.name} · {car.licensePlate}</option>)}</select></Field>
    <Field label="Kilometerstand *" error={errors.mileage} suffix="km"><input inputMode="numeric" value={form.mileage} onChange={(e) => update("mileage", e.target.value)} placeholder="48.250" /></Field>
    <Field label="Getankte Liter *" error={errors.liters} suffix="l"><input inputMode="decimal" value={form.liters} onChange={(e) => update("liters", e.target.value)} placeholder="42,50" /></Field>
    <Field label="Preis pro Liter *" error={errors.pricePerLiter} suffix="€/l"><input inputMode="decimal" value={form.pricePerLiter} onChange={(e) => update("pricePerLiter", e.target.value)} placeholder="1,729" /></Field>
    <Field label="Gesamtpreis *" error={errors.totalPrice} suffix="€"><input inputMode="decimal" value={form.totalPrice} onChange={(e) => update("totalPrice", e.target.value)} placeholder="73,48" /></Field>
    <Field label="Tankstelle" wide><input value={form.station} onChange={(e) => update("station", e.target.value)} placeholder="z. B. Aral Berlin-Mitte" /></Field>
    <Field label="Notiz" wide><textarea rows="3" value={form.note} onChange={(e) => update("note", e.target.value)} placeholder="Optionaler Hinweis zum Tankvorgang" /></Field>
    <div className="form-hint wide"><Gauge size={17} /><span>Liter, Preis pro Liter und Gesamtpreis werden automatisch miteinander verrechnet.</span></div>
    <div className="modal-actions wide"><button type="button" className="secondary-action" onClick={onClose}>Abbrechen</button><button className="primary-action" type="submit"><Save size={18} />Tankvorgang speichern</button></div>
  </form></Modal>;
}

function VehicleModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ name: "", licensePlate: "", type: "PKW", ...initial });
  const [errors, setErrors] = useState({});
  const submit = (event) => { event.preventDefault(); const next = {}; if (!form.name.trim()) next.name = "Bitte Namen angeben."; if (!form.licensePlate.trim()) next.licensePlate = "Bitte Kennzeichen angeben."; if (!form.type.trim()) next.type = "Bitte Fahrzeugtyp angeben."; if (Object.keys(next).length) return setErrors(next); onSave({ ...form, name: form.name.trim(), licensePlate: form.licensePlate.trim().toUpperCase(), type: form.type.trim() }); };
  return <Modal title={form.id ? "Fahrzeug bearbeiten" : "Fahrzeug anlegen"} subtitle="Damit ordnest du Tankvorgänge eindeutig zu." onClose={onClose}><form onSubmit={submit} className="form-grid">
    <Field label="Name *" error={errors.name} wide><input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z. B. Golf GTI" /></Field>
    <Field label="Kennzeichen *" error={errors.licensePlate}><input value={form.licensePlate} onChange={(e) => setForm({ ...form, licensePlate: e.target.value })} placeholder="B · AB 1234" /></Field>
    <Field label="Fahrzeugtyp *" error={errors.type}><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>PKW</option><option>Motorrad</option><option>Transporter</option><option>Wohnmobil</option><option>Sonstiges</option></select></Field>
    <div className="modal-actions wide"><button type="button" className="secondary-action" onClick={onClose}>Abbrechen</button><button className="primary-action" type="submit"><Save size={18} />Fahrzeug speichern</button></div>
  </form></Modal>;
}

function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => { const handler = (event) => event.key === "Escape" && onClose(); document.body.classList.add("modal-open"); window.addEventListener("keydown", handler); return () => { document.body.classList.remove("modal-open"); window.removeEventListener("keydown", handler); }; }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><p className="eyebrow">Neuer Eintrag</p><h2 id="modal-title">{title}</h2><span>{subtitle}</span></div><button className="icon-button" onClick={onClose} aria-label="Dialog schließen"><X /></button></div>{children}</section></div>;
}

function Field({ label, error, suffix, wide, children }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span><div className={suffix ? "input-suffix" : ""}>{children}{suffix && <b>{suffix}</b>}</div>{error && <small className="error">{error}</small>}</label>;
}

function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return <div className="empty-state"><span><Icon /></span><h3>{title}</h3><p>{text}</p>{action && <button className="secondary-action" onClick={onAction}>{action}</button>}</div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
