const CARD_VERSION = "0.1.9";
const PLAYER_PREFIX = "sensor.espn_fantasy_";
const GAME_PREFIX = "binary_sensor.espn_fantasy_";
const MATCHUP_PREFIX = "sensor.espn_fantasy_";
const ROSTER_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "D/ST", "Bench", "IR"];
const STARTER_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "D/ST"];

const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[char]));

const number = (value, digits = 1) => {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : esc(value);
};

const states = (hass) => Object.values(hass.states || {});
const playerStates = (hass, config = {}) => {
  let result = states(hass).filter((state) =>
    state.entity_id.startsWith(PLAYER_PREFIX) && state.attributes?.player_id !== undefined
  );
  if (config.entity) {
    const selected = hass.states[config.entity];
    if (selected?.attributes?.player_id !== undefined) {
      const id = String(selected.attributes.player_id);
      result = result.filter((state) => String(state.attributes.player_id) === id ||
        state.entity_id.startsWith(config.entity.replace(/_player_\d+$/, "_")));
    }
  }
  return result;
};

const findPlayer = (hass, id) => states(hass).find((state) =>
  state.entity_id.startsWith(PLAYER_PREFIX) && String(state.attributes?.player_id) === String(id)
);
const findLive = (hass, id) => states(hass).find((state) =>
  state.entity_id.startsWith(GAME_PREFIX) && String(state.attributes?.player_id) === String(id)
);
const findMatchup = (hass, config = {}) => {
  if (config.entity && hass.states[config.entity]?.attributes?.my_roster) {
    return hass.states[config.entity];
  }
  return states(hass).find((state) =>
    state.entity_id.startsWith(MATCHUP_PREFIX) &&
    state.attributes?.my_roster &&
    state.attributes?.opponent_roster
  );
};

const playerName = (state) => {
  const a = state?.attributes || {};
  if (a.player_name) return a.player_name;
  const friendly = a.friendly_name || state?.name || "";
  return friendly.replace(/^ESPN Fantasy\s+\S+\s+/, "") || friendly || state?.entity_id || "Player";
};

const playerImage = (state) => {
  const a = state?.attributes || {};
  if (String(a.position) === "D/ST" && a.nfl_team) {
    return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/${encodeURIComponent(a.nfl_team)}.png`;
  }
  return a.headshot || null;
};

const showMoreInfo = (element, entityId) => element.dispatchEvent(new CustomEvent("hass-more-info", {
  bubbles: true, composed: true, detail: { entityId },
}));

class ESPNBaseCard extends HTMLElement {
  constructor() {
    super(); this.attachShadow({ mode: "open" }); this._hass = undefined; this._config = {};
  }
  set hass(value) { this._hass = value; this.render(); }
  get hass() { return this._hass; }
  setConfig(config) { this._config = config || {}; this.render(); }
  getCardSize() { return 4; }
  getGridOptions() { return { rows: 6, columns: 12, min_rows: 3, max_rows: 12 }; }
  baseStyles() {
    return `
      :host{display:block}ha-card{overflow:hidden}.wrap{padding:16px}.title{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:600;margin-bottom:14px}.title-icon{font-size:22px}
      .grid{display:grid;grid-template-columns:repeat(var(--columns,4),minmax(0,1fr));gap:10px}.section{margin-top:16px}.section:first-of-type{margin-top:0}.section-title{font-size:13px;font-weight:700;opacity:.75;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px}
      .player{position:relative;display:grid;grid-template-columns:52px 1fr;gap:10px;align-items:center;min-height:70px;padding:9px;border-radius:14px;background:var(--ha-card-background,var(--card-background-color));border:1px solid var(--divider-color);cursor:pointer;box-sizing:border-box}.photo{width:52px;height:52px;border-radius:50%;object-fit:cover;background:var(--secondary-background-color)}.name{font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{font-size:12px;opacity:.72;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.points{font-size:17px;font-weight:700;margin-top:5px}.badge{position:absolute;top:7px;right:7px;padding:2px 6px;border-radius:999px;font-size:10px;font-weight:800;background:var(--error-color);color:white}.empty{opacity:.65;padding:8px 0}
      .matchup-head{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;text-align:center;margin-bottom:18px}.team-name{font-weight:700;font-size:15px}.score{font-size:30px;font-weight:800;margin-top:4px}.projected{font-size:12px;opacity:.65}.versus{font-size:12px;font-weight:800;opacity:.55}.battle{display:grid;grid-template-columns:1fr 62px 1fr;gap:8px;align-items:center;padding:9px 0;border-top:1px solid var(--divider-color)}.battle:first-child{border-top:0}.battle-side{min-width:0}.battle-side.right{text-align:right}.battle-name{font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.battle-meta{font-size:11px;opacity:.65}.battle-points{font-size:16px;font-weight:750}.slot{text-align:center;font-size:11px;font-weight:800;opacity:.65}.advantage{text-align:center;font-size:11px;font-weight:750}.positive{color:var(--success-color)}.negative{color:var(--error-color)}.status{text-align:center;font-weight:750;margin:10px 0}.compact-row{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--divider-color)}.compact-row:first-child{border-top:0}
      @media(max-width:600px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.matchup-head{gap:5px}.score{font-size:24px}.battle{grid-template-columns:1fr 48px 1fr}}
    `;
  }
}

class ESPNFantasyRosterCard extends ESPNBaseCard {
  static getStubConfig(){return {type:"custom:espn-fantasy-roster-card"};}
  static getConfigForm(){return {schema:[{name:"entity",selector:{entity:{domain:"sensor"}}},{name:"columns",selector:{number:{min:1,max:6,mode:"box"}}}]};}
  getCardSize(){return 8;}
  render(){
    if(!this.shadowRoot||!this.hass)return;
    const cols=Math.max(1,Math.min(6,Number(this._config.columns||4))), grouped=Object.fromEntries(ROSTER_ORDER.map((s)=>[s,[]]));
    playerStates(this.hass,this._config).forEach((s)=>{const slot=s.attributes?.roster_slot||"Bench";(grouped[slot] ||= []).push(s);});
    const sections=ROSTER_ORDER.filter((s)=>grouped[s]?.length).map((slot)=>`<section class="section"><div class="section-title">${esc(slot)}</div><div class="grid" style="--columns:${cols}">${grouped[slot].map((s)=>this.player(s)).join("")}</div></section>`).join("");
    const matchup=findMatchup(this.hass,this._config); const ma=matchup?.attributes;
    const header=ma?`<div class="matchup-head"><div><div class="team-name">${esc(ma.team_name)}</div><div class="score">${number(ma.team_score,2)}</div></div><div class="versus">VS<br>WEEK ${esc(ma.current_week)}</div><div><div class="team-name">${esc(ma.opponent_team_name)}</div><div class="score">${number(ma.opponent_score,2)}</div></div></div>${ma.next_opponent_team_name?`<div class="projected">Next matchup: ${esc(ma.next_opponent_team_name)}</div>`:""}`:"";
    this.shadowRoot.innerHTML=`<style>${this.baseStyles()}</style><ha-card><div class="wrap"><div class="title"><span class="title-icon">🏈</span><span>ESPN Fantasy Roster</span></div>${header}${sections||'<div class="empty">No ESPN Fantasy player sensors found.</div>'}</div></ha-card>`;
    this.shadowRoot.querySelectorAll(".player").forEach((n)=>n.addEventListener("click",()=>showMoreInfo(this,n.dataset.entity)));
  }
  player(state){const a=state.attributes||{},live=findLive(this.hass,a.player_id)?.state==="on",meta=[a.position,a.nfl_team,a.opponent?`vs ${a.opponent}`:""] .filter(Boolean).join(" · "),pts=live&&a.live_points!=null?`${number(a.live_points)} live`:`${number(state.state)} pts`,proj=a.projected_points!=null?` · ${number(a.projected_points)} proj`:"",image=playerImage(state);return `<div class="player" data-entity="${esc(state.entity_id)}">${image?`<img class="photo" src="${esc(image)}" alt="" loading="lazy">`:'<div class="photo"></div>'}<div><div class="name">${esc(playerName(state))}</div><div class="meta">${esc(meta||"ESPN Fantasy")}</div><div class="points">${esc(pts)}${esc(proj)}</div></div>${live?'<span class="badge">LIVE</span>':""}</div>`;}
}

class ESPNFantasyLiveCard extends ESPNBaseCard {
  static getStubConfig(){return {type:"custom:espn-fantasy-live-card"};}
  static getConfigForm(){return {schema:[{name:"entity",selector:{entity:{domain:"binary_sensor"}}},{name:"columns",selector:{number:{min:1,max:6,mode:"box"}}}]};}
  render(){if(!this.shadowRoot||!this.hass)return;const live=states(this.hass).filter((s)=>s.entity_id.startsWith(GAME_PREFIX)&&s.entity_id.endsWith("_game_active")&&s.state==="on"),cols=Math.max(1,Math.min(6,Number(this._config.columns||3))),players=live.map((s)=>findPlayer(this.hass,s.attributes?.player_id)).filter(Boolean);this.shadowRoot.innerHTML=`<style>${this.baseStyles()}</style><ha-card><div class="wrap"><div class="title"><span class="title-icon">🔴</span><span>ESPN Fantasy Live</span></div>${players.length?`<div class="grid" style="--columns:${cols}">${players.map((s)=>this.player(s)).join("")}</div>`:'<div class="empty">No rostered players are live right now.</div>'}</div></ha-card>`;this.shadowRoot.querySelectorAll(".player").forEach((n)=>n.addEventListener("click",()=>showMoreInfo(this,n.dataset.entity)));}
  player(state){const a=state.attributes||{},game=findLive(this.hass,a.player_id),ga=game?.attributes||{},points=ga.live_points??a.live_points??state.state,meta=[a.position,a.nfl_team,a.opponent?`vs ${a.opponent}`:""] .filter(Boolean).join(" · "),image=playerImage(state);return `<div class="player" data-entity="${esc(state.entity_id)}">${image?`<img class="photo" src="${esc(image)}" alt="" loading="lazy">`:'<div class="photo"></div>'}<div><div class="name">${esc(playerName(state))}</div><div class="meta">${esc(meta||"ESPN Fantasy")}</div><div class="points">${number(points)} pts</div></div><span class="badge">LIVE</span></div>`;}
}

class ESPNFantasyMatchupCard extends ESPNBaseCard {
  static getStubConfig(){return {type:"custom:espn-fantasy-matchup-card"};}
  static getConfigForm(){return {schema:[{name:"entity",selector:{entity:{domain:"sensor"}}}]};}
  getCardSize(){return 10;}
  render(){
    if(!this.shadowRoot||!this.hass)return; const state=findMatchup(this.hass,this._config),a=state?.attributes;
    if(!a){this.shadowRoot.innerHTML=`<style>${this.baseStyles()}</style><ha-card><div class="wrap"><div class="title">🏆 <span>ESPN Fantasy Matchup</span></div><div class="empty">No matchup data is available yet.</div></div></ha-card>`;return;}
    const mine=a.my_roster||[],opp=a.opponent_roster||[], bySlot=(list)=>Object.fromEntries(list.map((p)=>[p.lineup_slot,p])); const left=bySlot(mine),right=bySlot(opp);
    const rows=STARTER_ORDER.map((slot)=>{const l=left[slot],r=right[slot],lp=l?.live_points??l?.actual_points,rp=r?.live_points??r?.actual_points,diff=typeof lp==="number"&&typeof rp==="number"?lp-rp:null;return `<div class="battle"><div class="battle-side">${this.mini(l,false)}</div><div><div class="slot">${esc(slot)}</div><div class="advantage ${diff>0?'positive':diff<0?'negative':''}">${diff==null?'—':`${diff>=0?'+':''}${number(diff)}`}</div></div><div class="battle-side right">${this.mini(r,true)}</div></div>`;}).join("");
    const next=a.next_opponent_team_name?`<div class="projected">Next matchup: ${esc(a.next_opponent_team_name)}</div>`:"";
    this.shadowRoot.innerHTML=`<style>${this.baseStyles()}</style><ha-card><div class="wrap"><div class="title">🏆 <span>ESPN Fantasy Matchup</span></div><div class="matchup-head"><div><div class="team-name">${esc(a.team_name)}</div><div class="score">${number(a.team_score,2)}</div><div class="projected">Proj ${number(a.team_projected_score,1)}</div></div><div class="versus">VS<br>WEEK ${esc(a.current_week)}</div><div><div class="team-name">${esc(a.opponent_team_name)}</div><div class="score">${number(a.opponent_score,2)}</div><div class="projected">Proj ${number(a.opponent_projected_score,1)}</div></div></div>${next}<div class="status">${esc(a.result)}${a.point_differential!=null?` · ${a.point_differential>=0?'+':''}${number(a.point_differential,2)}`:""}</div>${rows}</div></ha-card>`;
    this.shadowRoot.querySelectorAll("[data-entity]").forEach((n)=>n.addEventListener("click",()=>showMoreInfo(this,n.dataset.entity)));
  }
  mini(p,right){if(!p)return '<div class="empty">—</div>';const id=findPlayer(this.hass,p.id)?.entity_id,pts=p.live_points??p.actual_points;return `<div ${id?`data-entity="${esc(id)}"`:""}><div class="battle-name">${esc(p.name)}</div><div class="battle-meta">${esc(p.position||"")} · ${esc(p.nfl_team||"")}</div><div class="battle-points">${number(pts)}${p.live_points!=null?' LIVE':''}</div></div>`;}
}

class ESPNFantasyPositionBattleCard extends ESPNBaseCard {
  static getStubConfig(){return {type:"custom:espn-fantasy-position-battle-card"};}
  static getConfigForm(){return {schema:[{name:"entity",selector:{entity:{domain:"sensor"}}}]};}
  getCardSize(){return 7;}
  render(){
    if(!this.shadowRoot||!this.hass)return;const s=findMatchup(this.hass,this._config),a=s?.attributes;if(!a){this.shadowRoot.innerHTML=`<style>${this.baseStyles()}</style><ha-card><div class="wrap"><div class="title">⚔️ <span>ESPN Fantasy Position Battle</span></div><div class="empty">No matchup data is available yet.</div></div></ha-card>`;return;}
    const groups=(list)=>{const out={};(list||[]).forEach((p)=>{if(!out[p.lineup_slot])out[p.lineup_slot]=[];out[p.lineup_slot].push(p);});return out;};const l=groups(a.my_roster),r=groups(a.opponent_roster);const rows=STARTER_ORDER.map((slot)=>{const lp=(l[slot]||[]).reduce((x,p)=>x+(Number(p.live_points??p.actual_points)||0),0),rp=(r[slot]||[]).reduce((x,p)=>x+(Number(p.live_points??p.actual_points)||0),0),d=lp-rp;return `<div class="compact-row"><div><div class="battle-points">${number(lp,1)}</div><div class="battle-meta">${(l[slot]||[]).map((p)=>esc(p.name)).join(", ")||"—"}</div></div><div><div class="slot">${esc(slot)}</div><div class="advantage ${d>0?'positive':d<0?'negative':''}">${d>=0?'+':''}${number(d,1)}</div></div><div style="text-align:right"><div class="battle-points">${number(rp,1)}</div><div class="battle-meta">${(r[slot]||[]).map((p)=>esc(p.name)).join(", ")||"—"}</div></div></div>`;}).join("");
    this.shadowRoot.innerHTML=`<style>${this.baseStyles()}</style><ha-card><div class="wrap"><div class="title">⚔️ <span>ESPN Fantasy Position Battle</span></div><div class="matchup-head"><div><div class="team-name">${esc(a.team_name)}</div></div><div class="versus">POSITION<br>BATTLE</div><div><div class="team-name">${esc(a.opponent_team_name)}</div></div></div>${rows}</div></ha-card>`;
  }
}

for(const [tag,cls] of [["espn-fantasy-roster-card",ESPNFantasyRosterCard],["espn-fantasy-live-card",ESPNFantasyLiveCard],["espn-fantasy-matchup-card",ESPNFantasyMatchupCard],["espn-fantasy-position-battle-card",ESPNFantasyPositionBattleCard]])if(!customElements.get(tag))customElements.define(tag,cls);

window.customCards=window.customCards||[];const registerCard=(entry)=>{if(!window.customCards.some((card)=>card.type===entry.type))window.customCards.push(entry);};
registerCard({type:"espn-fantasy-roster-card",name:"ESPN Fantasy Roster",description:"Live ESPN Fantasy roster grouped by lineup slot.",preview:true,documentationURL:"https://github.com/sutty-2017/ha-espn-fantasy",getEntitySuggestion:(hass,id)=>id.startsWith(PLAYER_PREFIX)?{config:{type:"custom:espn-fantasy-roster-card",entity:id}}:null});
registerCard({type:"espn-fantasy-live-card",name:"ESPN Fantasy Live",description:"Rostered players whose NFL games are live.",preview:true,documentationURL:"https://github.com/sutty-2017/ha-espn-fantasy",getEntitySuggestion:(hass,id)=>id.startsWith(GAME_PREFIX)&&id.endsWith("_game_active")?{config:{type:"custom:espn-fantasy-live-card",entity:id}}:null});
registerCard({type:"espn-fantasy-matchup-card",name:"ESPN Fantasy Matchup",description:"Your starting lineup directly against your opponent's lineup.",preview:true,documentationURL:"https://github.com/sutty-2017/ha-espn-fantasy",getEntitySuggestion:(hass,id)=>id.startsWith(MATCHUP_PREFIX)&&hass.states[id]?.attributes?.opponent_roster?{config:{type:"custom:espn-fantasy-matchup-card",entity:id}}:null});
registerCard({type:"espn-fantasy-position-battle-card",name:"ESPN Fantasy Position Battle",description:"Position-by-position scoring comparison for the current matchup.",preview:true,documentationURL:"https://github.com/sutty-2017/ha-espn-fantasy",getEntitySuggestion:(hass,id)=>id.startsWith(MATCHUP_PREFIX)&&hass.states[id]?.attributes?.opponent_roster?{config:{type:"custom:espn-fantasy-position-battle-card",entity:id}}:null});
console.info(`%c ESPN Fantasy cards ${CARD_VERSION} loaded`,"color:#e31837;font-weight:bold;");
