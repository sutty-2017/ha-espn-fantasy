const CARD_VERSION = "0.1.26";

const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[char]));
const cssColor = (value, fallback="#35d07f") => Array.isArray(value) && value.length>=3 ? `rgb(${value.slice(0,3).map(Number).join(",")})` : (value || fallback);
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
const findLeague = (hass, entity) => entity ? hass.states[entity] : findByAttrs(hass, (a) => Array.isArray(a.standings) && Array.isArray(a.scoreboard) && "league_id" in a);

const playerEntity = (hass, id) => findByAttrs(hass, (a) => String(a.player_id) === String(id))?.entity_id;

const statusRank = { final:0, in_progress:1, scheduled:2, bye:3, unknown:4 };
const lineupRank = {0:0,2:1,4:2,6:3,9:4,10:5,14:6,23:7,16:8,17:9,20:90,21:99};
const rosterOrder = (players=[]) => players.map((p,i)=>({p,i})).sort((a,b)=>(lineupRank[a.p.lineup_slot_id]??99)-(lineupRank[b.p.lineup_slot_id]??99)||a.i-b.i).map(x=>x.p);
const teamLogo = (url, name="Team") => {
  const initials=String(name||"Team").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"T";
  const key=String(url||"");
  return `<div class="team-logo-wrap"><div class="team-logo-fallback">${esc(initials)}</div>${key?`<img class="team-logo" src="${esc(key)}" alt="" referrerpolicy="no-referrer" onload="this.classList.add('loaded')" onerror="this.remove()">`:""}</div>`;
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
const injuryVisible = (p) => p.injury_status && !["ACTIVE","NORMAL","HEALTHY"].includes(String(p.injury_status).toUpperCase());
const injuryBadge = (p) => {
  const status=String(p.injury_status||"").trim().toUpperCase().replaceAll(" ","_").replaceAll("-","_");
  const labels={QUESTIONABLE:"Q",DOUBTFUL:"D",OUT:"OUT",OUT_FOR_SEASON:"OUT",INJURED:"OUT",INJURY_RESERVE:"IR",INJURED_RESERVE:"IR",INJURED_RESERVE_DESIGNATED_FOR_RETURN:"IR",IR:"IR",PUP:"PUP",PHYSICALLY_UNABLE_TO_PERFORM:"PUP"};
  const label=labels[status]||(status.includes("QUESTION")?"Q":status.includes("DOUBT")?"D":status.includes("RESERVE")?"IR":status.startsWith("OUT")?"OUT":null);
  return label ? `<span class="injury-badge injury-${esc(label.toLowerCase())}" title="${esc(status.replaceAll("_"," "))}">${esc(label)}</span>` : "";
};

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
  const injury = "";
  const liveHalo = status === "in_progress" && opts.showLiveHalo !== false;
  const haloStyle = liveHalo ? ` style="--live-halo:${esc(cssColor(opts.haloColor))}"` : "";
  return `<div class="player-tile ${esc(status)}" data-player-id="${esc(p.id)}" data-entity="${esc(entity)}">
    <div class="portrait${liveHalo ? " live-halo" : ""}"${haloStyle}>${p.headshot ? `<img src="${esc(p.headshot)}" alt="" loading="lazy">` : ""}${injuryBadge(p)}</div>
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

function outlookDetails(p) {
  const weekly = String(p?.weekly_outlook || "").trim();
  const season = String(p?.season_outlook || "").trim();
  if (!weekly && !season) return "";
  const primary = weekly || season;
  const preview = primary.length > 180 ? `${primary.slice(0,177).trimEnd()}…` : primary;
  const updated = p.last_news_date ? `<div class="outlook-date">Updated ${esc(fmtKickoff(p.last_news_date))}</div>` : "";
  return `<div class="outlook-card"><div class="outlook-heading">Fantasy outlook</div><div class="outlook-preview">${esc(preview)}</div><details class="outlook"><summary>Read full outlook</summary>${updated}${weekly ? `<div class="outlook-title">This week</div><div class="outlook-text">${esc(weekly)}</div>` : ""}${season ? `<div class="outlook-title">Season outlook</div><div class="outlook-text">${esc(season)}</div>` : ""}</details></div>`;
}

function newsDetails(p) {
  const news=Array.isArray(p?.news)?p.news.filter(Boolean):[];
  if(!news.length)return "";
  const rows=news.slice(0,5).map((item)=>{
    const published=item.published?fmtKickoff(item.published):"";
    const headline=String(item.headline||item.description||"Player update").trim();
    const description=item.description&&item.description!==item.headline?String(item.description).trim():"";
    const spin=String(item.spin||"").trim();
    const body=[description?`<div class="news-description">${esc(description)}</div>`:"",spin?`<div class="news-spin"><strong>Fantasy:</strong> ${esc(spin)}</div>`:""].join("");
    const title=item.url?`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(headline)}</a>`:esc(headline);
    return `<article class="news-item"><div class="news-meta">${esc(published)}${item.type?` · ${esc(item.type)}`:""}</div><div class="news-headline">${title}</div>${body}</article>`;
  }).join("");
  return `<div class="news-card"><div class="outlook-heading">Latest news</div>${rows}</div>`;
}
function playerDetails(p, order, opts = {}) {
  return `<div class="player-details">${playerTile(p,opts)}${statGrid(p,order)}${outlookDetails(p)}${newsDetails(p)}</div>`;
}

class ESPNPlayerEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:"open"});this._config={};}
  set hass(v){this._hass=v;const form=this.shadowRoot.querySelector("ha-form");if(form)form.hass=v;else this.render();} get hass(){return this._hass;}
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
      {name:"display",selector:{select:{mode:"dropdown",options:[{value:"compact",label:"Compact"},{value:"expandable",label:"Tap to expand"},{value:"expanded",label:"Always expanded"}]}}},
      {name:"show_live_halo",selector:{boolean:{}}},
      {name:"live_halo_color",selector:{color_rgb:{}}},
      {name:"appearance",selector:{select:{mode:"dropdown",options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},
      {name:"accent_color",selector:{color_rgb:{}}},
      {name:"glass_strength",selector:{select:{mode:"dropdown",options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},
      {name:"border_style",selector:{select:{mode:"dropdown",options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}
    ];
    this.shadowRoot.innerHTML=`<style>:host{display:block}.stats-title{font-weight:600;margin:18px 0 4px}.hint{font-size:12px;color:var(--secondary-text-color);margin-bottom:8px}.row{display:grid;grid-template-columns:minmax(0,1fr) 40px 40px;gap:6px;align-items:center;min-height:42px;border-bottom:1px solid var(--divider-color)}button{border:0;background:var(--secondary-background-color);color:var(--primary-text-color);border-radius:8px;min-height:34px;cursor:pointer}button:disabled{opacity:.35}label{overflow:hidden;text-overflow:ellipsis}</style><ha-form></ha-form><div class="stats-title">Expanded stats</div><div class="hint">Choose the stats to show and use the arrows to set their order.</div>${state?keys.map((k,i)=>`<div class="row"><label><input type="checkbox" data-key="${esc(k)}" ${selected.includes(k)?"checked":""}> ${esc(p.stat_labels[k]||k.replaceAll("_"," "))}</label><button data-dir="-1" data-i="${i}" ${i===0?"disabled":""}>↑</button><button data-dir="1" data-i="${i}" ${i===keys.length-1?"disabled":""}>↓</button></div>`).join(""):'<div class="hint">Select a player entity to configure stats.</div>'}`;
    const form=this.shadowRoot.querySelector("ha-form");form.hass=this.hass;form.data=this._config;form.schema=schema;form.computeLabel=(s)=>({entity:"Player",layout:"Layout",display:"Display mode",show_live_halo:"Show live-player halo",live_halo_color:"Live halo color",appearance:"Appearance",accent_color:"Accent color",glass_strength:"Glass strength",border_style:"Border"}[s.name]||s.name);form.addEventListener("value-changed",(e)=>this.fire({...this._config,...e.detail.value}));
    this.shadowRoot.querySelectorAll("button[data-i]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.i),j=i+Number(b.dataset.dir),next=[...keys];[next[i],next[j]]=[next[j],next[i]];this.fire({...this._config,stats:next.filter(k=>selected.includes(k))});}));
    this.shadowRoot.querySelectorAll("input[data-key]").forEach(x=>x.addEventListener("change",()=>{const next=keys.filter(k=>this.shadowRoot.querySelector(`input[data-key="${CSS.escape(k)}"]`)?.checked);this.fire({...this._config,stats:next});}));
  }
}
if(!customElements.get("espn-fantasy-player-editor"))customElements.define("espn-fantasy-player-editor",ESPNPlayerEditor);

class ESPNBaseCard extends HTMLElement {
  constructor(){ super(); this.attachShadow({mode:"open"}); this._config={}; this._openPlayerId=null; }
  set hass(v){ const old=this._hass; this._hass=v; const id=this._config.entity; if(!old||!this.shadowRoot.hasChildNodes()||(id&&old.states?.[id]!==v.states?.[id]))this.render(); } get hass(){ return this._hass; }
  setConfig(v){ this._config=v || {}; this.render(); }
  getCardSize(){ return 4; }
  getGridOptions(){ return { rows:"auto", columns:12, min_rows:2, min_columns:4 }; }
  bindPlayers(handler){ this.shadowRoot.querySelectorAll(".player-tile[data-player-id]").forEach((n)=>n.addEventListener("click",()=>handler?.(n.dataset.playerId,n.dataset.entity,n))); }
  openPlayer(p, order){ if(!p)return; this._openPlayerId=String(p.id); const dialog=this.shadowRoot.querySelector("dialog.player-dialog"); if(!dialog)return; dialog.querySelector(".dialog-content").innerHTML=playerDetails(p,order,{showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color}); if(!dialog.open)dialog.showModal(); }
  dialog(){ return `<dialog class="player-dialog"><button class="dialog-close" aria-label="Close">×</button><div class="dialog-content"></div></dialog>`; }
  bindDialog(){ const d=this.shadowRoot.querySelector("dialog.player-dialog"); if(!d)return; const close=()=>{this._openPlayerId=null;d.close();}; d.querySelector(".dialog-close")?.addEventListener("click",close); d.addEventListener("click",(e)=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}); d.addEventListener("close",()=>{this._openPlayerId=null;}); }
  restoreDialog(players, order){ if(!this._openPlayerId)return; const p=(players||[]).find(x=>String(x.id)===String(this._openPlayerId)); if(p)this.openPlayer(p,order); else this._openPlayerId=null; }
  appearanceStyles(){const mode=this._config.appearance||"theme",accent=cssColor(this._config.accent_color,"var(--primary-color)"),blur=this._config.glass_strength==="strong"?"18px":"10px",border=this._config.border_style||"theme";return `:host{--espn-accent:${accent}}ha-card{overflow:hidden}${mode==="glass"?`ha-card{background:color-mix(in srgb,var(--ha-card-background,var(--card-background-color)) 58%,transparent)!important;backdrop-filter:blur(${blur});-webkit-backdrop-filter:blur(${blur})}`:""}${mode==="solid"?`ha-card{background:var(--card-background-color)!important;backdrop-filter:none!important}`:""}${mode==="transparent"?`ha-card{background:transparent!important;box-shadow:none!important;backdrop-filter:none!important}`:""}${border==="none"?`ha-card{border:none!important}`:""}${border==="subtle"?`ha-card{border:1px solid color-mix(in srgb,var(--primary-text-color) 14%,transparent)!important}`:""}`; }
  styles(){ return `
    :host{display:block;color:var(--primary-text-color)}${this.appearanceStyles()}.wrap{padding:16px;box-sizing:border-box}
    .header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.title{font-size:20px;font-weight:700}.subtle{font-size:12px;color:var(--secondary-text-color)}
    .player-list{display:grid;gap:7px}.player-tile{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:64px;padding:7px 10px;border-radius:14px;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);cursor:pointer;box-sizing:border-box}
    .portrait{position:relative;width:48px;height:48px;border-radius:50%;background:color-mix(in srgb,var(--primary-text-color) 7%,transparent)}.portrait.live-halo{box-shadow:0 0 0 2px var(--live-halo,#35d07f),0 0 12px 2px var(--live-halo,#35d07f),0 0 22px color-mix(in srgb,var(--live-halo,#35d07f) 55%,transparent)}.portrait img{width:100%;height:100%;object-fit:cover;border-radius:50%}.injury-badge{position:absolute;right:-4px;bottom:-3px;min-width:20px;height:20px;padding:0 4px;box-sizing:border-box;border-radius:999px;display:grid;place-items:center;font-size:9px;font-weight:900;line-height:1;color:#fff;background:var(--warning-color,#f6a623);border:2px solid var(--card-background-color,var(--primary-background-color))}.injury-out,.injury-ir{background:var(--error-color,#db4437)}.player-main{min-width:0}.player-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-meta{font-size:12px;color:var(--secondary-text-color);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .player-score{text-align:right;display:flex;flex-direction:column;gap:2px}.player-score strong{font-size:16px}.player-score span{font-size:11px;color:var(--secondary-text-color)}.badges{display:flex;gap:4px;margin-top:4px}.status,.injury{font-size:9px;font-weight:800;padding:2px 5px;border-radius:999px;background:var(--secondary-background-color)}.status.live{background:var(--error-color);color:white}.status.final{opacity:.75}.injury{background:color-mix(in srgb,var(--warning-color,#f6a623) 25%,transparent);color:var(--primary-text-color)}
    .matchup-shell{position:relative}.matchup-week{text-align:center;font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--secondary-text-color);margin-bottom:8px}.team-head{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:start;text-align:center;margin-bottom:14px}.team-side{display:flex;flex-direction:column;align-items:center}.team-logo-wrap{position:relative;width:58px;height:58px;margin:0 auto 6px}.team-logo,.team-logo-fallback{position:absolute;inset:0;width:58px;height:58px}.team-logo{display:block;object-fit:contain;opacity:0;transition:opacity .12s ease}.team-logo.loaded{opacity:1}.team-logo-fallback{display:grid;place-items:center;border-radius:50%;background:var(--secondary-background-color);font-weight:800;font-size:18px;color:var(--secondary-text-color)}.team-name{font-weight:700}.big-score{font-size:28px;font-weight:800}.projection{font-size:11px;color:var(--secondary-text-color)}.vs{font-size:11px;font-weight:800;color:var(--secondary-text-color);align-self:center}.win-prob{font-size:12px;font-weight:700;margin-top:5px}.starter-progress{width:min(150px,100%);margin-top:7px}.progress-track{height:4px;border-radius:99px;overflow:hidden;background:color-mix(in srgb,var(--primary-text-color) 12%,transparent)}.progress-track span{display:block;height:100%;border-radius:inherit;background:var(--espn-accent,var(--primary-color))}.progress-label{font-size:9px;color:var(--secondary-text-color);margin-top:3px;white-space:nowrap}
    .league-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:20px;font-weight:800;margin-bottom:12px}.league-title span,.league-section-title{font-size:11px;color:var(--secondary-text-color);text-transform:uppercase}.league-section-title{font-weight:800;margin:16px 0 8px}.league-table-head,.league-row{display:grid;grid-template-columns:28px minmax(0,1fr) 62px 58px;gap:8px;align-items:center}.league-table-head{font-size:10px;color:var(--secondary-text-color);padding:0 6px 5px}.league-row{min-height:46px;padding:5px 6px;border-top:1px solid var(--divider-color);font-size:12px}.league-team{display:flex;align-items:center;gap:7px;min-width:0}.league-team .team-logo-wrap,.league-team .team-logo,.league-team .team-logo-fallback{width:30px;height:30px;margin:0}.league-team .team-logo-fallback{font-size:10px}.league-team span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.league-scoreboard{display:grid;gap:8px}.league-game{padding:9px 10px;border-radius:12px;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.league-game-team{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:7px;align-items:center}.league-game-team+.league-game-proj{margin-bottom:6px}.league-game-team .team-logo-wrap,.league-game-team .team-logo,.league-game-team .team-logo-fallback{width:28px;height:28px;margin:0}.league-game-team .team-logo-fallback{font-size:9px}.league-game-team span{font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.league-game-team strong{font-size:16px}.league-game-proj{font-size:9px;color:var(--secondary-text-color);text-align:right;margin-top:-5px}.injury-detail{margin-top:8px;text-align:center;font-size:12px;font-weight:700;color:var(--secondary-text-color)}.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px;margin-top:12px}.stat-cell{padding:10px;min-height:54px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:3px}.stat-cell span{font-size:10px;color:var(--secondary-text-color);text-transform:uppercase}.stat-cell strong{font-size:18px}.player-dialog{width:min(520px,calc(100% - 32px));border:var(--ha-card-border-width,0) solid var(--ha-card-border-color,var(--divider-color));border-radius:var(--ha-card-border-radius,16px);background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color);box-shadow:var(--ha-card-box-shadow);padding:16px}.player-dialog::backdrop{background:rgba(0,0,0,.55);backdrop-filter:blur(3px)}.dialog-close{float:right;border:0;background:transparent;color:var(--primary-text-color);font-size:28px;cursor:pointer}.dialog-content{clear:both}.outlook-card{margin-top:14px;padding:11px 12px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.outlook-heading{font-size:13px;font-weight:800}.outlook-preview{font-size:13px;line-height:1.45;margin-top:5px;color:var(--secondary-text-color)}.outlook{margin-top:8px;border-top:1px solid var(--divider-color);padding-top:8px}.outlook summary{cursor:pointer;font-weight:700}.outlook-date{font-size:11px;color:var(--secondary-text-color);margin:7px 0}.outlook-title{font-size:12px;font-weight:700;margin-top:10px}.outlook-text{font-size:13px;line-height:1.45;margin-top:4px;white-space:pre-wrap}.news-card{margin-top:14px;padding:11px 12px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.news-item{padding:10px 0;border-top:1px solid var(--divider-color)}.news-item:first-of-type{border-top:0}.news-meta{font-size:10px;color:var(--secondary-text-color);text-transform:uppercase}.news-headline{font-size:13px;font-weight:750;line-height:1.35;margin-top:3px}.news-headline a{color:var(--primary-text-color);text-decoration:none}.news-description,.news-spin{font-size:12px;line-height:1.45;margin-top:5px;color:var(--secondary-text-color)}.news-spin strong{color:var(--primary-text-color)}.ticker{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:3px}.ticker .player-tile{min-width:270px;scroll-snap-align:start}.empty{padding:12px;color:var(--secondary-text-color)}
    @media(max-width:600px){.wrap{padding:12px}.player-tile{grid-template-columns:42px minmax(0,1fr) auto}.portrait{width:42px;height:42px}.ticker .player-tile{min-width:240px}.team-head{grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr);gap:4px}.team-logo-wrap,.team-logo,.team-logo-fallback{width:48px;height:48px}.team-name{font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.big-score{font-size:23px}.starter-progress{width:100%}.progress-label{font-size:8px}.win-prob{font-size:11px}}
  `; }
}

class ESPNFantasyPlayerCard extends ESPNBaseCard {
  constructor(){ super(); this._expanded=false; }
  static getStubConfig(){ return {type:"custom:espn-fantasy-player-card",layout:"horizontal",display:"expandable"}; }
  static getConfigElement(){ return document.createElement("espn-fantasy-player-editor"); }

  player(){ const s=this.hass?.states[this._config.entity],a=s?.attributes||{}; return s?{id:a.player_id,name:a.player_name||a.friendly_name,position:a.position,lineup_slot:a.roster_slot,nfl_team:a.nfl_team,headshot:a.headshot,injury_status:a.injury_status,actual_points:a.live_points??a.actual_points??Number(s.state),projected_points:a.projected_points,game_status:a.game_status,game_start:a.game_start,home_away:a.home_away,opponent_abbrev:a.opponent_abbrev,stats:a.stats||{},stat_labels:a.stat_labels||{},default_stats:a.default_stats||[],last_news_date:a.last_news_date,weekly_outlook:a.weekly_outlook,season_outlook:a.season_outlook,news:a.news||[]}:null; }
  render(){ if(!this.hass)return; const p=this.player(),vertical=this._config.layout==="vertical",mode=this._config.display||"expandable",expanded=mode==="expanded"||(mode==="expandable"&&this._expanded); this.shadowRoot.innerHTML=`<style>${this.styles()}${vertical?`.player-tile{grid-template-columns:1fr;text-align:center;justify-items:center}.portrait{width:82px;height:82px}.player-main{width:100%}.player-score{text-align:center}.badges{justify-content:center}`:""}</style><ha-card><div class="wrap">${p?`${playerTile(p,{showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color})}${expanded?`${statGrid(p,this._config.stats)}${outlookDetails(p)}${newsDetails(p)}`:""}`:'<div class="empty">Choose an ESPN Fantasy player entity.</div>'}</div></ha-card>`; if(p&&mode==="expandable")this.bindPlayers(()=>{this._expanded=!this._expanded;this.render();}); }
}

class ESPNFantasyTickerCard extends ESPNBaseCard {
  constructor(){super();this._timer=null;}
  set hass(v){
    const old=this._hass;this._hass=v;const id=this._config.entity;
    if(!old||!this.shadowRoot.querySelector(".ticker"))this.render();
    else if(id&&old.states?.[id]!==v.states?.[id])this.updateTicker();
  }
  get hass(){return this._hass;}
  setConfig(v){if(this._timer){clearInterval(this._timer);this._timer=null;}this._config=v||{};this.render();}
  static getStubConfig(){ return {type:"custom:espn-fantasy-player-ticker-card",show_bench:false,auto_scroll:false,scroll_speed:"normal",frame:true,size:"standard"}; }
  static getConfigForm(){ return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"show_bench",selector:{boolean:{}}},{name:"auto_scroll",selector:{boolean:{}}},{name:"scroll_speed",selector:{select:{options:["slow","normal","fast"]}}},{name:"frame",selector:{boolean:{}}},{name:"size",selector:{select:{options:[{value:"compact",label:"Compact"},{value:"standard",label:"Standard"},{value:"large",label:"Large"},{value:"xl",label:"XL / wall panel"}]}}},{name:"show_live_halo",selector:{boolean:{}}},{name:"live_halo_color",selector:{color_rgb:{}}},{name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},{name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},{name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}]}; }
  getGridOptions(){ return {rows:"auto",columns:12,min_rows:2,min_columns:4}; }
  disconnectedCallback(){if(this._timer){clearInterval(this._timer);this._timer=null;}}
  players(){
    const s=findRoster(this.hass,this._config.entity),a=s?.attributes||{};
    const list=(this._config.show_bench?a.players:a.starters)||[];
    return [...list].sort((x,y)=>(statusRank[x.game_status]??9)-(statusRank[y.game_status]??9));
  }
  bindTickerPlayers(){
    this.bindPlayers((id)=>this.openPlayer(this._players.find(p=>String(p.id)===String(id)),this._config.stats));
  }
  tickerMarkup(players){
    const opts={showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color};
    if(!players.length)return "";
    const items=players.map((p)=>playerTile(p,opts));
    return this._config.auto_scroll&&players.length>1 ? [...items,...items].join("") : items.join("");
  }
  syncTimer(){
    if((!this._config.auto_scroll||this._players.length<=1)&&this._timer){clearInterval(this._timer);this._timer=null;}
    if(this._config.auto_scroll&&this._players.length>1&&!this._timer){
      const ms={slow:5000,normal:3000,fast:1800}[this._config.scroll_speed]||3000;
      this._timer=setInterval(()=>{
        const el=this.shadowRoot.querySelector(".ticker");if(!el)return;
        const tiles=[...el.querySelectorAll(".player-tile")];if(tiles.length<2)return;
        const realCount=this._players.length;
        const leftFor=(tile)=>tile.getBoundingClientRect().left-el.getBoundingClientRect().left+el.scrollLeft;
        let current=tiles.slice(0,realCount).reduce((best,tile,i)=>Math.abs(leftFor(tile)-el.scrollLeft)<Math.abs(leftFor(tiles[best])-el.scrollLeft)?i:best,0);
        if(current===realCount-1){
          const clone=tiles[realCount];
          el.scrollTo({left:leftFor(clone),behavior:"smooth"});
          window.setTimeout(()=>{if(this.shadowRoot.querySelector(".ticker")===el)el.scrollTo({left:leftFor(tiles[0]),behavior:"auto"});},650);
        }else el.scrollTo({left:leftFor(tiles[current+1]),behavior:"smooth"});
      },ms);
    }
  }
  updateTicker(){
    const el=this.shadowRoot.querySelector(".ticker");if(!el){this.render();return;}
    const players=this.players();this._players=players;
    const scroll=el.scrollLeft;
    el.innerHTML=this.tickerMarkup(players);
    el.scrollLeft=scroll;
    this.bindTickerPlayers();
    this.restoreDialog(players,this._config.stats);
    this.syncTimer();
  }
  render(){
    if(!this.hass)return;
    const players=this.players();this._players=players;
    const size=this._config.size||"standard",frameless=this._config.frame===false;
    this.shadowRoot.innerHTML=`<style>${this.styles()}.ticker-card.frameless{background:transparent!important;border:none!important;box-shadow:none!important;backdrop-filter:none!important}.ticker-card.frameless .wrap{padding:0}.ticker-card.size-compact .player-tile{min-width:220px;grid-template-columns:40px minmax(0,1fr) auto;min-height:54px}.ticker-card.size-compact .portrait{width:40px;height:40px}.ticker-card.size-large .player-tile{min-width:340px;grid-template-columns:62px minmax(0,1fr) auto;min-height:82px;padding:10px 14px}.ticker-card.size-large .portrait{width:62px;height:62px}.ticker-card.size-large .player-name{font-size:18px}.ticker-card.size-large .player-score strong{font-size:20px}.ticker-card.size-xl .player-tile{min-width:430px;grid-template-columns:82px minmax(0,1fr) auto;min-height:108px;padding:13px 18px}.ticker-card.size-xl .portrait{width:82px;height:82px}.ticker-card.size-xl .player-name{font-size:22px}.ticker-card.size-xl .player-meta{font-size:14px}.ticker-card.size-xl .player-score strong{font-size:26px}.ticker-card.size-xl .player-score span{font-size:13px}</style><ha-card class="ticker-card size-${esc(size)} ${frameless?"frameless":""}"><div class="wrap">${players.length?`<div class="ticker">${this.tickerMarkup(players)}</div>`:'<div class="empty">No normalized roster data yet.</div>'}</div></ha-card>${this.dialog()}`;
    this.bindTickerPlayers();this.bindDialog();this.restoreDialog(players,this._config.stats);this.syncTimer();
  }
}

function probabilityText(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round((n <= 1 ? n * 100 : n))}%`;
}
function starterProgress(completed, playing, remaining) {
  const c=Number(completed)||0,p=Number(playing)||0,r=Number(remaining)||0,total=c+p+r;
  if(!total)return "";
  return `<div class="starter-progress"><div class="progress-track"><span style="width:${Math.max(0,Math.min(100,((c+p*.5)/total)*100))}%"></span></div><div class="progress-label">${c} done · ${p} live · ${r} left</div></div>`;
}
function matchupHeader(a) {
  const myProb=probabilityText(a.team_win_probability),oppProb=probabilityText(a.opponent_win_probability);
  return `<div class="matchup-shell"><div class="matchup-week">WEEK ${esc(a.current_week)}</div><div class="team-head"><div class="team-side">${teamLogo(a.team_logo,a.team_name)}<div class="team-name">${esc(a.team_name)}</div><div class="big-score">${num(a.team_score,2)}</div><div class="projection">Proj ${num(a.team_live_projected_score??a.team_projected_score)}</div><div class="win-prob">Win ${myProb}</div>${starterProgress(a.team_starters_completed,a.team_starters_playing,a.team_starters_remaining)}</div><div class="vs">VS</div><div class="team-side">${teamLogo(a.opponent_logo,a.opponent_team_name)}<div class="team-name">${esc(a.opponent_team_name)}</div><div class="big-score">${num(a.opponent_score,2)}</div><div class="projection">Proj ${num(a.opponent_live_projected_score??a.opponent_projected_score)}</div><div class="win-prob">Win ${oppProb}</div>${starterProgress(a.opponent_starters_completed,a.opponent_starters_playing,a.opponent_starters_remaining)}</div></div></div>`;
}

function leagueRecord(team) {
  const base=`${Number(team.wins)||0}-${Number(team.losses)||0}`;
  return Number(team.ties) ? `${base}-${Number(team.ties)}` : base;
}
function leagueStandings(teams, limit) {
  const rows=(teams||[]).slice(0,limit||undefined);
  return `<div class="league-standings"><div class="league-table-head"><span>#</span><span>Team</span><span>Record</span><span>PF</span></div>${rows.map((t,i)=>`<div class="league-row"><strong>${esc(t.standing??i+1)}</strong><div class="league-team">${teamLogo(t.logo,t.name)}<span>${esc(t.name)}</span></div><span>${esc(leagueRecord(t))}</span><span>${num(t.points_for)}</span></div>`).join("")}</div>`;
}
function leagueGame(g) {
  return `<div class="league-game"><div class="league-game-team">${teamLogo(g.away_logo,g.away_team_name)}<span>${esc(g.away_team_name||"Away")}</span><strong>${num(g.away_score,2)}</strong></div><div class="league-game-proj">Proj ${num(g.away_projected_score)}</div><div class="league-game-team">${teamLogo(g.home_logo,g.home_team_name)}<span>${esc(g.home_team_name||"Home")}</span><strong>${num(g.home_score,2)}</strong></div><div class="league-game-proj">Proj ${num(g.home_projected_score)}</div></div>`;
}
function leagueScoreboard(games) {
  return `<div class="league-scoreboard">${(games||[]).map(leagueGame).join("")}</div>`;
}

class ESPNFantasyLeagueCard extends ESPNBaseCard {
  constructor(){super();this._leagueView=null;}
  static getStubConfig(){return {type:"custom:espn-fantasy-league-card",display_mode:"standings"};}
  static getConfigForm(){return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"display_mode",selector:{select:{options:[{value:"standings",label:"Standings"},{value:"scoreboard",label:"Scoreboard"},{value:"switchable",label:"Standings / Scoreboard switch"}]}}},{name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},{name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},{name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}]};}
  getGridOptions(){return {rows:"auto",columns:12,min_rows:4,min_columns:4};}
  storageKey(){return `espn-fantasy-league-view:${this._config.entity||"default"}`;}
  currentView(){if((this._config.display_mode||"standings")!=="switchable")return this._config.display_mode||"standings";if(this._leagueView)return this._leagueView;try{this._leagueView=localStorage.getItem(this.storageKey())||"standings";}catch(_){this._leagueView="standings";}return this._leagueView;}
  setView(view){this._leagueView=view;try{localStorage.setItem(this.storageKey(),view);}catch(_){}this.render();}
  render(){
    if(!this.hass)return;
    const s=findLeague(this.hass,this._config.entity),a=s?.attributes||{},standings=a.standings||[],games=a.scoreboard||[];
    const week=a.current_week??a.matchup_period??"—",mode=this._config.display_mode||"standings",view=this.currentView();
    const switcher=mode==="switchable"?`<div class="league-switch"><button data-view="standings" class="${view==="standings"?"active":""}">Standings</button><button data-view="scoreboard" class="${view==="scoreboard"?"active":""}">Scoreboard</button></div>`:"";
    const body=view==="scoreboard"?`<div class="league-section-title">Week ${esc(week)} scoreboard</div>${games.length?leagueScoreboard(games):'<div class="empty">No scoreboard data yet.</div>'}`:`<div class="league-section-title">Standings · ${esc(a.team_count||standings.length)} teams</div>${standings.length?leagueStandings(standings):'<div class="empty">No standings data yet.</div>'}`;
    this.shadowRoot.innerHTML=`<style>${this.styles()}.league-switch{display:flex;gap:4px;margin:0 0 10px}.league-switch button{border:1px solid var(--divider-color);border-radius:999px;padding:5px 10px;background:transparent;color:var(--secondary-text-color);cursor:pointer}.league-switch button.active{background:color-mix(in srgb,var(--espn-accent,var(--primary-color)) 18%,transparent);color:var(--primary-text-color);border-color:var(--espn-accent,var(--primary-color))}</style><ha-card><div class="wrap"><div class="league-title"><strong>${esc(s?.state||"Fantasy League")}</strong><span>Week ${esc(week)}</span></div>${switcher}${body}</div></ha-card>`;
    this.shadowRoot.querySelectorAll(".league-switch button").forEach(b=>b.addEventListener("click",()=>this.setView(b.dataset.view)));
  }
}
class ESPNFantasyLeagueTickerCard extends ESPNBaseCard {
  constructor(){super();this._timer=null;}
  set hass(v){const old=this._hass;this._hass=v;const id=this._config.entity;if(!old||!this.shadowRoot.querySelector(".league-ticker"))this.render();else if(id&&old.states?.[id]!==v.states?.[id])this.updateTicker();}
  get hass(){return this._hass;}
  setConfig(v){if(this._timer){clearInterval(this._timer);this._timer=null;}this._config=v||{};this.render();}
  static getStubConfig(){return {type:"custom:espn-fantasy-league-ticker-card",auto_scroll:true,scroll_speed:"normal",frame:true};}
  static getConfigForm(){return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"auto_scroll",selector:{boolean:{}}},{name:"scroll_speed",selector:{select:{options:["slow","normal","fast"]}}},{name:"frame",selector:{boolean:{}}},{name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},{name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},{name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}]};}
  getGridOptions(){return {rows:"auto",columns:12,min_rows:2,min_columns:4};}
  disconnectedCallback(){if(this._timer){clearInterval(this._timer);this._timer=null;}}
  games(){return (findLeague(this.hass,this._config.entity)?.attributes?.scoreboard)||[];}
  markup(games){return (games||[]).map(leagueGame).join("");}
  syncTimer(){
    if((!this._config.auto_scroll||this._games.length<=1)&&this._timer){clearInterval(this._timer);this._timer=null;}
    if(this._config.auto_scroll&&this._games.length>1&&!this._timer){
      const ms={slow:6000,normal:4000,fast:2500}[this._config.scroll_speed]||4000;
      this._timer=setInterval(()=>{
        const el=this.shadowRoot.querySelector(".league-ticker");if(!el)return;
        const items=[...el.querySelectorAll(".league-game")];if(!items.length)return;
        const left=x=>x.getBoundingClientRect().left-el.getBoundingClientRect().left+el.scrollLeft;
        const cur=items.reduce((b,x,i)=>Math.abs(left(x)-el.scrollLeft)<Math.abs(left(items[b])-el.scrollLeft)?i:b,0);
        el.scrollTo({left:left(items[(cur+1)%items.length]),behavior:(cur===items.length-1?"auto":"smooth")});
      },ms);
    }
  }
  updateTicker(){
    const el=this.shadowRoot.querySelector(".league-ticker");if(!el){this.render();return;}
    const games=this.games(),scroll=el.scrollLeft;this._games=games;el.innerHTML=this.markup(games);el.scrollLeft=scroll;this.syncTimer();
  }
  render(){
    if(!this.hass)return;
    const games=this.games();this._games=games;const frameless=this._config.frame===false;
    this.shadowRoot.innerHTML=`<style>${this.styles()}.league-ticker{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity}.league-ticker .league-game{min-width:270px;scroll-snap-align:start;box-sizing:border-box}.league-ticker-card.frameless{background:transparent!important;border:none!important;box-shadow:none!important;backdrop-filter:none!important}.league-ticker-card.frameless .wrap{padding:0}</style><ha-card class="league-ticker-card ${frameless?"frameless":""}"><div class="wrap">${games.length?`<div class="league-ticker">${this.markup(games)}</div>`:'<div class="empty">No league matchups yet.</div>'}</div></ha-card>`;this.syncTimer();
  }
}
class ESPNFantasyNewsCard extends ESPNBaseCard {
  static getStubConfig(){return {type:"custom:espn-fantasy-news-card",story_count:5};}
  static getConfigForm(){return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"story_count",selector:{number:{min:1,max:20,mode:"box"}}},{name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},{name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},{name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}]};}
  getGridOptions(){return {rows:"auto",columns:12,min_rows:3,min_columns:4};}
  stories(){
    const s=findRoster(this.hass,this._config.entity),players=s?.attributes?.players||[];
    return players.flatMap((p)=>(Array.isArray(p.news)?p.news:[]).map((item)=>({p,item}))).sort((a,b)=>new Date(b.item.published||0)-new Date(a.item.published||0)).slice(0,Math.max(1,Number(this._config.story_count)||5));
  }
  render(){
    if(!this.hass)return;
    const stories=this.stories();
    const rows=stories.map(({p,item})=>{const headline=String(item.headline||item.description||"Player update").trim(),description=item.description&&item.description!==item.headline?String(item.description).trim():"",spin=String(item.spin||"").trim(),published=item.published?fmtKickoff(item.published):"",title=item.url?`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(headline)}</a>`:esc(headline);return `<article class="feed-story"><div class="feed-player"><div class="portrait">${p.headshot?`<img src="${esc(p.headshot)}" alt="" loading="lazy">`:""}</div><div><div class="player-name">${esc(p.name)}</div><div class="player-meta">${esc([p.position,p.nfl_team].filter(Boolean).join(" · "))}</div></div></div><div class="news-meta">${esc(published)}${item.type?` · ${esc(item.type)}`:""}</div><div class="news-headline">${title}</div>${description?`<div class="news-description">${esc(description)}</div>`:""}${spin?`<div class="news-spin"><strong>Fantasy:</strong> ${esc(spin)}</div>`:""}</article>`;}).join("");
    this.shadowRoot.innerHTML=`<style>${this.styles()}.news-feed{display:grid;gap:10px}.feed-story{padding:12px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.feed-player{display:flex;align-items:center;gap:10px;margin-bottom:10px}.feed-player .portrait{width:48px;height:48px;flex:0 0 48px}.feed-story+.feed-story{margin-top:2px}</style><ha-card><div class="wrap"><div class="header"><div class="title">Fantasy news</div><div class="subtle">Newest ${stories.length}</div></div>${stories.length?`<div class="news-feed">${rows}</div>`:'<div class="empty">No player news available yet.</div>'}</div></ha-card>`;
  }
}

class ESPNFantasyMatchupCard extends ESPNBaseCard {
  static getStubConfig(){return {type:"custom:espn-fantasy-matchup-card"};}
  static getConfigForm(){return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},{name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},{name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}]};}
  getGridOptions(){return {rows:"auto",columns:12,min_rows:2,min_columns:4};}
  render(){if(!this.hass)return;const s=findMatchup(this.hass,this._config.entity),a=s?.attributes||{};this.shadowRoot.innerHTML=`<style>${this.styles()}</style><ha-card><div class="wrap">${s?matchupHeader(a):'<div class="empty">Choose an ESPN Fantasy matchup entity.</div>'}</div></ha-card>`;}
}

class ESPNFantasyTeamCard extends ESPNBaseCard {
  static getStubConfig(){ return {type:"custom:espn-fantasy-team-card",mode:"single",show_bench:false,show_live_halo:true}; }
  static getConfigForm(){ return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"mode",selector:{select:{options:["single","matchup"]}}},{name:"show_bench",selector:{boolean:{}}},{name:"show_live_halo",selector:{boolean:{}}},{name:"live_halo_color",selector:{color_rgb:{}}},{name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},{name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},{name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}]}; }
  getGridOptions(){ return {rows:"auto",columns:12,min_rows:4,min_columns:4}; }
  render(){if(!this.hass)return; const mode=this._config.mode||"single"; let players=[],html=""; if(mode==="matchup"){const s=findMatchup(this.hass,this._config.entity),a=s?.attributes||{}; const mine=rosterOrder((this._config.show_bench?a.my_players:a.my_roster)||[]),opp=rosterOrder((this._config.show_bench?a.opponent_players:a.opponent_roster)||[]);players=[...mine,...opp];let rows="";for(let i=0;i<Math.max(mine.length,opp.length);i++)rows+=`<div class="match-row">${mine[i]?playerTile(mine[i],{showSlot:this._config.show_bench,showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color}):"<div></div>"}${opp[i]?playerTile(opp[i],{showSlot:this._config.show_bench,showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color}):"<div></div>"}</div>`;html=`${matchupHeader(a)}${rows}`;}else{const s=findRoster(this.hass,this._config.entity),a=s?.attributes||{};players=rosterOrder((this._config.show_bench?a.players:a.starters)||[]);html=`<div class="team-head single"><div class="team-side">${teamLogo(a.team_logo,a.team_name)}<div class="team-name">${esc(a.team_name)}</div><div class="big-score">${num(a.score,2)}</div><div class="projection">Proj ${num(a.live_projected_score??a.projected_score)}</div></div></div><div class="player-list">${players.map(p=>playerTile(p,{showSlot:this._config.show_bench,showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color})).join("")}</div>`;}this._players=players;this.shadowRoot.innerHTML=`<style>${this.styles()}.team-head.single{grid-template-columns:1fr}.match-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}@media(max-width:600px){.match-row{grid-template-columns:1fr 1fr;gap:5px}.match-row .player-tile{grid-template-columns:36px minmax(0,1fr);padding:6px}.match-row .portrait{width:36px;height:36px}.match-row .player-score{grid-column:2;text-align:left}}</style><ha-card><div class="wrap">${html}</div></ha-card>${this.dialog()}`;this.bindPlayers((id)=>this.openPlayer(players.find(p=>String(p.id)===String(id)),this._config.stats));this.bindDialog();this.restoreDialog(players,this._config.stats);}
}

for(const [tag,cls] of [["espn-fantasy-player-card",ESPNFantasyPlayerCard],["espn-fantasy-player-ticker-card",ESPNFantasyTickerCard],["espn-fantasy-team-card",ESPNFantasyTeamCard],["espn-fantasy-matchup-card",ESPNFantasyMatchupCard],["espn-fantasy-league-card",ESPNFantasyLeagueCard],["espn-fantasy-league-ticker-card",ESPNFantasyLeagueTickerCard],["espn-fantasy-news-card",ESPNFantasyNewsCard]]) if(!customElements.get(tag)) customElements.define(tag,cls);
window.customCards=window.customCards||[];
for(const card of [
 {type:"espn-fantasy-player-card",name:"ESPN Fantasy Player",description:"Responsive player card using normalized ESPN Fantasy data.",preview:true},
 {type:"espn-fantasy-player-ticker-card",name:"ESPN Fantasy Player Ticker",description:"Final, live, and upcoming starters in a swipeable ticker.",preview:true},
 {type:"espn-fantasy-team-card",name:"ESPN Fantasy Team",description:"Single-team or head-to-head matchup card with player details.",preview:true},
 {type:"espn-fantasy-matchup-card",name:"ESPN Fantasy Matchup",description:"Compact fantasy matchup scoreboard with scores and projections.",preview:true},
 {type:"espn-fantasy-league-card",name:"ESPN Fantasy League",description:"League standings with the current fantasy scoreboard.",preview:true},
 {type:"espn-fantasy-league-ticker-card",name:"ESPN Fantasy League Ticker",description:"Swipeable current-week league matchup ticker.",preview:true},
 {type:"espn-fantasy-news-card",name:"ESPN Fantasy News",description:"Newest fantasy player stories with player portraits and names.",preview:true},
]) if(!window.customCards.some((x)=>x.type===card.type)) window.customCards.push({...card,documentationURL:"https://github.com/sutty-2017/ha-espn-fantasy"});
console.info(`%c ESPN Fantasy cards ${CARD_VERSION} loaded`,"color:#e31837;font-weight:bold;");

