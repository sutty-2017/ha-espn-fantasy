const CARD_VERSION = "0.1.19";

const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[char]));
const num = (value, digits = 1) => {
  const n = Number(value);
  return value === null || value === undefined || !Number.isFinite(n) ? "—" : n.toFixed(digits);
};
const fmtKickoff = (value) => {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, { weekday:"short", hour:"numeric", minute:"2-digit" }).format(date);
};
const stateList = (hass) => Object.values(hass?.states || {});
const findByAttrs = (hass, predicate) => stateList(hass).find((s) => predicate(s.attributes || {}, s));
const findRoster = (hass, entity) => entity ? hass.states[entity] : findByAttrs(hass, (a) => Array.isArray(a.players) && a.team_name && "starters_remaining" in a);
const findMatchup = (hass, entity) => entity ? hass.states[entity] : findByAttrs(hass, (a) => Array.isArray(a.my_roster) && Array.isArray(a.opponent_roster));

const playerEntity = (hass, id) => findByAttrs(hass, (a) => String(a.player_id) === String(id))?.entity_id;

const statusRank = { final:0, in_progress:1, scheduled:2, bye:3, unknown:4 };
const lineupRank = {0:0,2:1,4:2,6:3,23:4,16:5,17:6,20:7,21:8};
const rosterOrder = (players=[]) => players.map((p,i)=>({p,i})).sort((a,b)=>(lineupRank[a.p.lineup_slot_id]??99)-(lineupRank[b.p.lineup_slot_id]??99)||a.i-b.i).map(x=>x.p);
const teamLogo = (url, name="Team") => {
  const initials=String(name||"Team").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"T";
  return `<div class="team-logo-wrap"><div class="team-logo-fallback">${esc(initials)}</div>${url?`<img class="team-logo" src="${esc(url)}" alt="" referrerpolicy="no-referrer" style="visibility:hidden" onload="this.style.visibility='visible'" onerror="this.style.display='none'">`:""}</div>`;
};
const statusText = (p) => {
  if (p.game_status === "final") return "FINAL";
  if (p.game_status === "in_progress") return "LIVE";
  if (p.game_status === "scheduled") return fmtKickoff(p.game_start);
  if (p.game_status === "bye") return "BYE";
  return "STATUS TBD";
};
const opponentText = (p) => {
  if (!p.opponent_abbrev) return "";
  return `${p.home_away === "away" ? "@" : "vs"} ${p.opponent_abbrev}`;
};
const injuryVisible = (p) => p.injury_status && !["ACTIVE","NORMAL"].includes(String(p.injury_status).toUpperCase());

function playerTile(p, opts = {}) {
  const entity = opts.entity || "";
  const score = p.actual_points;
  const status = p.game_status || "unknown";
  const primary = status === "scheduled" ? statusText(p) : `${num(score)} pts`;
  const projection = p.projected_points == null ? "" : `Proj ${num(p.projected_points)}`;
  const meta = [opts.showSlot ? p.lineup_slot : p.position, p.nfl_team, opponentText(p)].filter(Boolean).join(" · ");
  const badge = status === "in_progress" ? '<span class="status live">LIVE</span>' :
    status === "final" ? '<span class="status final">FINAL</span>' :
    status === "bye" ? '<span class="status">BYE</span>' : "";
  const injury = injuryVisible(p) ? `<span class="injury">${esc(p.injury_status)}</span>` : "";
  return `<div class="player-tile ${esc(status)}" data-player-id="${esc(p.id)}" data-entity="${esc(entity)}">
    <div class="portrait">${p.headshot ? `<img src="${esc(p.headshot)}" alt="" loading="lazy">` : ""}</div>
    <div class="player-main"><div class="player-name">${esc(p.name)}</div><div class="player-meta">${esc(meta)}</div><div class="badges">${badge}${injury}</div></div>
    <div class="player-score"><strong>${esc(primary)}</strong><span>${esc(projection)}</span></div>
  </div>`;
}

function statGrid(p, order) {
  const stats=p.stats||{}, labels=p.stat_labels||{};
  const keys=(order?.length?order:p.default_stats||[]).filter((key)=>stats[key]!==undefined);
  return keys.length ? `<div class="stat-grid">${keys.map((key)=>`<div class="stat-cell"><span>${esc(labels[key]||key.replaceAll("_"," "))}</span><strong>${num(stats[key])}</strong></div>`).join("")}</div>` : '<div class="empty">No game stats available yet.</div>';
}
const orderedStats = (p, configured) => { const available=Object.keys(p?.stats||{}); return (configured?.length?configured:p?.default_stats||[]).filter(k=>available.includes(k)); };

function playerDetails(p, order) {
  return `<div class="player-details">${playerTile(p)}${statGrid(p,order)}</div>`;
}

class ESPNPlayerEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:"open"});this._config={};}
  set hass(v){this._hass=v;this.render();} get hass(){return this._hass;}
  setConfig(v){this._config=v||{};this.render();}
  fire(config){this._config=config;this.dispatchEvent(new CustomEvent("config-changed",{detail:{config},bubbles:true,composed:true}));this.render();}
  render(){
    if(!this.hass)return;
    const state=this.hass.states[this._config.entity],a=state?.attributes||{};
    const p={stats:a.stats||{},default_stats:a.default_stats||[],stat_labels:a.stat_labels||{}};
    const available=Object.keys(p.stats),selected=orderedStats(p,this._config.stats);
    const keys=[...selected,...available.filter(k=>!selected.includes(k))];
    const schema=[
      {name:"entity",required:true,selector:{entity:{domain:"sensor"}}},
      {name:"layout",selector:{select:{mode:"dropdown",options:[{value:"horizontal",label:"Horizontal"},{value:"vertical",label:"Vertical"}]}}},
      {name:"display",selector:{select:{mode:"dropdown",options:[{value:"compact",label:"Compact"},{value:"expandable",label:"Tap to expand"},{value:"expanded",label:"Always expanded"}]}}}
    ];
    this.shadowRoot.innerHTML=`<style>:host{display:block}.stats-title{font-weight:600;margin:18px 0 4px}.hint{font-size:12px;color:var(--secondary-text-color);margin-bottom:8px}.row{display:grid;grid-template-columns:minmax(0,1fr) 40px 40px;gap:6px;align-items:center;min-height:42px;border-bottom:1px solid var(--divider-color)}button{border:0;background:var(--secondary-background-color);color:var(--primary-text-color);border-radius:8px;min-height:34px;cursor:pointer}button:disabled{opacity:.35}label{overflow:hidden;text-overflow:ellipsis}</style><ha-form></ha-form><div class="stats-title">Expanded stats</div><div class="hint">Choose the stats to show and use the arrows to set their order.</div>${state?keys.map((k,i)=>`<div class="row"><label><input type="checkbox" data-key="${esc(k)}" ${selected.includes(k)?"checked":""}> ${esc(p.stat_labels[k]||k.replaceAll("_"," "))}</label><button data-dir="-1" data-i="${i}" ${i===0?"disabled":""}>↑</button><button data-dir="1" data-i="${i}" ${i===keys.length-1?"disabled":""}>↓</button></div>`).join(""):'<div class="hint">Select a player entity to configure stats.</div>'}`;
    const form=this.shadowRoot.querySelector("ha-form");form.hass=this.hass;form.data=this._config;form.schema=schema;form.computeLabel=(s)=>({entity:"Player",layout:"Layout",display:"Display mode"}[s.name]||s.name);form.addEventListener("value-changed",(e)=>this.fire({...this._config,...e.detail.value}));
    this.shadowRoot.querySelectorAll("button[data-i]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.i),j=i+Number(b.dataset.dir),next=[...keys];[next[i],next[j]]=[next[j],next[i]];this.fire({...this._config,stats:next.filter(k=>selected.includes(k))});}));
    this.shadowRoot.querySelectorAll("input[data-key]").forEach(x=>x.addEventListener("change",()=>{const next=keys.filter(k=>this.shadowRoot.querySelector(`input[data-key="${CSS.escape(k)}"]`)?.checked);this.fire({...this._config,stats:next});}));
  }
}
if(!customElements.get("espn-fantasy-player-editor"))customElements.define("espn-fantasy-player-editor",ESPNPlayerEditor);

class ESPNBaseCard extends HTMLElement {
  constructor(){ super(); this.attachShadow({mode:"open"}); this._config={}; this._openPlayerId=null; }
  set hass(v){ this._hass=v; this.render(); } get hass(){ return this._hass; }
  setConfig(v){ this._config=v || {}; this.render(); }
  getCardSize(){ return 4; }
  getGridOptions(){ return { rows:"auto", columns:12, min_rows:2, min_columns:4 }; }
  bindPlayers(handler){ this.shadowRoot.querySelectorAll(".player-tile[data-player-id]").forEach((n)=>n.addEventListener("click",()=>handler?.(n.dataset.playerId,n.dataset.entity,n))); }
  openPlayer(p, order){ if(!p)return; this._openPlayerId=String(p.id); const dialog=this.shadowRoot.querySelector("dialog.player-dialog"); if(!dialog)return; dialog.querySelector(".dialog-content").innerHTML=playerDetails(p,order); if(!dialog.open)dialog.showModal(); }
  dialog(){ return `<dialog class="player-dialog"><button class="dialog-close" aria-label="Close">×</button><div class="dialog-content"></div></dialog>`; }
  bindDialog(){ const d=this.shadowRoot.querySelector("dialog.player-dialog"); if(!d)return; const close=()=>{this._openPlayerId=null;d.close();}; d.querySelector(".dialog-close")?.addEventListener("click",close); d.addEventListener("click",(e)=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}); d.addEventListener("close",()=>{this._openPlayerId=null;}); }
  restoreDialog(players, order){ if(!this._openPlayerId)return; const p=(players||[]).find(x=>String(x.id)===String(this._openPlayerId)); if(p)this.openPlayer(p,order); else this._openPlayerId=null; }
  styles(){ return `
    :host{display:block;color:var(--primary-text-color)}ha-card{overflow:hidden;background:var(--ha-card-background,var(--card-background-color));border:var(--ha-card-border-width,0) solid var(--ha-card-border-color,var(--divider-color));border-radius:var(--ha-card-border-radius,var(--ha-card-border-radius,12px));box-shadow:var(--ha-card-box-shadow,var(--ha-card-box-shadow,none));backdrop-filter:var(--ha-card-backdrop-filter,none)}.wrap{padding:16px;box-sizing:border-box}
    .header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.title{font-size:20px;font-weight:700}.subtle{font-size:12px;color:var(--secondary-text-color)}
    .player-list{display:grid;gap:7px}.player-tile{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:64px;padding:7px 10px;border-radius:14px;background:var(--secondary-background-color,transparent);cursor:pointer;box-sizing:border-box}
    .portrait{width:48px;height:48px;border-radius:50%;overflow:hidden;background:var(--secondary-background-color)}.portrait img{width:100%;height:100%;object-fit:cover}.player-main{min-width:0}.player-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-meta{font-size:12px;color:var(--secondary-text-color);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .player-score{text-align:right;display:flex;flex-direction:column;gap:2px}.player-score strong{font-size:16px}.player-score span{font-size:11px;color:var(--secondary-text-color)}.badges{display:flex;gap:4px;margin-top:4px}.status,.injury{font-size:9px;font-weight:800;padding:2px 5px;border-radius:999px;background:var(--secondary-background-color)}.status.live{background:var(--error-color);color:white}.status.final{opacity:.75}.injury{background:color-mix(in srgb,var(--warning-color,#f6a623) 25%,transparent);color:var(--primary-text-color)}
    .team-head{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:start;text-align:center;margin-bottom:14px}.team-side{display:flex;flex-direction:column;align-items:center}.team-logo-wrap{position:relative;width:58px;height:58px;margin:0 auto 6px}.team-logo,.team-logo-fallback{position:absolute;inset:0;width:58px;height:58px}.team-logo{display:block;object-fit:contain}.team-logo-fallback{display:grid;place-items:center;border-radius:50%;background:var(--secondary-background-color);font-weight:800;font-size:18px;color:var(--secondary-text-color)}.team-name{font-weight:700}.big-score{font-size:28px;font-weight:800}.projection{font-size:11px;color:var(--secondary-text-color)}.vs{font-size:11px;font-weight:800;color:var(--secondary-text-color)}
    .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px;margin-top:12px}.stat-cell{padding:10px;min-height:54px;border-radius:var(--ha-card-border-radius,12px);background:var(--secondary-background-color,transparent);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:3px}.stat-cell span{font-size:10px;color:var(--secondary-text-color);text-transform:uppercase}.stat-cell strong{font-size:18px}.player-dialog{width:min(520px,calc(100% - 32px));border:var(--ha-card-border-width,0) solid var(--ha-card-border-color,var(--divider-color));border-radius:var(--ha-card-border-radius,16px);background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color);box-shadow:var(--ha-card-box-shadow);padding:16px}.player-dialog::backdrop{background:rgba(0,0,0,.55);backdrop-filter:blur(3px)}.dialog-close{float:right;border:0;background:transparent;color:var(--primary-text-color);font-size:28px;cursor:pointer}.dialog-content{clear:both}.ticker{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:3px}.ticker .player-tile{min-width:270px;scroll-snap-align:start}.empty{padding:12px;color:var(--secondary-text-color)}
    @media(max-width:600px){.wrap{padding:12px}.player-tile{grid-template-columns:42px minmax(0,1fr) auto}.portrait{width:42px;height:42px}.ticker .player-tile{min-width:240px}.big-score{font-size:23px}}
  `; }
}

class ESPNFantasyPlayerCard extends ESPNBaseCard {
  constructor(){ super(); this._expanded=false; }
  static getStubConfig(){ return {type:"custom:espn-fantasy-player-card",layout:"horizontal",display:"expandable"}; }
  static getConfigElement(){ return document.createElement("espn-fantasy-player-editor"); }

  player(){ const s=this.hass?.states[this._config.entity],a=s?.attributes||{}; return s?{id:a.player_id,name:a.player_name||a.friendly_name,position:a.position,lineup_slot:a.roster_slot,nfl_team:a.nfl_team,headshot:a.headshot,injury_status:a.injury_status,actual_points:a.live_points??a.actual_points??Number(s.state),projected_points:a.projected_points,game_status:a.game_status,game_start:a.game_start,home_away:a.home_away,opponent_abbrev:a.opponent_abbrev,stats:a.stats||{},stat_labels:a.stat_labels||{},default_stats:a.default_stats||[]}:null; }
  render(){ if(!this.hass)return; const p=this.player(),vertical=this._config.layout==="vertical",mode=this._config.display||"expandable",expanded=mode==="expanded"||(mode==="expandable"&&this._expanded); this.shadowRoot.innerHTML=`<style>${this.styles()}${vertical?`.player-tile{grid-template-columns:1fr;text-align:center;justify-items:center}.portrait{width:82px;height:82px}.player-main{width:100%}.player-score{text-align:center}.badges{justify-content:center}`:""}</style><ha-card><div class="wrap">${p?`${playerTile(p)}${expanded?statGrid(p,this._config.stats):""}`:'<div class="empty">Choose an ESPN Fantasy player entity.</div>'}</div></ha-card>`; if(p&&mode==="expandable")this.bindPlayers(()=>{this._expanded=!this._expanded;this.render();}); }
}

class ESPNFantasyTickerCard extends ESPNBaseCard {
  constructor(){super();this._timer=null;}
  set hass(v){
    this._hass=v;
    if(this.shadowRoot.querySelector(".ticker"))this.updateTicker();
    else this.render();
  }
  setConfig(v){if(this._timer){clearInterval(this._timer);this._timer=null;}this._config=v||{};this.render();}
  static getStubConfig(){ return {type:"custom:espn-fantasy-player-ticker-card",show_bench:false,auto_scroll:false,scroll_speed:"normal"}; }
  static getConfigForm(){ return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"show_bench",selector:{boolean:{}}},{name:"auto_scroll",selector:{boolean:{}}},{name:"scroll_speed",selector:{select:{options:["slow","normal","fast"]}}}]}; }
  getGridOptions(){ return {rows:"auto",columns:12,min_rows:2,min_columns:4}; }
  disconnectedCallback(){if(this._timer)clearInterval(this._timer);}
  players(){
    const s=findRoster(this.hass,this._config.entity),a=s?.attributes||{};
    const list=(this._config.show_bench?a.players:a.starters)||[];
    return [...list].sort((x,y)=>(statusRank[x.game_status]??9)-(statusRank[y.game_status]??9));
  }
  bindTickerPlayers(){
    this.bindPlayers((id)=>this.openPlayer(this._players.find(p=>String(p.id)===String(id)),this._config.stats));
  }
  syncTimer(){
    if(!this._config.auto_scroll&&this._timer){clearInterval(this._timer);this._timer=null;}
    if(this._config.auto_scroll&&this._players.length>1&&!this._timer){
      const ms={slow:5000,normal:3000,fast:1800}[this._config.scroll_speed]||3000;
      this._timer=setInterval(()=>{
        const el=this.shadowRoot.querySelector(".ticker");if(!el)return;
        const tiles=[...el.querySelectorAll(".player-tile")];if(!tiles.length)return;
        const leftFor=(tile)=>tile.getBoundingClientRect().left-el.getBoundingClientRect().left+el.scrollLeft;
        const current=tiles.reduce((best,tile,i)=>Math.abs(leftFor(tile)-el.scrollLeft)<Math.abs(leftFor(tiles[best])-el.scrollLeft)?i:best,0);
        const next=(current+1)%tiles.length;
        el.scrollTo({left:leftFor(tiles[next]),behavior:"smooth"});
      },ms);
    }
  }
  updateTicker(){
    const el=this.shadowRoot.querySelector(".ticker");if(!el){this.render();return;}
    const players=this.players();this._players=players;
    const scroll=el.scrollLeft;
    el.innerHTML=players.map((p)=>playerTile(p)).join("");
    el.scrollLeft=scroll;
    this.bindTickerPlayers();
    this.restoreDialog(players,this._config.stats);
    this.syncTimer();
  }
  render(){
    if(!this.hass)return;
    const players=this.players();this._players=players;
    this.shadowRoot.innerHTML=`<style>${this.styles()}</style><ha-card><div class="wrap">${players.length?`<div class="ticker">${players.map((p)=>playerTile(p)).join("")}</div>`:'<div class="empty">No normalized roster data yet.</div>'}</div></ha-card>${this.dialog()}`;
    this.bindTickerPlayers();this.bindDialog();this.restoreDialog(players,this._config.stats);this.syncTimer();
  }
}
