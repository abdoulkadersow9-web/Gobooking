/**
 * Chef d'Agence Dashboard — Maquette haute-fidélité
 * Design professionnel avec hiérarchie visuelle claire
 */
import React, { useState, useEffect, useRef } from "react";

const C = {
  indigo:   "#4F46E5",
  indigo2:  "#3730A3",
  indigoBg: "#EEF2FF",
  red:      "#DC2626",
  redBg:    "#FEE2E2",
  redMid:   "#FCA5A5",
  amber:    "#D97706",
  amberBg:  "#FEF3C7",
  amberMid: "#FCD34D",
  green:    "#059669",
  greenBg:  "#D1FAE5",
  blue:     "#1D4ED8",
  blueBg:   "#EFF6FF",
  purple:   "#7C3AED",
  purpleBg: "#F5F3FF",
  gray:     "#6B7280",
  grayBg:   "#F3F4F6",
  text:     "#111827",
  textSub:  "#6B7280",
  border:   "#E5E7EB",
  white:    "#FFFFFF",
  bg:       "#F4F6FB",
};

// ── Icônes SVG intégrées ─────────────────────────────────────────────────────
const Icon = {
  alert:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:16,height:16}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  nav:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:16,height:16}}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>,
  users:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:16,height:16}}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  user:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:16,height:16}}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  truck:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:16,height:16}}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  dollar:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:18,height:18}}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  package:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:18,height:18}}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  zap:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:18,height:18}}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  check:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:13,height:13}}><polyline points="20 6 9 17 4 12"/></svg>,
  clock:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:13,height:13}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  calendar: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:13,height:13}}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  printer:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:11,height:11}}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  trend:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:12,height:12}}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  bar:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:14,height:14}}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  chevron:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:14,height:14}}><polyline points="9 18 15 12 9 6"/></svg>,
  plus:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:14,height:14}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  map:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:11,height:11}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
};

// ── Données de démo ───────────────────────────────────────────────────────────
const MOCK = {
  agence: { name: "Agence Plateau", city: "Abidjan" },
  stats: { tripsToday: 6, agents: 8, passengers: 142, buses: 3 },
  alerts: 2,
  revenue: { billets: 680000, colis: 124000, bagages: 47000, net: 781000 },
  caisses: 3,
  colisAValider: 5,
  active: [
    { id: "1", from: "Abidjan", to: "Bouaké", time: "07:30", bus: "GB-034", pax: 42, seats: 49, status: "boarding" },
    { id: "2", from: "Abidjan", to: "Yamoussoukro", time: "08:00", bus: "GB-018", pax: 34, seats: 38, status: "en_route" },
  ],
  scheduled: [
    { id: "3", from: "Abidjan", to: "San Pedro", time: "10:00", bus: "GB-021", pax: 18, seats: 45 },
    { id: "4", from: "Abidjan", to: "Korhogo", time: "11:30", bus: "GB-009", pax: 31, seats: 49 },
    { id: "5", from: "Abidjan", to: "Daloa", time: "14:00", bus: "GB-055", pax: 12, seats: 38 },
  ],
  done: [
    { id: "6", from: "Abidjan", to: "Bouaké", time: "05:30", pax: 49 },
  ],
  noFuelBordereaux: [
    { id: "b1", from: "Abidjan", to: "Bouaké", date: "31/03", time: "05:30", bus: "GB-041", total: 245000 },
    { id: "b2", from: "Abidjan", to: "Daloa",  date: "31/03", time: "06:00", bus: "GB-033", total: 189000 },
  ],
  bordereaux: [
    { id: "b3", from: "Abidjan", to: "Korhogo",      date: "31/03", time: "07:00", bus: "GB-012", pax: 44, billets: 352000, bagages: 18000, colis: 24000, fuel: 65000, hasFuel: true  },
    { id: "b4", from: "Abidjan", to: "Yamoussoukro", date: "31/03", time: "08:30", bus: "GB-018", pax: 38, billets: 228000, bagages: 12000, colis: 31000, fuel: 42000, hasFuel: true  },
    { id: "b1", from: "Abidjan", to: "Bouaké",       date: "31/03", time: "05:30", bus: "GB-041", pax: 49, billets: 196000, bagages: 28000, colis: 21000, fuel:      0, hasFuel: false },
    { id: "b2", from: "Abidjan", to: "Daloa",        date: "31/03", time: "06:00", bus: "GB-033", pax: 36, billets: 144000, bagages: 22000, colis: 23000, fuel:      0, hasFuel: false },
  ],
};

// ── Composants ───────────────────────────────────────────────────────────────
function SecHead({ title, accent, count, action }: { title: string; accent: string; count?: number; action?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
      <div style={{ width:3, height:18, borderRadius:2, background:accent, flexShrink:0 }} />
      <span style={{ fontSize:13, fontWeight:800, color:C.text, flex:1, letterSpacing:-0.2 }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize:10, fontWeight:700, color:accent, background:`${accent}18`, borderRadius:20, padding:"2px 8px" }}>{count}</span>
      )}
      {action && (
        <span style={{ fontSize:11, fontWeight:700, color:C.indigo, cursor:"pointer" }}>{action} →</span>
      )}
    </div>
  );
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize:9, fontWeight:700, color, background:bg, borderRadius:20, padding:"2px 7px", whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ChefDashboard() {
  const [fuelOpen, setFuelOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n/1000)}k` : String(n);

  return (
    <div style={{ background: C.bg, minHeight:"100vh", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", display:"flex", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:420, position:"relative" }}>

        {/* ═══════════════════════════════════════════
            HEADER — Gradient indigo
        ═══════════════════════════════════════════ */}
        <div style={{
          background:`linear-gradient(135deg, ${C.indigo2} 0%, ${C.indigo} 60%, #6366F1 100%)`,
          padding:"18px 18px 22px",
        }}>
          {/* Ligne top */}
          <div style={{ display:"flex", alignItems:"flex-start", marginBottom:14 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:20, fontWeight:900, color:"#fff", lineHeight:1.2 }}>Bonjour, Kouamé 👋</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:5 }}>
                <span style={{ color:"#A5B4FC" }}><Icon.map /></span>
                <span style={{ fontSize:12, color:"#A5B4FC" }}>{MOCK.agence.name} — {MOCK.agence.city}</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:7 }}>
              <div style={{ padding:"8px", background:"rgba(255,255,255,0.15)", borderRadius:10, cursor:"pointer" }}>
                <Icon.bar />
              </div>
            </div>
          </div>

          {/* KPIs — 4 tuiles en ligne */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
            {[
              { icon:<Icon.nav/>,   val:MOCK.stats.tripsToday,   label:"Départs",  color:C.indigo,  bg:"rgba(238,242,255,0.9)" },
              { icon:<Icon.users/>, val:MOCK.stats.agents,        label:"Agents",   color:C.green,   bg:"rgba(209,250,229,0.9)" },
              { icon:<Icon.user/>,  val:MOCK.stats.passengers,    label:"Passagers",color:C.amber,   bg:"rgba(254,243,199,0.9)" },
              { icon:<Icon.truck/>, val:MOCK.stats.buses,         label:"Cars dispo",color:C.blue,   bg:"rgba(239,246,255,0.9)" },
            ].map((k,i) => (
              <div key={i} style={{ background:k.bg, borderRadius:12, padding:"10px 8px", textAlign:"center", backdropFilter:"blur(4px)" }}>
                <div style={{ color:k.color, marginBottom:3, display:"flex", justifyContent:"center" }}>{k.icon}</div>
                <div style={{ fontSize:22, fontWeight:900, color:k.color, lineHeight:1 }}>{k.val}</div>
                <div style={{ fontSize:8, color:"#6B7280", fontWeight:600, marginTop:2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Revenus du jour — bande synthétique */}
          <div style={{
            background:"rgba(255,255,255,0.12)", borderRadius:12,
            padding:"10px 14px", backdropFilter:"blur(4px)",
            display:"flex", alignItems:"center", gap:0,
          }}>
            {[
              { l:"Billets", v:MOCK.revenue.billets, c:"#93C5FD" },
              { l:"Colis",   v:MOCK.revenue.colis,   c:"#C4B5FD" },
              { l:"Bagages", v:MOCK.revenue.bagages,  c:"#6EE7B7" },
            ].map((r,i) => (
              <React.Fragment key={i}>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:8, color:"rgba(255,255,255,0.6)", fontWeight:700, marginBottom:2, textTransform:"uppercase", letterSpacing:0.5 }}>{r.l}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:r.c }}>{fmt(r.v)}</div>
                </div>
                <div style={{ width:1, height:28, background:"rgba(255,255,255,0.2)" }} />
              </React.Fragment>
            ))}
            <div style={{ flex:1.3, textAlign:"center" }}>
              <div style={{ fontSize:8, color:"rgba(255,255,255,0.6)", fontWeight:700, marginBottom:2, textTransform:"uppercase", letterSpacing:0.5 }}>NET DU JOUR</div>
              <div style={{ fontSize:15, fontWeight:900, color:"#4ADE80" }}>+{fmt(MOCK.revenue.net)}</div>
            </div>
            {/* Live badge */}
            <div style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(0,0,0,0.2)", borderRadius:20, padding:"4px 10px", marginLeft:8 }}>
              <div style={{ width:6, height:6, borderRadius:3, background:"#4ADE80", animation:"pulse 2s infinite" }} />
              <span style={{ fontSize:10, color:"#A5B4FC", fontWeight:600 }}>{timeStr}</span>
            </div>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div ref={scrollRef} style={{ padding:"0 0 100px" }}>

          {/* ═══════════════════════════════════════════
              1. ALERTE CRITIQUE (si active)
          ═══════════════════════════════════════════ */}
          <div style={{
            display:"flex", alignItems:"center", gap:12,
            background:C.redBg, borderBottom:`2px solid ${C.redMid}`,
            padding:"12px 16px", cursor:"pointer",
          }}>
            <div style={{ width:38, height:38, borderRadius:10, background:"#FECACA", display:"flex", alignItems:"center", justifyContent:"center", color:C.red, flexShrink:0 }}>
              <Icon.alert />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#991B1B" }}>
                {MOCK.alerts} alertes actives — intervention requise
              </div>
              <div style={{ fontSize:11, color:C.red, marginTop:1 }}>
                Appuyer pour accéder au centre de suivi
              </div>
            </div>
            <div style={{ color:C.red }}><Icon.chevron /></div>
          </div>

          {/* ═══════════════════════════════════════════
              2. ACTIONS URGENTES
          ═══════════════════════════════════════════ */}
          <div style={{ padding:"20px 14px 0" }}>
            <SecHead title="Actions urgentes" accent={C.red} />

            {/* Caisses à valider */}
            <div style={{
              background:C.white, borderRadius:14, padding:14,
              display:"flex", alignItems:"center", gap:12,
              border:`1.5px solid ${C.amberBg}`, marginBottom:8, cursor:"pointer",
            }}>
              <div style={{ width:42, height:42, borderRadius:13, background:C.amberBg, display:"flex", alignItems:"center", justifyContent:"center", color:C.amber, flexShrink:0 }}>
                <Icon.dollar />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{MOCK.caisses} caisses en attente de validation</div>
                <div style={{ fontSize:11, color:C.textSub, marginTop:2 }}>Valider ou rejeter les soumissions des agents</div>
              </div>
              <div style={{ background:C.amber, borderRadius:12, minWidth:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 8px" }}>
                <span style={{ color:"#fff", fontWeight:900, fontSize:15 }}>{MOCK.caisses}</span>
              </div>
              <div style={{ color:C.textSub }}><Icon.chevron /></div>
            </div>

            {/* Colis à valider */}
            <div style={{
              background:C.white, borderRadius:14, padding:14,
              display:"flex", alignItems:"center", gap:12,
              border:`1.5px solid ${C.purpleBg}`, marginBottom:8, cursor:"pointer",
            }}>
              <div style={{ width:42, height:42, borderRadius:13, background:C.purpleBg, display:"flex", alignItems:"center", justifyContent:"center", color:C.purple, flexShrink:0 }}>
                <Icon.package />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{MOCK.colisAValider} colis à valider</div>
                <div style={{ fontSize:11, color:C.textSub, marginTop:2 }}>En gare : 5 · En transit : 12 · Arrivés : 3</div>
              </div>
              <div style={{ background:C.purple, borderRadius:12, minWidth:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 8px" }}>
                <span style={{ color:"#fff", fontWeight:900, fontSize:15 }}>{MOCK.colisAValider}</span>
              </div>
              <div style={{ color:C.textSub }}><Icon.chevron /></div>
            </div>

            {/* Bordereaux sans carburant */}
            <div style={{ background:C.white, borderRadius:14, border:`1.5px solid ${C.amberBg}`, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px 10px" }}>
                <div style={{ width:42, height:42, borderRadius:13, background:"#FFFBEB", display:"flex", alignItems:"center", justifyContent:"center", color:C.amber, flexShrink:0 }}>
                  <Icon.zap />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{MOCK.noFuelBordereaux.length} bordereaux sans carburant</div>
                  <div style={{ fontSize:11, color:C.textSub, marginTop:2 }}>Résultat net non calculable — action requise</div>
                </div>
              </div>
              {MOCK.noFuelBordereaux.map((b, i) => (
                <div key={b.id} style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"10px 14px", borderTop:`1px solid ${C.amberMid}`,
                  background: i % 2 === 0 ? "#FFFBEB" : "#FFF",
                }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{b.from} → {b.to}</div>
                    <div style={{ fontSize:10, color:C.textSub, marginTop:1 }}>{b.date} · {b.time} · {b.bus}</div>
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{fmt(b.total)} FCFA</div>
                  <button
                    onClick={() => setFuelOpen(fuelOpen === b.id ? null : b.id)}
                    style={{
                      display:"flex", alignItems:"center", gap:4,
                      background:C.amber, border:"none", borderRadius:9,
                      padding:"6px 10px", cursor:"pointer",
                    }}
                  >
                    <span style={{ color:"#fff" }}><Icon.plus /></span>
                    <span style={{ fontSize:10, fontWeight:700, color:"#fff" }}>Carburant</span>
                  </button>
                </div>
              ))}
              {/* Mini modal carburant inline */}
              {fuelOpen && (
                <div style={{ borderTop:`1px solid ${C.amberMid}`, padding:14, background:"#FFFBEB" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.amber, marginBottom:8 }}>⛽ Ajouter le coût carburant</div>
                  <input
                    placeholder="Montant en FCFA (ex: 45 000)"
                    style={{ width:"100%", border:`1.5px solid ${C.amberMid}`, borderRadius:9, padding:"10px 12px", fontSize:13, fontWeight:600, color:C.text, outline:"none", boxSizing:"border-box" as any, background:"#fff" }}
                  />
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button onClick={() => setFuelOpen(null)} style={{ flex:1, padding:"9px", border:`1.5px solid ${C.border}`, borderRadius:9, background:C.white, fontSize:12, fontWeight:600, cursor:"pointer" }}>Annuler</button>
                    <button style={{ flex:2, padding:"9px", border:"none", borderRadius:9, background:C.amber, color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer" }}>Valider</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              3. OPÉRATIONS — Départs actifs
          ═══════════════════════════════════════════ */}
          <div style={{ padding:"20px 14px 0" }}>
            <SecHead title="Opérations du jour" accent={C.indigo} action="Gérer" />

            {/* Actifs */}
            {MOCK.active.map(t => {
              const isBoarding = t.status === "boarding";
              const pct = (t.pax / t.seats) * 100;
              return (
                <div key={t.id} style={{
                  background:C.white, borderRadius:14, padding:13, marginBottom:8,
                  border:`2px solid ${isBoarding ? "#DDD6FE" : "#A7F3D0"}`,
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:11, background:isBoarding ? C.purpleBg : C.greenBg, display:"flex", alignItems:"center", justifyContent:"center", color:isBoarding ? C.purple : C.green, flexShrink:0 }}>
                      {isBoarding ? <Icon.check /> : <Icon.nav />}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{t.from} → {t.to}</div>
                      <div style={{ fontSize:10, fontWeight:700, color:isBoarding ? C.purple : C.green, marginTop:2 }}>
                        {isBoarding ? "EMBARQUEMENT" : "EN ROUTE"} · {t.time}
                      </div>
                    </div>
                    <div style={{ fontSize:18, fontWeight:900, color:C.text }}>
                      {t.pax}<span style={{ fontSize:12, color:C.textSub, fontWeight:400 }}>/{t.seats}</span>
                    </div>
                  </div>
                  {/* Barre de remplissage */}
                  <div style={{ height:4, background:C.grayBg, borderRadius:2, marginTop:9, overflow:"hidden" }}>
                    <div style={{ height:4, width:`${Math.min(100,pct)}%`, background:pct>=90 ? C.red : isBoarding ? C.purple : C.green, borderRadius:2, transition:"width 0.5s" }} />
                  </div>
                  <div style={{ fontSize:9, color:C.textSub, marginTop:3 }}>{t.bus} · {Math.round(pct)}% occupé</div>
                </div>
              );
            })}

            {/* Programmés */}
            <div style={{ fontSize:9, fontWeight:800, color:"#9CA3AF", letterSpacing:1.2, marginBottom:6, marginTop:4 }}>EN ATTENTE · {MOCK.scheduled.length}</div>
            {MOCK.scheduled.map(t => (
              <div key={t.id} style={{
                display:"flex", alignItems:"center", gap:10,
                background:C.white, borderRadius:12, padding:"10px 13px", marginBottom:5,
                border:`1px solid ${C.border}`,
              }}>
                <div style={{ color:C.amber }}><Icon.clock /></div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{t.from} → {t.to}</div>
                  <div style={{ fontSize:10, color:C.textSub, marginTop:1 }}>{t.time} · {t.bus}</div>
                </div>
                <div style={{ fontSize:11, color:C.textSub, fontWeight:600 }}>{t.pax}/{t.seats} pax</div>
              </div>
            ))}

            {/* Terminés */}
            <div style={{ fontSize:9, fontWeight:800, color:"#9CA3AF", letterSpacing:1.2, marginBottom:6, marginTop:12 }}>TERMINÉS · {MOCK.done.length}</div>
            {MOCK.done.map(t => (
              <div key={t.id} style={{
                display:"flex", alignItems:"center", gap:10, opacity:0.6,
                background:C.white, borderRadius:12, padding:"10px 13px", marginBottom:5,
                border:`1px solid ${C.border}`,
              }}>
                <div style={{ color:C.gray }}><Icon.check /></div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.gray }}>{t.from} → {t.to}</div>
                  <div style={{ fontSize:10, color:C.textSub, marginTop:1 }}>{t.time} · {t.pax} pax</div>
                </div>
                <Pill label="Terminé" color={C.gray} bg={C.grayBg} />
              </div>
            ))}
          </div>

          {/* ═══════════════════════════════════════════
              4. BORDEREAUX — Table compacte
          ═══════════════════════════════════════════ */}
          <div style={{ padding:"20px 14px 0" }}>
            <SecHead title="Bordereaux de départ" accent={C.blue} count={MOCK.bordereaux.length} />

            <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              {MOCK.bordereaux.map((b, idx) => {
                const total = b.billets + b.bagages + b.colis;
                const net = b.hasFuel ? total - b.fuel : null;
                return (
                  <div key={b.id} style={{
                    padding:"11px 14px",
                    borderTop: idx === 0 ? "none" : `1px solid ${C.border}`,
                    display:"flex", alignItems:"center", gap:10,
                  }}>
                    {/* Contenu gauche */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                        <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{b.from} → {b.to}</span>
                        {b.hasFuel
                          ? <span style={{ fontSize:9, fontWeight:700, color:C.green, background:C.greenBg, borderRadius:20, padding:"2px 7px", display:"flex", alignItems:"center", gap:3 }}>✓ Clôturé</span>
                          : <span style={{ fontSize:9, fontWeight:700, color:C.amber, background:C.amberBg, borderRadius:20, padding:"2px 7px", display:"flex", alignItems:"center", gap:3 }}>⚠ Carburant manquant</span>
                        }
                      </div>
                      <div style={{ fontSize:10, color:C.textSub, marginTop:2 }}>{b.date} · {b.time} · {b.bus} · {b.pax} pax</div>
                      {/* Revenus inline */}
                      <div style={{ display:"flex", gap:8, marginTop:3, flexWrap:"wrap" }}>
                        <span style={{ fontSize:10, color:C.blue,   fontWeight:700 }}>B {fmt(b.billets)}</span>
                        <span style={{ fontSize:10, color:C.purple, fontWeight:700 }}>Ba {fmt(b.bagages)}</span>
                        <span style={{ fontSize:10, color:C.green,  fontWeight:700 }}>C {fmt(b.colis)}</span>
                        <span style={{ fontSize:10, color:C.text,   fontWeight:800 }}>= {fmt(total)} FCFA</span>
                        {net !== null && (
                          <span style={{ fontSize:10, color: net>=0 ? C.green : C.red, fontWeight:800 }}>
                            · Net {net>=0?"+":""}{fmt(net)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Actions droite */}
                    <div style={{ display:"flex", flexDirection:"column", gap:5, flexShrink:0 }}>
                      {!b.hasFuel && (
                        <button style={{ display:"flex", alignItems:"center", gap:3, background:C.amber, border:"none", borderRadius:8, padding:"5px 8px", cursor:"pointer" }}>
                          <span style={{ color:"#fff" }}><Icon.zap /></span>
                          <span style={{ fontSize:10, fontWeight:700, color:"#fff" }}>Carburant</span>
                        </button>
                      )}
                      <button style={{ display:"flex", alignItems:"center", gap:4, background:C.indigoBg, border:"none", borderRadius:8, padding:"5px 8px", cursor:"pointer" }}>
                        <span style={{ color:C.indigo }}><Icon.printer /></span>
                        <span style={{ fontSize:10, fontWeight:700, color:C.indigo }}>Imprimer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bouton rapport */}
          <div style={{ padding:"12px 14px 0" }}>
            <button style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              background:C.white, border:`1px solid ${C.border}`, borderRadius:14,
              padding:"13px", cursor:"pointer",
            }}>
              <span style={{ color:C.indigo }}><Icon.bar /></span>
              <span style={{ fontSize:13, fontWeight:700, color:C.indigo }}>Voir les rapports de l'agence</span>
              <span style={{ color:C.indigo, marginLeft:"auto" }}><Icon.chevron /></span>
            </button>
          </div>
        </div>

        {/* ═══ FAB ═══ */}
        <div style={{
          position:"fixed", bottom:24, right:24,
          width:52, height:52, borderRadius:26,
          background:C.indigo, display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", boxShadow:"0 4px 14px rgba(79,70,229,0.5)",
        }}>
          <span style={{ color:"#fff" }}><Icon.plus /></span>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { -webkit-font-smoothing: antialiased; }
        button:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
}
