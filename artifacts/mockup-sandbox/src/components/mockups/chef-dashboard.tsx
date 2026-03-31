/**
 * Chef d'Agence Dashboard — Maquette v3
 * Positionnement : supervision / validation / décision
 * PAS d'actions terrain. PAS d'accès page suivi.
 */
import React, { useState, useEffect } from "react";

const C = {
  indigo:   "#4F46E5",
  indigo2:  "#3730A3",
  indigoBg: "#EEF2FF",
  red:      "#DC2626",
  redBg:    "#FEF2F2",
  amber:    "#D97706",
  amberBg:  "#FEF3C7",
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

const Icon = {
  alert:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:16,height:16}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  nav:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:15,height:15}}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>,
  users:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:15,height:15}}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  dollar:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:18,height:18}}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  package:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:18,height:18}}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  zap:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:16,height:16}}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  checkSq:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:15,height:15}}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  clock:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:12,height:12}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  check:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:12,height:12}}><polyline points="20 6 9 17 4 12"/></svg>,
  bar:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:14,height:14}}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  trend:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:12,height:12}}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  chevron:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:14,height:14}}><polyline points="9 18 15 12 9 6"/></svg>,
  eye:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:14,height:14}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  map:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:11,height:11}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  printer:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:11,height:11}}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  plus:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{width:20,height:20}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

const MOCK = {
  agence: { name: "Agence Plateau", city: "Abidjan" },
  stats: { tripsToday: 6, agents: 8, passengersToday: 142, revToday: 851000 },
  perf: { vsYesterday: +12.4, vsSemaine: +8.1 },
  alerts: 2,
  aValider: { caisses: 3, colis: 5 },
  attention: {
    bordereaux_no_fuel: 4,
    bordereaux_no_fuel_items: [
      { route: "Abidjan → Bouaké",       time: "05:30", recettes: "245k" },
      { route: "Abidjan → Daloa",        time: "06:00", recettes: "189k" },
      { route: "Abidjan → San Pedro",    time: "06:30", recettes: "312k" },
    ],
  },
  supervision: {
    active: [
      { from: "Abidjan", to: "Bouaké",       time: "07:30", bus: "GB-034", pax: 42, seats: 49, status: "boarding"  },
      { from: "Abidjan", to: "Yamoussoukro", time: "08:00", bus: "GB-018", pax: 34, seats: 38, status: "en_route"  },
    ],
    scheduled: [
      { from: "Abidjan", to: "San Pedro", time: "10:00", pax: 18, seats: 45 },
      { from: "Abidjan", to: "Korhogo",   time: "11:30", pax: 31, seats: 49 },
      { from: "Abidjan", to: "Daloa",     time: "14:00", pax: 12, seats: 38 },
    ],
    done: 1,
  },
  bordereaux: [
    { route: "Abidjan → Korhogo",      date: "31/03", pax: 44, total: 394000, net: 329000, ok: true  },
    { route: "Abidjan → Yamoussoukro", date: "31/03", pax: 38, total: 271000, net: 229000, ok: true  },
    { route: "Abidjan → Bouaké",       date: "31/03", pax: 49, total: 245000, net: null,   ok: false },
    { route: "Abidjan → Daloa",        date: "31/03", pax: 36, total: 189000, net: null,   ok: false },
  ],
  revenue: { billets: 680000, colis: 124000, bagages: 47000, net: 781000 },
};

function fmt(n: number) { return n >= 1000 ? `${Math.round(n/1000)}k` : String(n); }

function SecHead({ title, accent, right }: { title: string; accent: string; right?: React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
      <div style={{ width:3, height:18, borderRadius:2, background:accent, flexShrink:0 }} />
      <span style={{ fontSize:13, fontWeight:800, color:C.text, flex:1 }}>{title}</span>
      {right}
    </div>
  );
}

function NavCard({
  icon, label, value, sublabel, accent, bg, badge, onClick,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sublabel?: string; accent: string; bg: string; badge?: number; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.white, borderRadius:14, padding:14,
        display:"flex", alignItems:"center", gap:12,
        border:`1.5px solid ${bg}`, cursor:"pointer",
        transition:"transform 0.1s",
      }}
    >
      <div style={{ width:44, height:44, borderRadius:14, background:bg, display:"flex", alignItems:"center", justifyContent:"center", color:accent, flexShrink:0 }}>
        {icon}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{label}</div>
        {sublabel && <div style={{ fontSize:11, color:C.textSub, marginTop:2 }}>{sublabel}</div>}
      </div>
      {badge !== undefined && badge > 0 && (
        <div style={{ background:accent, borderRadius:12, minWidth:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 8px" }}>
          <span style={{ color:"#fff", fontWeight:900, fontSize:15 }}>{badge}</span>
        </div>
      )}
      <div style={{ color:C.textSub }}><Icon.chevron /></div>
    </div>
  );
}

export default function ChefDashboard() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(t=>t+1), 1000); return () => clearInterval(iv); }, []);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

  return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", display:"flex", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:420, position:"relative" }}>

        {/* ══════════════════════════════════
            HEADER — gradient indigo
        ══════════════════════════════════ */}
        <div style={{ background:`linear-gradient(135deg,${C.indigo2} 0%,${C.indigo} 60%,#6366F1 100%)`, padding:"18px 18px 20px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", marginBottom:14 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:20, fontWeight:900, color:"#fff" }}>Bonjour, Kouamé 👋</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:5 }}>
                <span style={{ color:"#A5B4FC" }}><Icon.map /></span>
                <span style={{ fontSize:12, color:"#A5B4FC" }}>{MOCK.agence.name} — {MOCK.agence.city}</span>
              </div>
            </div>
            {/* Live badge */}
            <div style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(0,0,0,0.2)", borderRadius:20, padding:"5px 11px" }}>
              <div style={{ width:6, height:6, borderRadius:3, background:"#4ADE80", animation:"pulse 2s infinite" }} />
              <span style={{ fontSize:10, color:"#A5B4FC", fontWeight:600 }}>{timeStr}</span>
            </div>
          </div>

          {/* 4 KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
            {[
              { icon:<Icon.nav/>,    val:MOCK.stats.tripsToday,      label:"Départs",   color:C.indigo,  bg:"rgba(238,242,255,0.9)" },
              { icon:<Icon.users/>,  val:MOCK.stats.agents,           label:"Agents",    color:C.green,   bg:"rgba(209,250,229,0.9)" },
              { icon:<Icon.checkSq/>,val:MOCK.aValider.caisses,       label:"À valider", color:C.amber,   bg:"rgba(254,243,199,0.9)" },
              { icon:<Icon.package/>,val:MOCK.aValider.colis,         label:"Colis",     color:C.purple,  bg:"rgba(245,243,255,0.9)" },
            ].map((k,i) => (
              <div key={i} style={{ background:k.bg, borderRadius:12, padding:"10px 6px", textAlign:"center" }}>
                <div style={{ color:k.color, marginBottom:3, display:"flex", justifyContent:"center" }}>{k.icon}</div>
                <div style={{ fontSize:20, fontWeight:900, color:k.color, lineHeight:1 }}>{k.val}</div>
                <div style={{ fontSize:8, color:"#6B7280", fontWeight:600, marginTop:2, lineHeight:1.2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Revenus + perf */}
          <div style={{ background:"rgba(255,255,255,0.12)", borderRadius:12, padding:"11px 14px", display:"flex", alignItems:"center" }}>
            {[
              { l:"Billets", v:MOCK.revenue.billets, c:"#93C5FD" },
              { l:"Colis",   v:MOCK.revenue.colis,   c:"#C4B5FD" },
              { l:"Bagages", v:MOCK.revenue.bagages,  c:"#6EE7B7" },
            ].map((r,i) => (
              <React.Fragment key={i}>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:8, color:"rgba(255,255,255,0.55)", fontWeight:700, marginBottom:2, textTransform:"uppercase" }}>{r.l}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:r.c }}>{fmt(r.v)}</div>
                </div>
                <div style={{ width:1, height:24, background:"rgba(255,255,255,0.18)" }} />
              </React.Fragment>
            ))}
            <div style={{ flex:1.4, textAlign:"center" }}>
              <div style={{ fontSize:8, color:"rgba(255,255,255,0.55)", fontWeight:700, marginBottom:2, textTransform:"uppercase" }}>NET AUJOURD'HUI</div>
              <div style={{ fontSize:15, fontWeight:900, color:"#4ADE80" }}>+{fmt(MOCK.revenue.net)}</div>
            </div>
            <div style={{ width:1, height:24, background:"rgba(255,255,255,0.18)" }} />
            <div style={{ flex:1.2, textAlign:"center" }}>
              <div style={{ fontSize:8, color:"rgba(255,255,255,0.55)", fontWeight:700, marginBottom:2, textTransform:"uppercase" }}>VS HIER</div>
              <div style={{ fontSize:13, fontWeight:800, color:"#4ADE80" }}>+{MOCK.perf.vsYesterday}%</div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════
            SIGNALEMENT ALERTE
        ══════════════════════════════════ */}
        {MOCK.alerts > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:12, background:C.redBg, borderBottom:`2px solid #FCA5A5`, padding:"11px 16px", cursor:"pointer" }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"#FECACA", display:"flex", alignItems:"center", justifyContent:"center", color:C.red, flexShrink:0 }}>
              <Icon.alert />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#991B1B" }}>{MOCK.alerts} signalement{MOCK.alerts>1?"s":""} en attente</div>
              <div style={{ fontSize:11, color:C.red, marginTop:1 }}>Consulter les alertes signalées par vos agents</div>
            </div>
            <div style={{ background:C.red, borderRadius:9, padding:"3px 11px" }}>
              <span style={{ color:"#fff", fontSize:11, fontWeight:800 }}>Consulter</span>
            </div>
          </div>
        )}

        <div style={{ padding:"0 0 100px" }}>

          {/* ══════════════════════════════════
              1. À VALIDER (cœur du rôle chef)
          ══════════════════════════════════ */}
          <div style={{ padding:"20px 14px 0" }}>
            <SecHead
              title="À valider"
              accent={C.amber}
              right={<span style={{ fontSize:11, color:C.textSub }}>Votre rôle principal</span>}
            />

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <NavCard
                icon={<Icon.dollar />}
                label={`${MOCK.aValider.caisses} caisses en attente`}
                sublabel="Validez ou rejetez les soumissions agents"
                accent={C.amber} bg={C.amberBg} badge={MOCK.aValider.caisses}
              />
              <NavCard
                icon={<Icon.package />}
                label={`${MOCK.aValider.colis} colis à valider`}
                sublabel="En gare · en transit · arrivés à destination"
                accent={C.purple} bg={C.purpleBg} badge={MOCK.aValider.colis}
              />
            </div>
          </div>

          {/* ══════════════════════════════════
              2. POINTS D'ATTENTION (synthèse)
          ══════════════════════════════════ */}
          <div style={{ padding:"20px 14px 0" }}>
            <SecHead title="Points d'attention" accent={C.red} />

            {/* Bordereaux sans carburant — vue synthétique */}
            <div style={{
              background:C.white, borderRadius:14,
              border:`1.5px solid #FEE2E2`, overflow:"hidden", marginBottom:8,
            }}>
              {/* Résumé haut */}
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 14px" }}>
                <div style={{ width:42, height:42, borderRadius:13, background:"#FEF2F2", display:"flex", alignItems:"center", justifyContent:"center", color:C.red, flexShrink:0 }}>
                  <Icon.zap />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:C.text }}>
                    {MOCK.attention.bordereaux_no_fuel} bordereaux sans carburant
                  </div>
                  <div style={{ fontSize:11, color:C.textSub, marginTop:2 }}>
                    Résultat net non calculable — carburant non saisi
                  </div>
                </div>
                <div style={{ background:C.red, borderRadius:9, padding:"5px 12px", cursor:"pointer" }}>
                  <span style={{ color:"#fff", fontSize:11, fontWeight:800 }}>Gérer →</span>
                </div>
              </div>
              {/* 3 premiers éléments en aperçu (lecture seule) */}
              {MOCK.attention.bordereaux_no_fuel_items.map((b, i) => (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"8px 14px", borderTop:"1px solid #FEE2E2",
                  background: i % 2 === 0 ? "#FFF7F7" : "#FFF",
                }}>
                  <div style={{ width:6, height:6, borderRadius:3, background:C.red, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{b.route}</span>
                    <span style={{ fontSize:10, color:C.textSub, marginLeft:6 }}>{b.time}</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:C.red }}>{b.recettes} FCFA</span>
                </div>
              ))}
              {MOCK.attention.bordereaux_no_fuel > 3 && (
                <div style={{ padding:"8px 14px", borderTop:"1px solid #FEE2E2", textAlign:"center" }}>
                  <span style={{ fontSize:11, color:C.red, fontWeight:700 }}>
                    + {MOCK.attention.bordereaux_no_fuel - 3} autres — Voir tous →
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════
              3. SUPERVISION DÉPARTS (lecture seule)
          ══════════════════════════════════ */}
          <div style={{ padding:"20px 14px 0" }}>
            <SecHead
              title="Supervision des départs"
              accent={C.indigo}
              right={<span style={{ fontSize:11, color:C.indigo, fontWeight:700, cursor:"pointer" }}>Détails →</span>}
            />

            {/* En cours */}
            {MOCK.supervision.active.map((t, i) => {
              const isBoarding = t.status === "boarding";
              const pct = (t.pax / t.seats) * 100;
              return (
                <div key={i} style={{
                  background:C.white, borderRadius:14, padding:13, marginBottom:8,
                  border:`2px solid ${isBoarding ? "#DDD6FE" : "#A7F3D0"}`,
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:isBoarding ? C.purpleBg : C.greenBg, display:"flex", alignItems:"center", justifyContent:"center", color:isBoarding ? C.purple : C.green, flexShrink:0 }}>
                      {isBoarding ? <Icon.checkSq /> : <Icon.nav />}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{t.from} → {t.to}</div>
                      <div style={{ fontSize:10, fontWeight:700, color:isBoarding ? C.purple : C.green, marginTop:2, textTransform:"uppercase" }}>
                        {isBoarding ? "Embarquement" : "En route"} · {t.time}
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:16, fontWeight:900, color:C.text }}>{t.pax}<span style={{ fontSize:11, color:C.textSub, fontWeight:400 }}>/{t.seats}</span></div>
                      <div style={{ fontSize:9, color:C.textSub }}>{t.bus}</div>
                    </div>
                  </div>
                  <div style={{ height:3, background:"#F3F4F6", borderRadius:2, marginTop:9, overflow:"hidden" }}>
                    <div style={{ height:3, width:`${Math.min(100,pct)}%`, background:pct>=90 ? C.red : isBoarding ? C.purple : C.green, borderRadius:2 }} />
                  </div>
                </div>
              );
            })}

            {/* Programme compact */}
            <div style={{ fontSize:9, fontWeight:800, color:"#9CA3AF", letterSpacing:1.2, marginBottom:6 }}>PROGRAMME · {MOCK.supervision.scheduled.length} À VENIR</div>
            <div style={{ background:C.white, borderRadius:12, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              {MOCK.supervision.scheduled.map((t, i) => (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"9px 13px",
                  borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                }}>
                  <div style={{ color:C.amber }}><Icon.clock /></div>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{t.from} → {t.to}</span>
                    <span style={{ fontSize:10, color:C.textSub, marginLeft:6 }}>{t.time}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ height:4, width:40, background:C.grayBg, borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:4, width:`${(t.pax/t.seats)*100}%`, background:C.indigo, borderRadius:2 }} />
                    </div>
                    <span style={{ fontSize:10, color:C.textSub }}>{t.pax}/{t.seats}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Terminés */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, padding:"8px 13px", background:C.white, borderRadius:12, border:`1px solid ${C.border}` }}>
              <div style={{ color:C.gray }}><Icon.check /></div>
              <span style={{ fontSize:12, color:C.gray, fontWeight:600 }}>{MOCK.supervision.done} départ terminé aujourd'hui</span>
              <span style={{ marginLeft:"auto", fontSize:11, color:C.indigo, fontWeight:700, cursor:"pointer" }}>Voir →</span>
            </div>
          </div>

          {/* ══════════════════════════════════
              4. BORDEREAUX — synthèse financière
          ══════════════════════════════════ */}
          <div style={{ padding:"20px 14px 0" }}>
            <SecHead
              title="Bordereaux du jour"
              accent={C.blue}
              right={<span style={{ fontSize:11, color:C.blue, fontWeight:700, cursor:"pointer" }}>Tout voir →</span>}
            />

            <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              {/* En-tête colonnes */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 50px 80px 60px 24px", gap:8, padding:"7px 13px", background:"#F9FAFB", borderBottom:`1px solid ${C.border}` }}>
                {["Trajet","Pax","Recettes","Net",""].map((h,i) => (
                  <div key={i} style={{ fontSize:9, fontWeight:800, color:C.textSub, textTransform:"uppercase", letterSpacing:0.5 }}>{h}</div>
                ))}
              </div>
              {MOCK.bordereaux.map((b, i) => (
                <div key={i} style={{
                  display:"grid", gridTemplateColumns:"1fr 50px 80px 60px 24px", gap:8,
                  padding:"10px 13px", borderTop: i===0?"none":`1px solid ${C.border}`,
                  alignItems:"center",
                }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{b.route}</div>
                    <div style={{ fontSize:9, color:C.textSub }}>{b.date}</div>
                  </div>
                  <div style={{ fontSize:12, color:C.text, fontWeight:600 }}>{b.pax}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{fmt(b.total)}</div>
                  <div style={{ fontSize:12, fontWeight:800, color:b.ok ? C.green : "#D97706" }}>
                    {b.ok && b.net !== null ? `+${fmt(b.net)}` : "—"}
                  </div>
                  <div>
                    {b.ok
                      ? <span style={{ fontSize:8, background:C.greenBg, color:C.green, borderRadius:20, padding:"2px 5px", fontWeight:700 }}>✓</span>
                      : <span style={{ fontSize:8, background:C.amberBg, color:C.amber, borderRadius:20, padding:"2px 5px", fontWeight:700 }}>!</span>
                    }
                  </div>
                </div>
              ))}
              {/* Total */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 50px 80px 60px 24px", gap:8, padding:"10px 13px", borderTop:`2px solid ${C.border}`, background:"#F9FAFB" }}>
                <div style={{ fontSize:12, fontWeight:800, color:C.text }}>TOTAL</div>
                <div style={{ fontSize:12, fontWeight:800, color:C.text }}>{MOCK.bordereaux.reduce((s,b)=>s+b.pax,0)}</div>
                <div style={{ fontSize:12, fontWeight:900, color:C.indigo }}>{fmt(MOCK.bordereaux.reduce((s,b)=>s+b.total,0))}</div>
                <div style={{ fontSize:12, fontWeight:900, color:C.green }}>+{fmt(MOCK.bordereaux.filter(b=>b.ok&&b.net).reduce((s,b)=>s+(b.net as number),0))}</div>
                <div />
              </div>
            </div>

            {/* Imprimer rapport global */}
            <button style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              background:C.white, border:`1px solid ${C.border}`, borderRadius:14,
              padding:"12px", cursor:"pointer", marginTop:10,
            }}>
              <span style={{ color:C.indigo }}><Icon.printer /></span>
              <span style={{ fontSize:13, fontWeight:700, color:C.indigo }}>Imprimer le rapport du jour</span>
            </button>
          </div>

          {/* ══════════════════════════════════
              5. ACCÈS RAPIDES
          ══════════════════════════════════ */}
          <div style={{ padding:"20px 14px 0" }}>
            <SecHead title="Accès rapides" accent={C.gray} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                { icon:<Icon.bar />,    label:"Rapports",      color:C.indigo,  bg:C.indigoBg },
                { icon:<Icon.eye />,    label:"Bordereaux",    color:C.blue,    bg:C.blueBg   },
                { icon:<Icon.users />,  label:"Mes agents",    color:C.green,   bg:C.greenBg  },
                { icon:<Icon.trend />,  label:"Statistiques",  color:C.purple,  bg:C.purpleBg },
              ].map((a,i) => (
                <div key={i} style={{ background:C.white, borderRadius:12, padding:"13px 14px", display:"flex", alignItems:"center", gap:10, border:`1px solid ${C.border}`, cursor:"pointer" }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:a.bg, display:"flex", alignItems:"center", justifyContent:"center", color:a.color }}>
                    {a.icon}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{a.label}</span>
                  <div style={{ marginLeft:"auto", color:C.textSub }}><Icon.chevron /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAB */}
        <div style={{ position:"fixed", bottom:24, right:24, width:52, height:52, borderRadius:26, background:C.indigo, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 4px 14px rgba(79,70,229,0.45)", color:"#fff" }}>
          <Icon.plus />
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}} *{-webkit-font-smoothing:antialiased} button:hover{opacity:0.9}`}</style>
    </div>
  );
}
