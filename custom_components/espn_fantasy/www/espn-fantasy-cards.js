const CARD_VERSION = "0.1.15";

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
const showMore = (el, entityId) => entityId && el.dispatchEvent(new CustomEvent("hass-more-info", { bubbles:true, composed:true, detail:{ entityId } }));
const playerEntity = (hass, id) => findByAttrs(hass, (a) => String(a.player_id) === String(id))?.entity_id;

const statusRank = { final:0, in_progress:1, scheduled:2, bye:3, unknown:4 };
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
  const meta = [p.position, p.nfl_team, opponentText(p)].filter(Boolean).join(" · ");
  const badge = status === "in_progress" ? '<span class="status live">LIVE</span>' :
    status === "final" ? '<span class="status final">FINAL</span>' :
    status === "bye" ? '<span class="status">BYE</span>' : "";
  const injury = injuryVisible(p) ? `<span class="injury">${esc(p.injury_status)}</span>` : "";
  return `<div class="player-tile ${esc(status)}" data-entity="${esc(entity)}">
    <div class="portrait">${p.headshot ? `<img src="${esc(p.headshot)}" alt="" loading="lazy">` : ""}</div>
    <div class="player-main"><div class="player-name">${esc(p.name)}</div><div class="player-meta">${esc(meta)}</div><div class="badges">${badge}${injury}</div></div>
    <div class="player-score"><strong>${esc(primary)}</strong><span>${esc(projection)}</span></div>
  </div>`;
}

class ESPNBaseCard extends HTMLElement {
  constructor(){ super(); this.attachShadow({mode:"open"}); this._config={}; }
  set hass(v){ this._hass=v; this.render(); } get hass(){ return this._hass; }
  setConfig(v){ this._config=v || {}; this.render(); }
  getCardSize(){ return 4; }
  getGridOptions(){ return { rows:"auto", columns:12, min_rows:2, min_columns:4 }; }
  bindPlayers(){ this.shadowRoot.querySelectorAll(".player-tile[data-entity]").forEach((n)=>n.addEventListener("click",()=>showMore(this,n.dataset.entity))); }
  styles(){ return `
    :host{display:block}ha-card{overflow:hidden}.wrap{padding:16px;box-sizing:border-box}
    .header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.title{font-size:20px;font-weight:700}.subtle{font-size:12px;color:var(--secondary-text-color)}
    .player-list{display:grid;gap:7px}.player-tile{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:64px;padding:7px 10px;border-radius:14px;background:color-mix(in srgb,var(--card-background-color) 92%,var(--primary-text-color) 8%);cursor:pointer;box-sizing:border-box}
    .portrait{width:48px;height:48px;border-radius:50%;overflow:hidden;background:var(--secondary-background-color)}.portrait img{width:100%;height:100%;object-fit:cover}.player-main{min-width:0}.player-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-meta{font-size:12px;color:var(--secondary-text-color);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .player-score{text-align:right;display:flex;flex-direction:column;gap:2px}.player-score strong{font-size:16px}.player-score span{font-size:11px;color:var(--secondary-text-color)}.badges{display:flex;gap:4px;margin-top:4px}.status,.injury{font-size:9px;font-weight:800;padding:2px 5px;border-radius:999px;background:var(--secondary-background-color)}.status.live{background:var(--error-color);color:white}.status.final{opacity:.75}.injury{background:color-mix(in srgb,var(--warning-color,#f6a623) 25%,transparent);color:var(--primary-text-color)}
    .team-head{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:start;text-align:center;margin-bottom:14px}.team-side{display:flex;flex-direction:column;align-items:center}.team-logo{display:block;width:58px;height:58px;object-fit:contain;margin:0 auto 6px}.team-name{font-weight:700}.big-score{font-size:28px;font-weight:800}.projection{font-size:11px;color:var(--secondary-text-color)}.vs{font-size:11px;font-weight:800;color:var(--secondary-text-color)}
    .ticker{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:3px}.ticker .player-tile{min-width:270px;scroll-snap-align:start}.empty{padding:12px;color:var(--secondary-text-color)}
    @media(max-width:600px){.wrap{padding:12px}.player-tile{grid-template-columns:42px minmax(0,1fr) auto}.portrait{width:42px;height:42px}.ticker .player-tile{min-width:240px}.big-score{font-size:23px}}
  `; }
}

class ESPNFantasyPlayerCard extends ESPNBaseCard {
  static getStubConfig(){ return {type:"custom:espn-fantasy-player-card",layout:"horizontal"}; }
  static getConfigForm(){ return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"layout",selector:{select:{options:["horizontal","vertical"]}}}]}; }
  render(){ if(!this.hass)return; const s=this.hass.states[this._config.entity]; const a=s?.attributes||{}; const p={id:a.player_id,name:a.player_name||s?.attributes?.friendly_name,position:a.position,lineup_slot:a.roster_slot,nfl_team:a.nfl_team,headshot:a.headshot,injury_status:a.injury_status,actual_points:a.live_points??a.actual_points??Number(s?.state),projected_points:a.projected_points,game_status:a.game_status,game_start:a.game_start,home_away:a.home_away,opponent_abbrev:a.opponent_abbrev}; const vertical=this._config.layout==="vertical"; this.shadowRoot.innerHTML=`<style>${this.styles()}${vertical?`.player-tile{grid-template-columns:1fr;text-align:center;justify-items:center}.portrait{width:82px;height:82px}.player-main{width:100%}.player-score{text-align:center}.badges{justify-content:center}`:""}</style><ha-card><div class="wrap">${s?playerTile(p,{entity:s.entity_id}):'<div class="empty">Choose an ESPN Fantasy player entity.</div>'}</div></ha-card>`; this.bindPlayers(); }
}

class ESPNFantasyTickerCard extends ESPNBaseCard {
  static getStubConfig(){ return {type:"custom:espn-fantasy-player-ticker-card",show_bench:false}; }
  static getConfigForm(){ return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"show_bench",selector:{boolean:{}}}]}; }
  getGridOptions(){ return {rows:"auto",columns:12,min_rows:2,min_columns:4}; }
  render(){ if(!this.hass)return; const s=findRoster(this.hass,this._config.entity),a=s?.attributes||{}; let players=(this._config.show_bench?a.players:a.starters)||[]; players=[...players].sort((x,y)=>(statusRank[x.game_status]??9)-(statusRank[y.game_status]??9)); this.shadowRoot.innerHTML=`<style>${this.styles()}</style><ha-card><div class="wrap"><div class="header"><div class="subtle">${esc(a.team_name||"ESPN Fantasy")}</div></div>${players.length?`<div class="ticker">${players.map((p)=>playerTile(p,{entity:playerEntity(this.hass,p.id)})).join("")}</div>`:'<div class="empty">No normalized roster data yet.</div>'}</div></ha-card>`; this.bindPlayers(); }
}

class ESPNFantasyRosterCard extends ESPNBaseCard {
  static getStubConfig(){ return {type:"custom:espn-fantasy-roster-card",show_bench:false,density:"comfortable"}; }
  static getConfigForm(){ return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"show_bench",selector:{boolean:{}}},{name:"density",selector:{select:{options:["compact","comfortable"]}}}]}; }
  getGridOptions(){ return {rows:"auto",columns:6,min_rows:4,min_columns:4}; }
  render(){ if(!this.hass)return; const s=findRoster(this.hass,this._config.entity),a=s?.attributes||{}; const players=(this._config.show_bench?a.players:a.starters)||[]; const stats=[a.starters_completed!=null?`${a.starters_completed} final`:"",a.starters_playing?`${a.starters_playing} live`:"",a.starters_remaining?`${a.starters_remaining} left`:""].filter(Boolean).join(" · "); this.shadowRoot.innerHTML=`<style>${this.styles()}</style><ha-card><div class="wrap"><div class="header"><div class="subtle">${esc(stats)}</div><div class="player-score"><strong>${num(a.score,2)}</strong><span>Proj ${num(a.live_projected_score??a.projected_score)}</span></div></div><div class="player-list">${players.map((p)=>playerTile(p,{entity:playerEntity(this.hass,p.id)})).join("")||'<div class="empty">No normalized roster data yet.</div>'}</div></div></ha-card>`; this.bindPlayers(); }
}

class ESPNFantasyMatchupCard extends ESPNBaseCard {
  static getStubConfig(){ return {type:"custom:espn-fantasy-matchup-card"}; }
  static getConfigForm(){ return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}}]}; }
  getGridOptions(){ return {rows:"auto",columns:12,min_rows:5,min_columns:6}; }
  render(){ if(!this.hass)return; const s=findMatchup(this.hass,this._config.entity),a=s?.attributes||{}; if(!s){this.shadowRoot.innerHTML=`<style>${this.styles()}</style><ha-card><div class="wrap"><div class="empty">Choose the ESPN Fantasy Matchup entity.</div></div></ha-card>`;return;} const mine=a.my_roster||[],opp=a.opponent_roster||[]; const rows=Math.max(mine.length,opp.length); let roster=""; for(let i=0;i<rows;i++){roster+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">${mine[i]?playerTile(mine[i],{entity:playerEntity(this.hass,mine[i].id)}):"<div></div>"}${opp[i]?playerTile(opp[i],{entity:playerEntity(this.hass,opp[i].id)}):"<div></div>"}</div>`;} this.shadowRoot.innerHTML=`<style>${this.styles()}</style><ha-card><div class="wrap"><div class="team-head"><div class="team-side">${a.team_logo?`<img class="team-logo" src="${esc(a.team_logo)}">`:""}<div class="team-name">${esc(a.team_name)}</div><div class="big-score">${num(a.team_score,2)}</div><div class="projection">Live proj ${num(a.team_live_projected_score??a.team_projected_score)}</div></div><div class="vs">VS<br>WEEK ${esc(a.current_week)}</div><div class="team-side">${a.opponent_logo?`<img class="team-logo" src="${esc(a.opponent_logo)}">`:""}<div class="team-name">${esc(a.opponent_team_name)}</div><div class="big-score">${num(a.opponent_score,2)}</div><div class="projection">Live proj ${num(a.opponent_live_projected_score??a.opponent_projected_score)}</div></div></div>${roster}</div></ha-card>`; this.bindPlayers(); }
}

for(const [tag,cls] of [["espn-fantasy-player-card",ESPNFantasyPlayerCard],["espn-fantasy-player-ticker-card",ESPNFantasyTickerCard],["espn-fantasy-roster-card",ESPNFantasyRosterCard],["espn-fantasy-matchup-card",ESPNFantasyMatchupCard]]) if(!customElements.get(tag)) customElements.define(tag,cls);
window.customCards=window.customCards||[];
for(const card of [
 {type:"espn-fantasy-player-card",name:"ESPN Fantasy Player",description:"Responsive player card using normalized ESPN Fantasy data.",preview:true},
 {type:"espn-fantasy-player-ticker-card",name:"ESPN Fantasy Player Ticker",description:"Final, live, and upcoming starters in a swipeable ticker.",preview:true},
 {type:"espn-fantasy-roster-card",name:"ESPN Fantasy Roster",description:"Responsive roster built from reusable player cards.",preview:true},
 {type:"espn-fantasy-matchup-card",name:"ESPN Fantasy Matchup",description:"Head-to-head matchup using the same player-card component.",preview:true},
]) if(!window.customCards.some((x)=>x.type===card.type)) window.customCards.push({...card,documentationURL:"https://github.com/sutty-2017/ha-espn-fantasy"});
console.info(`%c ESPN Fantasy cards ${CARD_VERSION} loaded`,"color:#e31837;font-weight:bold;");
