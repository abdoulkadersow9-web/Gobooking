/**
 * Chef d'Agence — Dashboard final
 * Structure : Header / Urgences / Supervision / Accès
 * Principe : 1 info = 1 seule fois, max 5 items/liste, 0 répétition
 */
import React, { useState, useEffect } from "react";

/* ── Tokens ────────────────────────────────────────────── */
const C = {
  bg:       "#F5F6FA",
  white:    "#FFFFFF",
  indigo:   "#4F46E5",
  indigo2:  "#3730A3",
  text:     "#111827",
  textSub:  "#6B7280",
  border:   "#E5E7EB",
  red:      "#DC2626",
  redSoft:  "#FEF2F2",
  amber:    "#D97706",
  amberSoft:"#FFFBEB",
  green:    "#059669",
  greenSoft:"#ECFDF5",
  purple:   "#7C3AED",
  purpleSoft:"#F5F3FF",
  blue:     "#1D4ED8",
  blueSoft: "#EFF6FF",
};

/* ── Mock data ─────────────────────────────────────────── */
const D = {
  name:    "Kouamé",
  agence:  "Agence Plateau · Abidjan",
  kpis:    { departs: 6, agents: 8, caisse: 3, colis: 5 },
  rev:     { billets: 680, bagages: 47, colis_r: 124, net: 851 },
  urgences:{
    alertes:   2,
    caisses:   3,
    colis:     5,
    noFuel:    4,   /* nombre, pas de liste — accès via page bordereaux */
  },
  actifs: [
    { route: "Abidjan → Bouaké",       heure: "07:30", statut: "Embarquement", pax: 42, total: 49, couleur: "#7C3AED" },
    { route: "Abidjan → Yamoussoukro", heure: "08:00", statut: "En route",     pax: 34, total: 38, couleur: "#059669" },
  ],
  programme: [
    { route: "Abidjan → San Pedro", heure: "10:00", pax: 18, total: 45 },
    { route: "Abidjan → Korhogo",   heure: "11:30", pax: 31, total: 49 },
    { route: "Abidjan → Daloa",     heure: "14:00", pax: 12, total: 38 },
  ],
  termines: 1,
};

/* ── SVG Icons ─────────────────────────────────────────── */
const Ic = {
  warn:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={16} height={16}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  dollar:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={18} height={18}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  pkg:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={18} height={18}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  zap:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={18} height={18}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  nav:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={14} height={14}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>,
  clock:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={12} height={12}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  check:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={12} height={12}><polyline points="20 6 9 17 4 12"/></svg>,
  bar:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={16} height={16}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  file:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={16} height={16}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  users:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={16} height={16}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  trend:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={16} height={16}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  chev:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={14} height={14}><polyline points="9 18 15 12 9 6"/></svg>,
  map:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={11} height={11}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  plus:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={22} height={22}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

/* ── Composants atomiques ──────────────────────────────── */
function Label({ text }: { text: string }) {
  return (
    <div style={{ fontSize:9, fontWeight:800, color:"#9CA3AF", letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>
      {text}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ fontSize:16, fontWeight:900, color:C.text, marginBottom:14 }}>{title}</div>
  );
}

function ActionCard({ icon, label, sub, accent, soft, count, onClick }: {
  icon: React.ReactNode; label: string; sub: string;
  accent: string; soft: string; count: number; onClick?: ()=>void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display:"flex", alignItems:"center", gap:14,
        background:C.white, borderRadius:16, padding:"14px 16px",
        border:`1.5px solid ${soft}`, cursor:"pointer",
        transition:"box-shadow .15s",
      }}
    >
      <div style={{ width:44, height:44, borderRadius:13, background:soft, display:"flex", alignItems:"center", justifyContent:"center", color:accent, flexShrink:0 }}>
        {icon}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{label}</div>
        <div style={{ fontSize:11, color:C.textSub, marginTop:3 }}>{sub}</div>
      </div>
      <div style={{ background:accent, borderRadius:12, minWidth:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 10px", flexShrink:0 }}>
        <span style={{ color:"#fff", fontWeight:900, fontSize:16 }}>{count}</span>
      </div>
      <div style={{ color:C.textSub }}>{Ic.chev}</div>
    </div>
  );
}

/* ── Page principale ───────────────────────────────────── */
export default function ChefDashboard() {
  const [sec, setSec] = useState(0);
  useEffect(()=>{ const iv=setInterval(()=>setSec(s=>s+1),1000); return ()=>clearInterval(iv); },[]);
  const now=new Date(); const ts=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

  return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif", display:"flex", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:420, paddingBottom:90 }}>

        {/* ══════════════════════════════════════
            A. HEADER
        ══════════════════════════════════════ */}
        <div style={{ background:`linear-gradient(150deg,${C.indigo2},${C.indigo} 55%,#818CF8)`, padding:"20px 18px 22px" }}>

          {/* Greeting row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
            <div>
              <div style={{ fontSize:22, fontWeight:900, color:"#fff", letterSpacing:-0.5 }}>Bonjour, {D.name} 👋</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:5 }}>
                <span style={{ color:"#A5B4FC" }}>{Ic.map}</span>
                <span style={{ fontSize:12, color:"#A5B4FC" }}>{D.agence}</span>
              </div>
            </div>
            {/* Live time */}
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,0.22)", borderRadius:20, padding:"6px 12px" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#4ADE80", animation:"blink 1.6s infinite" }} />
              <span style={{ fontSize:11, color:"#C7D2FE", fontWeight:600 }}>{ts}</span>
            </div>
          </div>

          {/* KPIs — 4 tuiles */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
            {[
              { v:D.kpis.departs, l:"Départs",   c:"#818CF8", bg:"rgba(129,140,248,.18)" },
              { v:D.kpis.agents,  l:"Agents",    c:"#6EE7B7", bg:"rgba(110,231,183,.18)" },
              { v:D.kpis.caisse,  l:"À valider", c:"#FCD34D", bg:"rgba(252,211,77,.18)"  },
              { v:D.kpis.colis,   l:"Colis",     c:"#C4B5FD", bg:"rgba(196,181,253,.18)" },
            ].map((k,i)=>(
              <div key={i} style={{ background:k.bg, borderRadius:13, padding:"11px 8px", textAlign:"center", backdropFilter:"blur(6px)" }}>
                <div style={{ fontSize:26, fontWeight:900, color:k.c, lineHeight:1 }}>{k.v}</div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.65)", fontWeight:700, marginTop:4, letterSpacing:.3 }}>{k.l}</div>
              </div>
            ))}
          </div>

          {/* Revenue strip */}
          <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:13, padding:"12px 16px", display:"flex", alignItems:"center", gap:0 }}>
            {[
              { l:"Billets",  v:D.rev.billets,   c:"#93C5FD" },
              { l:"Bagages",  v:D.rev.bagages,   c:"#6EE7B7" },
              { l:"Colis",    v:D.rev.colis_r,   c:"#C4B5FD" },
            ].map((r,i)=>(
              <React.Fragment key={i}>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", fontWeight:700, marginBottom:3, textTransform:"uppercase", letterSpacing:.5 }}>{r.l}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:r.c }}>{r.v}k</div>
                </div>
                <div style={{ width:1, height:26, background:"rgba(255,255,255,0.15)" }} />
              </React.Fragment>
            ))}
            <div style={{ flex:1.3, textAlign:"center" }}>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", fontWeight:700, marginBottom:3, textTransform:"uppercase", letterSpacing:.5 }}>NET / JOUR</div>
              <div style={{ fontSize:16, fontWeight:900, color:"#4ADE80" }}>+{D.rev.net}k</div>
            </div>
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding:"24px 16px 0" }}>

          {/* ══════════════════════════════════════
              B. URGENCES — 1 seule section consolidée
              Alertes + caisses + colis + carburant
          ══════════════════════════════════════ */}
          <SectionTitle title="Urgences & validations" />

          {/* Alerte signalement — si présente */}
          {D.urgences.alertes > 0 && (
            <div style={{
              display:"flex", alignItems:"center", gap:12,
              background:C.redSoft, border:`1.5px solid #FCA5A5`,
              borderRadius:16, padding:"13px 16px", marginBottom:10, cursor:"pointer",
            }}>
              <div style={{ width:40, height:40, borderRadius:12, background:"#FECACA", display:"flex", alignItems:"center", justifyContent:"center", color:C.red, flexShrink:0 }}>
                {Ic.warn}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:800, color:"#991B1B" }}>
                  {D.urgences.alertes} alerte{D.urgences.alertes>1?"s":""} en attente
                </div>
                <div style={{ fontSize:11, color:C.red, marginTop:3 }}>
                  Signalements agents à consulter
                </div>
              </div>
              <div style={{ background:C.red, borderRadius:10, padding:"6px 13px", fontSize:11, fontWeight:800, color:"#fff", whiteSpace:"nowrap" }}>
                Consulter
              </div>
            </div>
          )}

          {/* Caisses à valider */}
          <div style={{ marginBottom:10 }}>
            <ActionCard
              icon={Ic.dollar} label={`${D.urgences.caisses} caisses à valider`}
              sub="Soumissions agents en attente d'approbation"
              accent={C.amber} soft={C.amberSoft} count={D.urgences.caisses}
            />
          </div>

          {/* Colis à valider */}
          <div style={{ marginBottom:10 }}>
            <ActionCard
              icon={Ic.pkg} label={`${D.urgences.colis} colis à valider`}
              sub="En gare · en transit · arrivés"
              accent={C.purple} soft={C.purpleSoft} count={D.urgences.colis}
            />
          </div>

          {/* Carburant manquant — synthèse en 1 carte, pas de liste */}
          {D.urgences.noFuel > 0 && (
            <div style={{
              display:"flex", alignItems:"center", gap:14,
              background:C.white, borderRadius:16, padding:"14px 16px",
              border:"1.5px solid #FEE2E2", cursor:"pointer", marginBottom:0,
            }}>
              <div style={{ width:44, height:44, borderRadius:13, background:C.redSoft, display:"flex", alignItems:"center", justifyContent:"center", color:C.red, flexShrink:0 }}>
                {Ic.zap}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.text }}>
                  {D.urgences.noFuel} départs sans carburant
                </div>
                <div style={{ fontSize:11, color:C.textSub, marginTop:3 }}>
                  Résultat net non calculable — gérer via Bordereaux
                </div>
              </div>
              <div style={{ background:C.red, borderRadius:10, padding:"6px 13px", fontSize:11, fontWeight:800, color:"#fff", whiteSpace:"nowrap" }}>
                Gérer →
              </div>
            </div>
          )}

          {/* Séparateur */}
          <div style={{ height:1, background:C.border, margin:"28px 0 24px" }} />

          {/* ══════════════════════════════════════
              C. SUPERVISION
              Départs actifs + programme
          ══════════════════════════════════════ */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <span style={{ fontSize:16, fontWeight:900, color:C.text }}>Supervision des départs</span>
            <span style={{ fontSize:12, color:C.indigo, fontWeight:700, cursor:"pointer" }}>Voir tout →</span>
          </div>

          {/* Statut global pills */}
          <div style={{ display:"flex", gap:8, marginBottom:16 }}>
            {[
              { l:"En cours", n:D.actifs.length, c:C.green,  bg:C.greenSoft  },
              { l:"Programme",n:D.programme.length, c:C.amber, bg:C.amberSoft },
              { l:"Terminés", n:D.termines,       c:C.textSub,bg:C.border    },
            ].map((p,i)=>(
              <div key={i} style={{ flex:1, background:p.bg, borderRadius:11, padding:"9px 8px", textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:900, color:p.c }}>{p.n}</div>
                <div style={{ fontSize:9, color:C.textSub, marginTop:2, fontWeight:600 }}>{p.l}</div>
              </div>
            ))}
          </div>

          {/* Actifs (max 2) */}
          {D.actifs.map((t,i)=>{
            const pct=(t.pax/t.total)*100;
            return (
              <div key={i} style={{
                background:C.white, borderRadius:16, padding:"13px 14px",
                border:`2px solid ${t.couleur}22`, marginBottom:8,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:11, background:`${t.couleur}18`, display:"flex", alignItems:"center", justifyContent:"center", color:t.couleur, flexShrink:0 }}>
                    {Ic.nav}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{t.route}</div>
                    <div style={{ fontSize:11, fontWeight:700, color:t.couleur, marginTop:2 }}>{t.statut} · {t.heure}</div>
                  </div>
                  <div style={{ fontSize:17, fontWeight:900, color:C.text }}>
                    {t.pax}<span style={{ fontSize:11, color:C.textSub, fontWeight:400 }}>/{t.total}</span>
                  </div>
                </div>
                <div style={{ height:3, background:"#F3F4F6", borderRadius:2, marginTop:10, overflow:"hidden" }}>
                  <div style={{ height:3, width:`${pct}%`, background:pct>=90?C.red:t.couleur, borderRadius:2 }} />
                </div>
              </div>
            );
          })}

          {/* Programme (max 3) — lignes compactes */}
          <div style={{ background:C.white, borderRadius:14, overflow:"hidden", border:`1px solid ${C.border}` }}>
            {D.programme.map((t,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderTop:i===0?"none":`1px solid ${C.border}` }}>
                <span style={{ color:C.amber }}>{Ic.clock}</span>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{t.route}</span>
                  <span style={{ fontSize:11, color:C.textSub, marginLeft:6 }}>{t.heure}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:40, height:3, background:"#F3F4F6", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ width:`${(t.pax/t.total)*100}%`, height:3, background:C.indigo, borderRadius:2 }} />
                  </div>
                  <span style={{ fontSize:10, color:C.textSub, minWidth:32 }}>{t.pax}/{t.total}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Séparateur */}
          <div style={{ height:1, background:C.border, margin:"28px 0 24px" }} />

          {/* ══════════════════════════════════════
              D. ACCÈS RAPIDES — 2×2 grille
          ══════════════════════════════════════ */}
          <SectionTitle title="Accès rapides" />

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { icon:Ic.bar,   label:"Rapports",    accent:C.indigo,  bg:"#EEF2FF" },
              { icon:Ic.file,  label:"Bordereaux",  accent:C.blue,    bg:C.blueSoft },
              { icon:Ic.users, label:"Mes agents",  accent:C.green,   bg:C.greenSoft},
              { icon:Ic.trend, label:"Statistiques",accent:C.purple,  bg:C.purpleSoft},
            ].map((a,i)=>(
              <div key={i} style={{ background:C.white, borderRadius:14, padding:"15px 14px", display:"flex", alignItems:"center", gap:12, border:`1px solid ${C.border}`, cursor:"pointer" }}>
                <div style={{ width:38, height:38, borderRadius:11, background:a.bg, display:"flex", alignItems:"center", justifyContent:"center", color:a.accent, flexShrink:0 }}>
                  {a.icon}
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:C.text, flex:1 }}>{a.label}</span>
                <span style={{ color:C.textSub }}>{Ic.chev}</span>
              </div>
            ))}
          </div>

        </div>

        {/* FAB */}
        <div style={{ position:"fixed", bottom:26, right:24, width:54, height:54, borderRadius:27, background:C.indigo, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 6px 20px rgba(79,70,229,.45)", color:"#fff" }}>
          {Ic.plus}
        </div>
      </div>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}} *{-webkit-font-smoothing:antialiased;box-sizing:border-box}`}</style>
    </div>
  );
}
