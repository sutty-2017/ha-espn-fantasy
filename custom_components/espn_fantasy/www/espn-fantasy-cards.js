const CARD_VERSION = "0.1.32";
const ESPN_FANTASY_ICON = "/espn_fantasy/icon.png";

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
const findRoster = (hass, entity) => { const s=entity?hass.states[entity]:null; return s && Array.isArray(s.attributes?.players) && s.attributes?.team_name && "starters_remaining" in s.attributes ? s : findByAttrs(hass, (a) => Array.isArray(a.players) && a.team_name && "starters_remaining" in a); };
const findMatchup = (hass, entity) => { const s=entity?hass.states[entity]:null; return s && Array.isArray(s.attributes?.my_roster) && Array.isArray(s.attributes?.opponent_roster) ? s : findByAttrs(hass, (a) => Array.isArray(a.my_roster) && Array.isArray(a.opponent_roster)); };
const findLeague = (hass, entity) => { const s=entity?hass.states[entity]:null; return s && Array.isArray(s.attributes?.standings) && Array.isArray(s.attributes?.scoreboard) && "league_id" in s.attributes ? s : findByAttrs(hass, (a) => Array.isArray(a.standings) && Array.isArray(a.scoreboard) && "league_id" in a); };

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
  const adviceAllowed=opts.showLineupAdvice&&Number(p.lineup_alert_difference||0)>=Number(opts.lineupAdviceThreshold||0);
  const advice=adviceAllowed&&p.lineup_alert==="lower_than_bench"?`<span class="lineup-advice lineup-down" title="${esc(`Bench upgrade: ${p.lineup_alert_player_name||"player"} +${num(p.lineup_alert_difference)} pts`)}">↓</span>`:adviceAllowed&&p.lineup_alert==="higher_than_starter"?`<span class="lineup-advice lineup-up" title="${esc(`Projected upgrade over ${p.lineup_alert_player_name||"starter"}: +${num(p.lineup_alert_difference)} pts`)}">↑</span>`:"";
  const projection = p.projected_points == null ? "" : `Proj ${num(p.projected_points)} ${advice}`;
  const meta = [opts.showSlot ? p.lineup_slot : p.position, p.nfl_team, opponentText(p)].filter(Boolean).join(" · ");
  const badge = status === "in_progress" ? '<span class="status live">LIVE</span>' :
    status === "final" ? '<span class="status final">FINAL</span>' :
    status === "bye" ? '<span class="status">BYE</span>' : "";
  const injury = injuryBadge(p);
  const liveHalo = status === "in_progress" && opts.showLiveHalo !== false;
  const haloStyle = liveHalo ? ` style="--live-halo:${esc(cssColor(opts.haloColor))}"` : "";
  return `<div class="player-tile ${esc(status)}" data-player-id="${esc(p.id)}" data-entity="${esc(entity)}">
    <div class="portrait${liveHalo ? " live-halo" : ""}"${haloStyle}>${p.headshot ? `<img src="${esc(p.headshot)}" alt="" loading="lazy">` : ""}</div>
    <div class="player-main"><div class="player-name">${esc(p.name)}</div><div class="player-meta">${esc(meta)}</div><div class="badges">${badge}${injury}</div></div>
    <div class="player-score"><strong>${esc(primary)}</strong><span>${projection}</span></div>
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
function popupSection(key, title, body, open = true) {
  if (!body) return "";
  return `<details class="popup-section" data-popup-section="${esc(key)}" ${open ? "open" : ""}><summary><span>${esc(title)}</span><span class="popup-chevron">⌄</span></summary><div class="popup-section-body">${body}</div></details>`;
}
function historicalDetails(p) {
  const history=Array.isArray(p?.weekly_history)?p.weekly_history:[];
  if(!history.length)return '<div class="empty">No historical stats available yet.</div>';
  const labels=p.stat_labels||{}, defaults=p.default_stats||[],summary=p.season_summary||{};
  const season=summary.weeks_with_stats?`<div class="season-summary"><div><span>Weeks</span><strong>${esc(summary.weeks_with_stats)}</strong></div><div><span>Total</span><strong>${num(summary.total_points)} pts</strong></div><div><span>Average</span><strong>${num(summary.average_points)} pts</strong></div><div><span>High</span><strong>${num(summary.high_points)} pts</strong></div></div>`:"";
  return season+'<div class="history-list">'+history.map(row=>{
    const stats=row.stats||{},keys=defaults.filter(k=>stats[k]!==undefined).slice(0,4);
    const detail=keys.length?'<div class="history-stats">'+keys.map(k=>'<span>'+esc(labels[k]||k.replaceAll("_"," "))+' <strong>'+num(stats[k])+'</strong></span>').join("")+'</div>':"";
    return '<div class="history-row"><div><strong>Week '+esc(row.week)+'</strong>'+detail+'</div><div class="history-points"><strong>'+num(row.actual_points)+' pts</strong>'+(row.projected_points==null?"":'<span>Proj '+num(row.projected_points)+'</span>')+'</div></div>';
  }).join("")+'</div>';
}
function playerDetails(p, order, opts = {}) {
  const sections=opts.sectionState||{};
  return `<div class="player-details">${playerTile(p,opts)}${popupSection("stats","Stats",statGrid(p,order),sections.stats!==false)}${popupSection("history","Historical stats",historicalDetails(p),sections.history!==false)}${outlookDetails(p)}${popupSection("news","Latest news",newsDetails(p),sections.news!==false)}</div>`;
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
  set hass(v){ const old=this._hass; this._hass=v; const id=this._config.entity; if(!old||!this.shadowRoot.hasChildNodes()||!id||old.states?.[id]!==v.states?.[id])this.renderStable(); } get hass(){ return this._hass; }
  setConfig(v){ this._config=v || {}; this.render(); }
  scrollPositions(){
    const positions=[],seen=new Set();let node=this;
    while(node){
      let parent=node.parentNode;
      if(!parent&&node.getRootNode)parent=node.getRootNode().host;
      node=parent;
      if(node instanceof Element&&node.scrollHeight>node.clientHeight+1&&!seen.has(node)){positions.push([node,node.scrollLeft,node.scrollTop]);seen.add(node);}
    }
    const doc=document.scrollingElement;
    if(doc&&!seen.has(doc))positions.push([doc,doc.scrollLeft,doc.scrollTop]);
    return positions;
  }
  renderStable(){const positions=this.scrollPositions(),images=new Map();this.shadowRoot.querySelectorAll("img[src]").forEach(img=>{const key=img.getAttribute("src"),list=images.get(key)||[];list.push(img);images.set(key,list);});this.render();this.shadowRoot.querySelectorAll("img[src]").forEach(img=>{const list=images.get(img.getAttribute("src"));const prior=list?.shift();if(prior&&prior!==img)img.replaceWith(prior);});const restore=()=>{for(const [el,left,top] of positions){if(el.scrollLeft!==left)el.scrollLeft=left;if(el.scrollTop!==top)el.scrollTop=top;}};restore();requestAnimationFrame(()=>{restore();requestAnimationFrame(restore);});}
  getCardSize(){ return 4; }
  getGridOptions(){ return { rows:"auto", columns:12, min_rows:2, min_columns:4 }; }
  bindPlayers(handler){ this.shadowRoot.querySelectorAll(".player-tile[data-player-id]").forEach((n)=>n.addEventListener("click",()=>handler?.(n.dataset.playerId,n.dataset.entity,n))); }
  openActivity(event, order){
    if(!event)return;
    const dialog=this.shadowRoot.querySelector("dialog.player-dialog");if(!dialog)return;
    const bid=Number(event.bid_amount)>0?` · FAAB ${num(event.bid_amount,0)}`:"";
    const meta=esc([event.timestamp?fmtKickoff(event.timestamp):"",event.status].filter(Boolean).join(" · ")+bid);
    const renderPlayer=(item,label="PLAYER")=>item?.player?`<section class="transaction-player"><div class="transaction-label">${esc(label)}</div>${playerDetails(item.player,order,{showLiveHalo:false,sectionState:{stats:true,history:true,news:true}})}</section>`:"";
    let body="";
    if(event.is_trade&&(event.sides||[]).length>1){
      const sides=(event.sides||[]).map(side=>{
        const received=(side.received||[]).map(item=>renderPlayer(item,"RECEIVED")).join("");
        const sent=(side.sent||[]).map(item=>renderPlayer(item,"SENT")).join("");
        return `<section class="trade-side"><div class="trade-team">${teamLogo(side.team_logo,side.team_name||"Team")}<strong>${esc(side.team_name||"Team")}</strong></div>${received}${sent}</section>`;
      }).join("");
      body=`<div class="transaction-meta activity-meta">${meta}</div><div class="trade-grid">${sides}</div>`;
    }else{
      const items=(event.items||[]).filter(x=>x.player);
      const dropped=items.filter(x=>String(x.type||"").includes("drop"));
      const added=items.filter(x=>String(x.type||"").includes("add"));
      const ordered=[...dropped,...added,...items.filter(x=>!dropped.includes(x)&&!added.includes(x))];
      const cols=ordered.map(item=>renderPlayer(item,String(item.type||"").includes("drop")?"DROPPED":String(item.type||"").includes("add")?"ADDED":"PLAYER")).join("");
      body=`<div class="transaction-head">${teamLogo(event.team_logo,event.team_name||"Team")}<div><strong>${esc(event.team_name||"League transaction")}</strong><div class="activity-meta">${meta}</div></div></div><div class="transaction-grid ${ordered.length===1?"single":""}">${cols||'<div class="empty">Player details unavailable for this transaction.</div>'}</div>`;
    }
    dialog.classList.add("transaction-dialog");
    dialog.querySelector(".dialog-content").innerHTML=body;
    if(!dialog.open)dialog.showModal();
  }
  bindActivities(events){ this.shadowRoot.querySelectorAll("[data-activity-index]").forEach(x=>x.addEventListener("click",()=>this.openActivity((events||[])[Number(x.dataset.activityIndex)],this._config.stats))); }
  openPlayer(p, order){ if(!p)return; this._openPlayerId=String(p.id); const dialog=this.shadowRoot.querySelector("dialog.player-dialog"); if(!dialog)return; dialog.classList.remove("transaction-dialog"); const key=String(p.id),sectionState=this._popupSections?.[key]||{}; dialog.querySelector(".dialog-content").innerHTML=playerDetails(p,order,{showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color,sectionState}); dialog.querySelectorAll(".popup-section").forEach(x=>x.addEventListener("toggle",()=>{this._popupSections??={};this._popupSections[key]??={};this._popupSections[key][x.dataset.popupSection]=x.open;})); if(!dialog.open)dialog.showModal(); }
  dialog(){ return `<dialog class="player-dialog"><button class="dialog-close" aria-label="Close">×</button><div class="dialog-content"></div></dialog>`; }
  bindDialog(){ const d=this.shadowRoot.querySelector("dialog.player-dialog"); if(!d)return; const close=()=>{this._openPlayerId=null;d.close();}; d.querySelector(".dialog-close")?.addEventListener("click",close); d.addEventListener("click",(e)=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}); d.addEventListener("close",()=>{this._openPlayerId=null;}); }
  restoreDialog(players, order){ if(!this._openPlayerId)return; const p=(players||[]).find(x=>String(x.id)===String(this._openPlayerId)); if(p)this.openPlayer(p,order); else this._openPlayerId=null; }
  appearanceStyles(){const mode=this._config.appearance||"theme",accent=cssColor(this._config.accent_color,"var(--primary-color)"),blur=this._config.glass_strength==="strong"?"18px":"10px",border=this._config.border_style||"theme";return `:host{--espn-accent:${accent}}ha-card{overflow:hidden;background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color);border-radius:var(--ha-card-border-radius,12px)}${mode==="glass"?`ha-card{background:color-mix(in srgb,var(--ha-card-background,var(--card-background-color)) ${this._config.glass_strength==="strong"?"72%":"56%"},transparent)!important;backdrop-filter:blur(${blur}) saturate(1.15);-webkit-backdrop-filter:blur(${blur}) saturate(1.15)}`:""}${mode==="solid"?`ha-card{background:var(--ha-card-background,var(--card-background-color))!important;backdrop-filter:none!important}`:""}${mode==="transparent"?`ha-card{background:transparent!important;box-shadow:none!important;backdrop-filter:none!important}`:""}${border==="none"?`ha-card{border:none!important}`:""}${border==="subtle"?`ha-card{border:1px solid color-mix(in srgb,var(--primary-text-color) 14%,transparent)!important}`:""}`; }
  styles(){ return `
    :host{display:block;color:var(--primary-text-color);overflow-anchor:none}${this.appearanceStyles()}.wrap{padding:16px;box-sizing:border-box}
    .header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.title{font-size:20px;font-weight:700}.subtle{font-size:12px;color:var(--secondary-text-color)}
    .player-list{display:grid;gap:7px}.player-tile{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:64px;padding:7px 10px;border-radius:14px;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);cursor:pointer;box-sizing:border-box}
    .portrait{position:relative;width:48px;height:48px;border-radius:50%;background:color-mix(in srgb,var(--primary-text-color) 7%,transparent)}.portrait.live-halo{box-shadow:0 0 0 2px var(--live-halo,#35d07f),0 0 12px 2px var(--live-halo,#35d07f),0 0 22px color-mix(in srgb,var(--live-halo,#35d07f) 55%,transparent)}.portrait img{width:100%;height:100%;object-fit:cover;border-radius:50%}.injury-badge{position:absolute;right:-4px;bottom:-3px;min-width:20px;height:20px;padding:0 4px;box-sizing:border-box;border-radius:999px;display:grid;place-items:center;font-size:9px;font-weight:900;line-height:1;color:#fff;background:var(--warning-color,#f6a623);border:2px solid var(--card-background-color,var(--primary-background-color))}.injury-out,.injury-ir{background:var(--error-color,#db4437)}.player-main{min-width:0}.player-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-meta{font-size:12px;color:var(--secondary-text-color);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .player-score{text-align:right;display:flex;flex-direction:column;gap:2px}.player-score strong{font-size:16px}.player-score span{font-size:11px;color:var(--secondary-text-color)}.badges{display:flex;gap:4px;margin-top:4px}.status,.injury{font-size:9px;font-weight:800;padding:2px 5px;border-radius:999px;background:var(--secondary-background-color)}.status.live{background:var(--error-color);color:white}.status.final{opacity:.75}.injury{background:color-mix(in srgb,var(--warning-color,#f6a623) 25%,transparent);color:var(--primary-text-color)}
    .matchup-shell{position:relative}.matchup-week{text-align:center;font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--secondary-text-color);margin-bottom:8px}.team-head{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:start;text-align:center;margin-bottom:14px}.team-side{display:flex;flex-direction:column;align-items:center}.team-logo-wrap{position:relative;width:58px;height:58px;margin:0 auto 6px}.team-logo,.team-logo-fallback{position:absolute;inset:0;width:58px;height:58px}.team-logo{display:block;object-fit:contain;opacity:1}.team-logo.loaded{opacity:1}.team-logo-fallback{display:grid;place-items:center;border-radius:50%;background:var(--secondary-background-color);font-weight:800;font-size:18px;color:var(--secondary-text-color)}.team-name{font-weight:700}.big-score{font-size:28px;font-weight:800}.projection{font-size:11px;color:var(--secondary-text-color)}.vs{font-size:11px;font-weight:800;color:var(--secondary-text-color);align-self:center}.win-prob{font-size:12px;font-weight:700;margin-top:5px}.starter-progress{width:min(150px,100%);margin-top:7px}.progress-track{height:4px;border-radius:99px;overflow:hidden;background:color-mix(in srgb,var(--primary-text-color) 12%,transparent)}.progress-track span{display:block;height:100%;border-radius:inherit;background:var(--espn-accent,var(--primary-color))}.progress-label{font-size:9px;color:var(--secondary-text-color);margin-top:3px;white-space:nowrap}
    .league-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:20px;font-weight:800;margin-bottom:12px}.league-title span,.league-section-title{font-size:11px;color:var(--secondary-text-color);text-transform:uppercase}.league-section-title{font-weight:800;margin:16px 0 8px}.league-table-head,.league-row{display:grid;grid-template-columns:28px minmax(0,1fr) 62px 58px;gap:8px;align-items:center}.league-table-head{font-size:10px;color:var(--secondary-text-color);padding:0 6px 5px}.league-row{min-height:46px;padding:5px 6px;border-top:1px solid var(--divider-color);font-size:12px}.league-team{display:flex;align-items:center;gap:7px;min-width:0}.league-team .team-logo-wrap,.league-team .team-logo,.league-team .team-logo-fallback{width:30px;height:30px;margin:0}.league-team .team-logo-fallback{font-size:10px}.league-team span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.league-scoreboard{display:grid;gap:8px}.league-game{padding:9px 10px;border-radius:12px;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.league-game-team{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:7px;align-items:center}.league-game-team+.league-game-proj{margin-bottom:6px}.league-game-team .team-logo-wrap,.league-game-team .team-logo,.league-game-team .team-logo-fallback{width:28px;height:28px;margin:0}.league-game-team .team-logo-fallback{font-size:9px}.league-game-team span{font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.league-game-team strong{font-size:16px}.league-game-proj{font-size:9px;color:var(--secondary-text-color);text-align:right;margin-top:-5px}.injury-detail{margin-top:8px;text-align:center;font-size:12px;font-weight:700;color:var(--secondary-text-color)}.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px;margin-top:12px}.stat-cell{padding:10px;min-height:54px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:3px}.stat-cell span{font-size:10px;color:var(--secondary-text-color);text-transform:uppercase}.stat-cell strong{font-size:18px}.player-dialog{width:min(520px,calc(100% - 32px));border:var(--ha-card-border-width,0) solid var(--ha-card-border-color,var(--divider-color));border-radius:var(--ha-card-border-radius,16px);background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color);box-shadow:var(--ha-card-box-shadow);padding:16px}.player-dialog::backdrop{background:rgba(0,0,0,.55);backdrop-filter:blur(3px)}.player-dialog.transaction-dialog{width:min(980px,calc(100% - 32px));max-height:calc(100vh - 40px);overflow:auto}.transaction-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}.transaction-head .team-logo-wrap,.transaction-head .team-logo,.transaction-head .team-logo-fallback,.trade-team .team-logo-wrap,.trade-team .team-logo,.trade-team .team-logo-fallback{width:42px;height:42px;margin:0}.transaction-grid,.trade-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.transaction-grid.single{grid-template-columns:1fr}.transaction-label{text-align:center;font-size:11px;font-weight:900;letter-spacing:.08em;margin-bottom:6px}.transaction-player{min-width:0}.transaction-player .player-tile{cursor:default}.trade-side{min-width:0;padding:10px;border-radius:12px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}.trade-team{display:flex;align-items:center;gap:9px;margin-bottom:10px;padding-bottom:9px;border-bottom:1px solid var(--divider-color)}.transaction-meta{text-align:center;margin-bottom:10px}.dialog-close{float:right;border:0;background:transparent;color:var(--primary-text-color);font-size:28px;cursor:pointer}.dialog-content{clear:both}.popup-section{margin-top:12px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);overflow:hidden}.popup-section>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;cursor:pointer;font-size:13px;font-weight:800}.popup-section>summary::-webkit-details-marker{display:none}.popup-chevron{font-size:18px;line-height:1;transition:transform .18s ease}.popup-section[open] .popup-chevron{transform:rotate(180deg)}.popup-section-body{padding:0 12px 12px}.popup-section .stat-grid{margin-top:0}.season-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:9px}.season-summary>div{display:flex;flex-direction:column;align-items:center;padding:7px;border-radius:9px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}.season-summary span{font-size:9px;text-transform:uppercase;color:var(--secondary-text-color)}.season-summary strong{font-size:12px}.history-list{display:grid;gap:7px}.history-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--divider-color)}.history-row:first-child{border-top:0}.history-stats{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:10px;color:var(--secondary-text-color)}.history-points{display:flex;flex-direction:column;align-items:flex-end;white-space:nowrap}.history-points span{font-size:10px;color:var(--secondary-text-color)}.outlook-card{margin-top:14px;padding:11px 12px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.outlook-heading{font-size:13px;font-weight:800}.outlook-preview{font-size:13px;line-height:1.45;margin-top:5px;color:var(--secondary-text-color)}.outlook{margin-top:8px;border-top:1px solid var(--divider-color);padding-top:8px}.outlook summary{cursor:pointer;font-weight:700}.outlook-date{font-size:11px;color:var(--secondary-text-color);margin:7px 0}.outlook-title{font-size:12px;font-weight:700;margin-top:10px}.outlook-text{font-size:13px;line-height:1.45;margin-top:4px;white-space:pre-wrap}.news-card{margin-top:14px;padding:11px 12px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.news-item{padding:10px 0;border-top:1px solid var(--divider-color)}.news-item:first-of-type{border-top:0}.news-meta{font-size:10px;color:var(--secondary-text-color);text-transform:uppercase}.news-headline{font-size:13px;font-weight:750;line-height:1.35;margin-top:3px}.news-headline a{color:var(--primary-text-color);text-decoration:none}.news-description,.news-spin{font-size:12px;line-height:1.45;margin-top:5px;color:var(--secondary-text-color)}.news-spin strong{color:var(--primary-text-color)}.ticker{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:3px}.ticker .player-tile{min-width:270px;scroll-snap-align:start}.activity-item{cursor:pointer}.activity-team{display:flex;align-items:center;gap:8px;min-width:0}.activity-team .team-logo-wrap,.activity-team .team-logo,.activity-team .team-logo-fallback{width:34px;height:34px;margin:0}.activity-players{display:flex;gap:12px;flex-wrap:wrap;margin-top:7px}.activity-player{display:flex;align-items:center;gap:7px;min-width:150px}.activity-player>div:last-child{min-width:0}.activity-player strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.activity-player span{display:block;font-size:10px;color:var(--secondary-text-color);white-space:nowrap}.activity-headshot{width:34px;height:34px;border-radius:50%;overflow:hidden;background:var(--secondary-background-color);flex:0 0 34px}.activity-headshot img{width:100%;height:100%;object-fit:cover}.empty{padding:12px;color:var(--secondary-text-color)}
    @media(max-width:600px){.transaction-grid,.trade-grid{grid-template-columns:1fr}.wrap{padding:12px}.player-tile{grid-template-columns:42px minmax(0,1fr) auto}.portrait{width:42px;height:42px}.ticker .player-tile{min-width:240px}.team-head{grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr);gap:4px}.team-logo-wrap,.team-logo,.team-logo-fallback{width:48px;height:48px}.team-name{font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.big-score{font-size:23px}.starter-progress{width:100%}.progress-label{font-size:8px}.win-prob{font-size:11px}}
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
    else if(!id||old.states?.[id]!==v.states?.[id])this.updateTicker();
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
function activityIcon(type="") {
  const t=String(type).toLowerCase();
  return t.includes("trade")?"↔":t.includes("waiver")?"W":t.includes("add")?"+":t.includes("drop")?"−":"•";
}
function activityPlayer(item) {
  const meta=[item.position,item.nfl_team].filter(Boolean).join(" · ");
  return `<div class="activity-player"><div class="activity-headshot">${item.headshot?`<img src="${esc(item.headshot)}" alt="" loading="lazy">`:""}</div><div><strong>${esc(item.player_name||"Player")}</strong><span>${esc(meta)}</span></div></div>`;
}
function activityItem(event, compact=false, index=0) {
  const when=event.timestamp?fmtKickoff(event.timestamp):"";
  const bid=Number(event.bid_amount)>0?` · FAAB ${num(event.bid_amount,0)}`:"";
  const players=(event.items||[]).map(activityPlayer).join("");
  return `<article class="activity-item${compact?" compact":""}" data-activity-index="${index}"><div class="activity-team">${teamLogo(event.team_logo,event.team_name||"Team")}<strong>${esc(event.team_name||"League transaction")}</strong></div><div class="activity-players">${players}</div><div class="activity-meta">${esc([when,event.status].filter(Boolean).join(" · ")+bid)}</div></article>`;
}

class ESPNFantasyLeagueEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:"open"});this._config={};}
  set hass(v){this._hass=v;const form=this.shadowRoot.querySelector("ha-form");if(form)form.hass=v;else this.render();} get hass(){return this._hass;}
  setConfig(v){this._config=v||{};this.render();}
  fire(config){this._config=config;this.dispatchEvent(new CustomEvent("config-changed",{detail:{config},bubbles:true,composed:true}));this.render();}
  order(){const d=["roster","standings","scoreboard","matchup","news","activity"],c=[this._config.section_1,this._config.section_2,this._config.section_3,this._config.section_4,this._config.section_5,this._config.section_6].filter(v=>d.includes(v));return [...new Set([...c,...d])];}
  move(i,d){const a=this.order(),j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];const p={};a.forEach((v,n)=>p["section_"+(n+1)]=v);this.fire({...this._config,...p});}
  render(){if(!this.hass)return;const schema=[
    {name:"entity",selector:{entity:{domain:"sensor"}}},{name:"display_mode",selector:{select:{options:[{value:"roster",label:"Roster"},{value:"standings",label:"Standings"},{value:"scoreboard",label:"Scoreboard"},{value:"matchup",label:"Matchup"},{value:"all",label:"All-in-one"}]}}},
    {name:"include_news",selector:{boolean:{}}},{name:"include_activity",selector:{boolean:{}}},{name:"lineup_alert_threshold",selector:{number:{min:0,max:50,step:0.5,mode:"box",unit_of_measurement:"pts"}}},{name:"story_count",selector:{number:{min:1,max:20,mode:"box"}}},{name:"news_height",selector:{number:{min:200,max:1200,step:25,mode:"box",unit_of_measurement:"px"}}},
    {name:"title",selector:{text:{}}},{name:"hide_title",selector:{boolean:{}}},{name:"show_header_logo",selector:{boolean:{}}},
    {name:"label_roster",selector:{text:{}}},{name:"label_standings",selector:{text:{}}},{name:"label_scoreboard",selector:{text:{}}},{name:"label_matchup",selector:{text:{}}},{name:"label_news",selector:{text:{}}},{name:"label_activity",selector:{text:{}}},{name:"label_starters",selector:{text:{}}},{name:"label_bench_ir",selector:{text:{}}},
    {name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},{name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},{name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}
  ];
  const names={entity:"Entity",display_mode:"Display",include_news:"Include news",story_count:"News stories",news_height:"News feed height",title:"Title",hide_title:"Hide title",show_header_logo:"Show ESPN Fantasy logo",label_roster:"Roster label",label_standings:"Standings label",label_scoreboard:"Scoreboard label",label_matchup:"Matchup label",label_news:"News label",label_activity:"Activity label",include_activity:"Include league activity",label_starters:"Starters label",label_bench_ir:"Bench / IR label",appearance:"Appearance",accent_color:"Accent color",glass_strength:"Glass strength",border_style:"Border"},labels={roster:"Roster",standings:"Standings",scoreboard:"Scoreboard",matchup:"My Matchup",news:"News",activity:"Activity"};
  this.shadowRoot.innerHTML='<style>:host{display:block}.order-title{font-weight:600;margin:18px 0 6px}.hint{font-size:12px;color:var(--secondary-text-color);margin-bottom:8px}.order-row{display:grid;grid-template-columns:minmax(0,1fr) 40px 40px;gap:6px;align-items:center;min-height:40px;border-bottom:1px solid var(--divider-color)}button{border:0;background:var(--secondary-background-color);color:var(--primary-text-color);border-radius:8px;min-height:32px;cursor:pointer}button:disabled{opacity:.35}</style><ha-form></ha-form><div class="order-title">All-in-one section order</div><div class="hint">Use the arrows to arrange the tabs.</div>'+this.order().map((v,i,a)=>'<div class="order-row"><span>'+esc(labels[v])+'</span><button data-i="'+i+'" data-d="-1" '+(i===0?'disabled':'')+'>↑</button><button data-i="'+i+'" data-d="1" '+(i===a.length-1?'disabled':'')+'>↓</button></div>').join('');
  const form=this.shadowRoot.querySelector("ha-form");form.hass=this.hass;form.data={story_count:5,news_height:500,lineup_alert_threshold:0,show_header_logo:true,...this._config};form.schema=schema;form.computeLabel=x=>names[x.name]||x.name;form.addEventListener("value-changed",e=>this.fire({...this._config,...e.detail.value}));this.shadowRoot.querySelectorAll("button[data-i]").forEach(x=>x.addEventListener("click",()=>this.move(Number(x.dataset.i),Number(x.dataset.d))));}
}
if(!customElements.get("espn-fantasy-league-editor"))customElements.define("espn-fantasy-league-editor",ESPNFantasyLeagueEditor);

class ESPNFantasyLeagueCard extends ESPNBaseCard {
  constructor(){super();this._leagueView=null;this._matchupView=null;this._rosterView=null;this._newsScrollTop=0;this._activityScrollTop=0;}
  set hass(v){const old=this._hass;this._hass=v;if(!old||!this.shadowRoot.hasChildNodes()){this.renderStable();return;}const ids=[findRoster(v,this._config.entity)?.entity_id,findLeague(v,this._config.entity)?.entity_id,findMatchup(v,this._config.entity)?.entity_id].filter(Boolean);if(!ids.length||ids.some(id=>old.states?.[id]!==v.states?.[id]))this.renderStable();}
  get hass(){return this._hass;}
  static getStubConfig(){return {type:"custom:espn-fantasy-league-card",display_mode:"all",include_news:true,include_activity:false,story_count:5,news_height:500,lineup_alert_threshold:0,show_header_logo:true};}
  static async getConfigElement(){return document.createElement("espn-fantasy-league-editor");}
  static getConfigForm(){const sectionOptions=[{value:"roster",label:"Roster"},{value:"standings",label:"Standings"},{value:"scoreboard",label:"Scoreboard"},{value:"matchup",label:"My Matchup"},{value:"news",label:"News"},{value:"activity",label:"Activity"}];return {schema:[
    {name:"entity",selector:{entity:{domain:"sensor"}}},
    {name:"display_mode",selector:{select:{options:[{value:"roster",label:"Roster"},{value:"standings",label:"Standings"},{value:"scoreboard",label:"Scoreboard"},{value:"matchup",label:"Matchup"},{value:"all",label:"All-in-one"}]}}},
    {name:"include_news",selector:{boolean:{}}},{name:"include_activity",selector:{boolean:{}}},
    {name:"story_count",selector:{number:{min:1,max:20,mode:"box"}}},
    {name:"section_1",selector:{select:{options:sectionOptions}}},{name:"section_2",selector:{select:{options:sectionOptions}}},{name:"section_3",selector:{select:{options:sectionOptions}}},{name:"section_4",selector:{select:{options:sectionOptions}}},{name:"section_5",selector:{select:{options:sectionOptions}}},{name:"section_6",selector:{select:{options:sectionOptions}}},
    {name:"title",selector:{text:{}}},{name:"hide_title",selector:{boolean:{}}},
    {name:"label_roster",selector:{text:{}}},{name:"label_standings",selector:{text:{}}},{name:"label_scoreboard",selector:{text:{}}},{name:"label_matchup",selector:{text:{}}},{name:"label_news",selector:{text:{}}},
    {name:"label_starters",selector:{text:{}}},{name:"label_bench_ir",selector:{text:{}}},
    {name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},
    {name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},
    {name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}
  ]};}
  getGridOptions(){return {rows:"auto",columns:12,min_rows:4,min_columns:4};}
  labels(){return {roster:this._config.label_roster||"Roster",standings:this._config.label_standings||"Standings",scoreboard:this._config.label_scoreboard||"Scoreboard",matchup:this._config.label_matchup||"My Matchup",news:this._config.label_news||"News",activity:this._config.label_activity||"Activity",starters:this._config.label_starters||"Starters",bench:this._config.label_bench_ir||"Bench / IR"};}
  key(part){return "espn-fantasy-main:"+(this._config.entity||"auto")+":"+part;}
  remembered(part,fallback){try{return localStorage.getItem(this.key(part))||fallback}catch(_){return fallback}}
  remember(part,value){try{localStorage.setItem(this.key(part),value)}catch(_){}}
  rosterState(){return findRoster(this.hass,this._config.entity)||findRoster(this.hass);}
  leagueState(){return findLeague(this.hass,this._config.entity)||findLeague(this.hass);}
  matchupState(){return findMatchup(this.hass,this._config.entity)||findMatchup(this.hass);}
  orderedViews(){
    const defaults=["roster","standings","scoreboard","matchup","news","activity"],configured=[this._config.section_1,this._config.section_2,this._config.section_3,this._config.section_4,this._config.section_5,this._config.section_6].filter(v=>defaults.includes(v)),views=[...new Set([...configured,...defaults])];
    return views.filter(v=>(v!=="news"||this._config.include_news!==false)&&(v!=="activity"||this._config.include_activity===true));
  }
  rosterBody(){
    const s=this.rosterState(),a=s?.attributes||{},labels=this.labels(),view=this._rosterView||this.remembered("roster","starters");
    if(!s)return '<div class="empty">No roster data yet.</div>';
    const starters=a.starters||[],starterIds=new Set(starters.map(p=>String(p.id))),all=a.players||starters,players=rosterOrder(view==="bench"?all.filter(p=>!starterIds.has(String(p.id))):starters);this._players=players;
    return '<div class="team-head single"><div class="team-side">'+teamLogo(a.team_logo,a.team_name)+'<div class="team-name">'+esc(a.team_name)+'</div><div class="big-score">'+num(a.score,2)+'</div><div class="projection">Proj '+num(a.live_projected_score??a.projected_score)+'</div></div></div><div class="sub-switch"><button data-roster="starters" class="'+(view==="starters"?"active":"")+'">'+esc(labels.starters)+'</button><button data-roster="bench" class="'+(view==="bench"?"active":"")+'">'+esc(labels.bench)+'</button></div><div class="player-list">'+players.map(p=>playerTile(p,{showSlot:true,showLineupAdvice:true,lineupAdviceThreshold:this._config.lineup_alert_threshold||0,showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color})).join("")+'</div>';
  }
  matchupBody(){
    const s=this.matchupState(),a=s?.attributes||{},labels=this.labels(),view=this._matchupView||this.remembered("matchup","starters");
    if(!s)return '<div class="empty">No matchup data yet.</div>';
    const startersMine=a.my_roster||[],startersOpp=a.opponent_roster||[],starterIds=new Set(startersMine.map(p=>String(p.id))),oppStarterIds=new Set(startersOpp.map(p=>String(p.id)));
    const mine=rosterOrder(view==="bench"?(a.my_players||[]).filter(p=>!starterIds.has(String(p.id))):startersMine);
    const opp=rosterOrder(view==="bench"?(a.opponent_players||[]).filter(p=>!oppStarterIds.has(String(p.id))):startersOpp);this._players=[...mine,...opp];
    let rows="";for(let i=0;i<Math.max(mine.length,opp.length);i++)rows+='<div class="match-row">'+(mine[i]?playerTile(mine[i],{showSlot:true}):"<div></div>")+(opp[i]?playerTile(opp[i],{showSlot:true}):"<div></div>")+"</div>";
    return matchupHeader(a)+'<div class="sub-switch"><button data-matchup="starters" class="'+(view==="starters"?"active":"")+'">'+esc(labels.starters)+'</button><button data-matchup="bench" class="'+(view==="bench"?"active":"")+'">'+esc(labels.bench)+'</button></div>'+rows;
  }
  newsBody(){
    const players=this.rosterState()?.attributes?.players||[],count=Math.min(20,Math.max(1,Number(this._config.story_count)||5));
    const stories=players.flatMap(p=>(Array.isArray(p.news)?p.news:[]).map(item=>({p,item}))).sort((x,y)=>(Date.parse(y.item.published)||0)-(Date.parse(x.item.published)||0)).slice(0,count);
    if(!stories.length)return '<div class="empty">No player news available yet.</div>';
    return '<div class="news-feed">'+stories.map(({p,item})=>'<article class="feed-story" data-news-player="'+esc(p.id)+'"><div class="feed-player"><div class="portrait">'+(p.headshot?'<img src="'+esc(p.headshot)+'" alt="" loading="lazy">':"")+injuryBadge(p)+'</div><div><div class="player-name">'+esc(p.name)+'</div><div class="player-meta">'+esc([p.position,p.nfl_team].filter(Boolean).join(" · "))+'</div></div></div><div class="news-meta">'+esc(item.published?fmtKickoff(item.published):"")+'</div><div class="news-headline">'+(item.url?'<a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">'+esc(item.headline||"Player update")+"</a>":esc(item.headline||"Player update"))+'</div>'+(item.description?'<div class="news-description">'+esc(item.description)+"</div>":"")+(item.spin?'<div class="news-spin"><strong>Fantasy:</strong> '+esc(item.spin)+"</div>":"")+"</article>").join("")+"</div>";
  }
  activityBody(){
    const events=this.leagueState()?.attributes?.activity||[],count=Math.min(20,Math.max(1,Number(this._config.story_count)||5));
    if(!events.length)return '<div class="empty">No league activity available yet.</div>';
    return '<div class="activity-feed">'+events.slice(0,count).map((event,i)=>activityItem(event,false,i)).join("")+'</div>';
  }
  bodyFor(view){
    const la=this.leagueState()?.attributes||{},standings=la.standings||[],games=la.scoreboard||[];
    if(view==="roster")return this.rosterBody();
    if(view==="standings")return standings.length?leagueStandings(standings):'<div class="empty">No standings data yet.</div>';
    if(view==="scoreboard")return games.length?leagueScoreboard(games):'<div class="empty">No scoreboard data yet.</div>';
    if(view==="matchup")return this.matchupBody();
    if(view==="activity")return this.activityBody();
    return this.newsBody();
  }
  bindLeagueContent(){
    this.bindPlayers(id=>{const pools=[...(this.rosterState()?.attributes?.players||[]),...(this.matchupState()?.attributes?.my_players||[]),...(this.matchupState()?.attributes?.opponent_players||[])];this.openPlayer(pools.find(p=>String(p.id)===String(id)),this._config.stats);});
    this.shadowRoot.querySelectorAll("[data-news-player]").forEach(x=>x.addEventListener("click",e=>{if(e.target.closest("a"))return;const p=(this.rosterState()?.attributes?.players||[]).find(p=>String(p.id)===String(x.dataset.newsPlayer));this.openPlayer(p,this._config.stats);}));
    this.bindActivities(this.leagueState()?.attributes?.activity||[]);
    this.shadowRoot.querySelectorAll("button[data-matchup]").forEach(x=>x.addEventListener("click",()=>this.setMatchupView(x.dataset.matchup)));
    this.shadowRoot.querySelectorAll("button[data-roster]").forEach(x=>x.addEventListener("click",()=>this.setRosterView(x.dataset.roster)));
    const feed=this.shadowRoot.querySelector(".news-feed");if(feed){feed.scrollTop=this._newsScrollTop;feed.addEventListener("scroll",()=>{this._newsScrollTop=feed.scrollTop;},{passive:true});}
    const activity=this.shadowRoot.querySelector(".activity-feed");if(activity){activity.scrollTop=this._activityScrollTop;activity.addEventListener("scroll",()=>{this._activityScrollTop=activity.scrollTop;},{passive:true});}
  }
  replaceBody(view){const content=this.shadowRoot.querySelector(".main-content");if(!content){this.renderStable();return;}const feed=this.shadowRoot.querySelector(".news-feed");if(feed)this._newsScrollTop=feed.scrollTop;const activity=this.shadowRoot.querySelector(".activity-feed");if(activity)this._activityScrollTop=activity.scrollTop;content.innerHTML=this.bodyFor(view);this.shadowRoot.querySelectorAll(".main-switch button").forEach(x=>x.classList.toggle("active",x.dataset.view===view));this.bindLeagueContent();}
  setView(v){this._leagueView=v;this.remember("view",v);this.replaceBody(v);}
  setMatchupView(v){this._matchupView=v;this.remember("matchup",v);this.replaceBody("matchup");}
  setRosterView(v){this._rosterView=v;this.remember("roster",v);this.replaceBody("roster");}
  render(){
    if(!this.hass)return;const labels=this.labels(),mode=this._config.display_mode||"all",league=this.leagueState(),la=league?.attributes||{},standings=la.standings||[],games=la.scoreboard||[];
    const views=this.orderedViews(),requested=mode==="all"?(this._leagueView||this.remembered("view","standings")):mode,view=views.includes(requested)?requested:views[0];
    const body=view==="roster"?this.rosterBody():view==="standings"?(standings.length?leagueStandings(standings):'<div class="empty">No standings data yet.</div>'):view==="scoreboard"?(games.length?leagueScoreboard(games):'<div class="empty">No scoreboard data yet.</div>'):view==="matchup"?this.matchupBody():view==="activity"?this.activityBody():this.newsBody();
    const nav=mode==="all"?'<div class="main-switch">'+views.map(v=>'<button data-view="'+v+'" class="'+(view===v?"active":"")+'">'+esc(labels[v])+"</button>").join("")+"</div>":"";
    const title=this._config.title??league?.state??this.rosterState()?.attributes?.team_name??"ESPN Fantasy",logo=this._config.show_header_logo===false?"":'<img class="header-brand" src="'+ESPN_FANTASY_ICON+'" alt="ESPN Fantasy">',header=this._config.hide_title?"":'<div class="header"><div class="title-group">'+logo+'<div class="title">'+esc(title)+'</div></div><div class="subtle">Week '+esc(la.current_week??la.matchup_period??"—")+'</div></div>';
    this.shadowRoot.innerHTML='<style>'+this.styles()+'.title-group{display:flex;align-items:center;gap:10px;min-width:0}.header-brand{width:34px;height:34px;object-fit:contain;flex:0 0 34px}.main-switch,.sub-switch{display:flex;gap:5px;overflow-x:auto;margin:0 0 12px;scrollbar-width:none}.main-switch button,.sub-switch button{white-space:nowrap;border:1px solid var(--divider-color);border-radius:999px;padding:6px 11px;background:var(--secondary-background-color);color:var(--secondary-text-color);cursor:pointer}.main-switch button.active,.sub-switch button.active{background:color-mix(in srgb,var(--espn-accent,var(--primary-color)) 20%,var(--ha-card-background,var(--card-background-color)));color:var(--primary-text-color);border-color:var(--espn-accent,var(--primary-color))}.team-head.single{grid-template-columns:1fr}.match-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}.news-feed{display:grid;gap:10px;max-height:var(--news-height,500px);overflow-y:auto;overscroll-behavior:contain;padding-right:4px}.feed-story{padding:12px;cursor:pointer;border-radius:var(--ha-card-border-radius,12px);background:var(--secondary-background-color)}.feed-player{display:flex;align-items:center;gap:10px;margin-bottom:8px}.feed-player .portrait{width:48px;height:48px;flex:0 0 48px}.activity-feed{display:grid;gap:8px;max-height:var(--news-height,500px);overflow-y:auto;padding-right:4px}.activity-item{display:flex;align-items:center;gap:10px;padding:11px;border-radius:var(--ha-card-border-radius,12px);background:var(--secondary-background-color)}.activity-icon{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border-radius:50%;font-weight:800;background:color-mix(in srgb,var(--espn-accent,var(--primary-color)) 18%,transparent)}.activity-main{min-width:0}.activity-meta{font-size:12px;color:var(--secondary-text-color);margin-top:3px}.activity-item.compact{min-width:300px;height:100%;box-sizing:border-box}@media(max-width:600px){.match-row{gap:5px}.match-row .player-tile{grid-template-columns:36px minmax(0,1fr);padding:6px}.match-row .portrait{width:36px;height:36px}.match-row .player-score{grid-column:2;text-align:left}}</style><ha-card><div class="wrap">'+header+nav+'<div class="main-content" style="--news-height:'+Math.min(1200,Math.max(200,Number(this._config.news_height)||500))+'px">'+body+'</div></div></ha-card>'+this.dialog();
    this.shadowRoot.querySelectorAll(".main-switch button").forEach(x=>x.addEventListener("click",()=>this.setView(x.dataset.view)));
    this.shadowRoot.querySelectorAll("button[data-matchup]").forEach(x=>x.addEventListener("click",()=>this.setMatchupView(x.dataset.matchup)));
    this.shadowRoot.querySelectorAll("button[data-roster]").forEach(x=>x.addEventListener("click",()=>this.setRosterView(x.dataset.roster)));
    this.bindLeagueContent();this.bindDialog();this.restoreDialog(this.rosterState()?.attributes?.players||[],this._config.stats);
  }
}

class ESPNFantasyLeagueTickerCard extends ESPNBaseCard {
  constructor(){super();this._timer=null;this._raf=null;this._index=0;this._lastFrame=0;}
  set hass(v){const old=this._hass;this._hass=v;if(!old||!this.shadowRoot.querySelector(".ticker-viewport"))this.render();else{const ids=[this.roster()?.entity_id,this.league()?.entity_id].filter(Boolean);if(!ids.length||ids.some(id=>old.states?.[id]!==v.states?.[id]))this.updateTicker();}}
  get hass(){return this._hass;}
  stopMotion(){if(this._timer){clearInterval(this._timer);this._timer=null;}if(this._raf){cancelAnimationFrame(this._raf);this._raf=null;}this._lastFrame=0;}
  setConfig(v){this.stopMotion();this._config=v||{};this.render();}
  static getStubConfig(){return {type:"custom:espn-fantasy-ticker-card",content:"both",include_activity:false,story_count:5,section_order:"players_first",scroll_style:"step",auto_scroll:true,scroll_speed:"normal",frame:false,team_header:"logo_name",league_header:"logo_name"};}
  static getConfigForm(){return {schema:[
    {name:"roster_entity",selector:{entity:{domain:"sensor"}}},{name:"league_entity",selector:{entity:{domain:"sensor"}}},
    {name:"content",selector:{select:{options:[{value:"players",label:"Players"},{value:"scoreboard",label:"Scoreboard"},{value:"both",label:"Players + Scoreboard"}]}}},{name:"include_activity",selector:{boolean:{}}},{name:"story_count",selector:{number:{min:1,max:20,mode:"box"}}},
    {name:"section_order",selector:{select:{options:[{value:"players_first",label:"Players → Scoreboard"},{value:"scoreboard_first",label:"Scoreboard → Players"}]}}},
    {name:"scroll_style",selector:{select:{options:[{value:"step",label:"Step"},{value:"smooth",label:"Smooth / continuous"}]}}},
    {name:"team_header",selector:{select:{options:[{value:"logo_name",label:"Logo + name"},{value:"logo",label:"Logo only"},{value:"name",label:"Name only"},{value:"hidden",label:"Hidden"}]}}},
    {name:"league_header",selector:{select:{options:[{value:"logo_name",label:"Logo + name"},{value:"logo",label:"Logo only"},{value:"name",label:"Name only"},{value:"hidden",label:"Hidden"}]}}},
    {name:"team_label",selector:{text:{}}},{name:"league_label",selector:{text:{}}},{name:"header_background_color",selector:{color_rgb:{}}},
    {name:"show_bench",selector:{boolean:{}}},{name:"show_live_halo",selector:{boolean:{}}},{name:"live_halo_color",selector:{color_rgb:{}}},{name:"size",selector:{select:{options:[{value:"compact",label:"Compact"},{value:"standard",label:"Standard"},{value:"large",label:"Large"},{value:"xl",label:"XL / wall panel"}]}}},
    {name:"auto_scroll",selector:{boolean:{}}},{name:"scroll_speed",selector:{select:{options:["slow","normal","fast"]}}},{name:"frame",selector:{boolean:{}}},
    {name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},
    {name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},
    {name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}
  ]};}
  getGridOptions(){return {rows:"auto",columns:12,min_rows:2,min_columns:4};}
  disconnectedCallback(){this.stopMotion();}
  roster(){return findRoster(this.hass,this._config.roster_entity||this._config.entity)||findRoster(this.hass);}
  league(){return findLeague(this.hass,this._config.league_entity||this._config.entity)||findLeague(this.hass);}
  sectionData(kind){if(kind==="team"){const a=this.roster()?.attributes||{};return {kind,name:this._config.team_label||a.team_name||"My Team",logo:a.team_logo,setting:this._config.team_header||"logo_name"};}const l=this.league(),a=l?.attributes||{};return {kind,name:this._config.league_label||l?.state||a.league_name||"League",logo:a.league_logo||ESPN_FANTASY_ICON,setting:this._config.league_header||"logo_name"};}
  identityMarkup(kind){const d=this.sectionData(kind);if(d.setting==="hidden")return "";return (d.setting!=="name"?teamLogo(d.logo,d.name):"")+(d.setting!=="logo"?'<strong>'+esc(d.name)+"</strong>":"");}
  orderedKinds(mode){let kinds;if(mode==="players")kinds=["team"];else if(mode==="scoreboard")kinds=["league"];else kinds=this._config.section_order==="scoreboard_first"?["league","team"]:["team","league"];if(this._config.include_activity===true)kinds.push("activity");return kinds;}
  baseMarkup(){const mode=this._config.content||(this._config.type==="custom:espn-fantasy-league-ticker-card"?"scoreboard":"both"),r=this.roster(),ra=r?.attributes||{},l=this.league(),la=l?.attributes||{},parts={team:[],league:[],activity:[]};for(const p of rosterOrder((this._config.show_bench?ra.players:ra.starters)||ra.players||[]))parts.team.push('<div class="ticker-item" data-kind="team" data-copy="0">'+playerTile(p,{showSlot:true,showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color})+"</div>");for(const g of la.scoreboard||[])parts.league.push('<div class="ticker-item" data-kind="league" data-copy="0">'+leagueGame(g)+"</div>");for(const [i,event] of (la.activity||[]).slice(0,Math.min(20,Math.max(1,Number(this._config.story_count)||5))).entries())parts.activity.push('<div class="ticker-item activity-ticker-item" data-kind="activity" data-copy="0">'+activityItem(event,true,i)+"</div>");return this.orderedKinds(mode).flatMap(k=>parts[k]).join("");}
  markup(){const base=this.baseMarkup();return this._config.scroll_style==="smooth"&&base?base+base.replaceAll('data-copy="0"','data-copy="1"'):base;}
  cycleWidth(){const first=this.shadowRoot.querySelector('.ticker-item[data-copy="0"]'),copy=this.shadowRoot.querySelector('.ticker-item[data-copy="1"]');return first&&copy?copy.offsetLeft-first.offsetLeft:0;}
  currentKind(){const viewport=this.shadowRoot.querySelector(".ticker-viewport"),items=[...this.shadowRoot.querySelectorAll('.ticker-item[data-copy="0"]')];if(!items.length)return this.orderedKinds(this._config.content||"both")[0]||"team";const x=viewport?.scrollLeft||0,cycle=this.cycleWidth(),pos=cycle?x%cycle:x,identity=this.shadowRoot.querySelector(".ticker-identity"),edge=pos+(identity&&!identity.classList.contains("hidden")?identity.offsetWidth:0)+8;let current=items[0];for(const item of items){if(item.offsetLeft<=edge)current=item;else break;}return current.dataset.kind||"team";}
  updateIdentity(kind=this.currentKind()){const box=this.shadowRoot.querySelector(".ticker-identity");if(!box)return;const html=this.identityMarkup(kind);if(box.dataset.kind===kind&&box.innerHTML===html)return;box.dataset.kind=kind;box.innerHTML=html;box.classList.toggle("hidden",!html);}
  syncMotion(){this.stopMotion();const viewport=this.shadowRoot.querySelector(".ticker-viewport"),items=[...this.shadowRoot.querySelectorAll('.ticker-item[data-copy="0"]')];if(!viewport||!items.length){this.updateIdentity();return;}this.updateIdentity(this.currentKind());if(!this._config.auto_scroll)return;if(this._config.scroll_style==="smooth"){const speed={slow:18,normal:30,fast:48}[this._config.scroll_speed]||30;const tick=(ts)=>{if(!this._lastFrame)this._lastFrame=ts;const dt=Math.min(50,ts-this._lastFrame);this._lastFrame=ts;const cycle=this.cycleWidth();viewport.scrollLeft+=speed*dt/1000;if(cycle&&viewport.scrollLeft>=cycle)viewport.scrollLeft-=cycle;this.updateIdentity(this.currentKind());this._raf=requestAnimationFrame(tick);};this._raf=requestAnimationFrame(tick);return;}const ms={slow:6000,normal:4000,fast:2500}[this._config.scroll_speed]||4000;this._index=Math.max(0,Math.min(this._index,items.length-1));this._timer=setInterval(()=>{const current=[...this.shadowRoot.querySelectorAll('.ticker-item[data-copy="0"]')];if(current.length<2)return;this._index=(this._index+1)%current.length;const item=current[this._index];viewport.scrollTo({left:item.offsetLeft,behavior:this._index===0?"auto":"smooth"});this.updateIdentity(item.dataset.kind);},ms);}
  tickerPlayers(){return this.roster()?.attributes?.players||[];}
  bindTickerPlayers(){this.bindPlayers(id=>this.openPlayer(this.tickerPlayers().find(p=>String(p.id)===String(id)),this._config.stats));this.bindActivities(this.league()?.attributes?.activity||[]);}
  updateTicker(){const track=this.shadowRoot.querySelector(".ticker-track"),viewport=this.shadowRoot.querySelector(".ticker-viewport");if(!track||!viewport){this.render();return;}const left=viewport.scrollLeft,oldImages=new Map();track.querySelectorAll("img[src]").forEach(img=>{const key=img.getAttribute("src"),list=oldImages.get(key)||[];list.push(img);oldImages.set(key,list);});this.stopMotion();track.innerHTML=this.markup();track.querySelectorAll("img[src]").forEach(img=>{const list=oldImages.get(img.getAttribute("src"));const prior=list?.shift();if(prior&&prior!==img)img.replaceWith(prior);});viewport.scrollLeft=left;this.bindTickerPlayers();requestAnimationFrame(()=>{const cycle=this.cycleWidth();if(cycle&&viewport.scrollLeft>=cycle)viewport.scrollLeft%=cycle;this.syncMotion();});}
  render(){if(!this.hass)return;this.stopMotion();const headerBg=cssColor(this._config.header_background_color,"var(--card-background-color,var(--primary-background-color))"),markup=this.markup(),frameless=this._config.frame===false,size=this._config.size||"standard",firstKind=this.orderedKinds(this._config.content||(this._config.type==="custom:espn-fantasy-league-ticker-card"?"scoreboard":"both"))[0]||"team",identity=this.identityMarkup(firstKind),smooth=this._config.scroll_style==="smooth";this.shadowRoot.innerHTML='<style>'+this.styles()+':host{--ticker-header-bg:'+headerBg+'}.ticker-shell{position:relative;min-width:0;overflow:hidden}.ticker-identity{position:absolute;left:0;top:0;bottom:0;z-index:3;width:190px;display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 16px;box-sizing:border-box;background:var(--ticker-header-bg);border-right:1px solid var(--divider-color)}.ticker-identity:after{content:"";position:absolute;top:0;bottom:0;right:-24px;width:24px;pointer-events:none;background:linear-gradient(90deg,var(--ticker-header-bg) 0%,var(--ticker-header-bg) 35%,transparent 100%)}.ticker-identity.hidden{display:none}.ticker-identity .team-logo-wrap{margin:0;width:46px;height:46px;flex:0 0 46px}.ticker-identity .team-logo,.ticker-identity .team-logo-fallback{width:46px;height:46px}.ticker-identity strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ticker-viewport{min-width:0;width:100%;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain}.ticker-track{display:flex;gap:8px;width:max-content;min-width:100%;padding-left:190px;box-sizing:border-box}.ticker-identity.hidden+.ticker-viewport .ticker-track{padding-left:0}.ticker-track.step{scroll-snap-type:x mandatory}.ticker-item{flex:0 0 auto;scroll-snap-align:start;display:flex;align-items:stretch}.ticker-item>.player-tile{min-width:320px;height:100%;box-sizing:border-box}.ticker-item>.league-game{min-width:280px;height:100%;box-sizing:border-box}.activity-ticker-item>.activity-item{min-width:520px;height:100%;box-sizing:border-box;display:grid;grid-template-columns:minmax(150px,auto) minmax(260px,1fr);grid-template-rows:1fr auto;gap:4px 14px;align-items:center}.activity-ticker-item .activity-team{grid-row:1 / 3}.activity-ticker-item .activity-players{margin:0;flex-wrap:nowrap}.activity-ticker-item .activity-meta{grid-column:2}.fantasy-ticker-card.size-compact .activity-ticker-item>.activity-item{min-width:390px}.fantasy-ticker-card.size-large .activity-ticker-item>.activity-item{min-width:620px}.fantasy-ticker-card.size-xl .activity-ticker-item>.activity-item{min-width:760px}.fantasy-ticker-card.frameless{background:transparent!important;border:none!important;box-shadow:none!important;backdrop-filter:none!important}.fantasy-ticker-card.frameless .wrap{padding:0}.fantasy-ticker-card.size-compact .ticker-item>.player-tile{min-width:220px;grid-template-columns:40px minmax(0,1fr) auto;min-height:54px}.fantasy-ticker-card.size-compact .portrait{width:40px;height:40px}.fantasy-ticker-card.size-large .ticker-item>.player-tile{min-width:340px;grid-template-columns:62px minmax(0,1fr) auto;min-height:82px}.fantasy-ticker-card.size-large .portrait{width:62px;height:62px}.fantasy-ticker-card.size-xl .ticker-item>.player-tile{min-width:430px;grid-template-columns:82px minmax(0,1fr) auto;min-height:108px}.fantasy-ticker-card.size-xl .portrait{width:82px;height:82px}@media(max-width:600px){.ticker-identity{width:130px;padding:6px 10px}.ticker-track{padding-left:130px}.ticker-identity .team-logo-wrap{width:38px;height:38px;flex-basis:38px}.ticker-identity .team-logo,.ticker-identity .team-logo-fallback{width:38px;height:38px}}</style><ha-card class="fantasy-ticker-card size-'+esc(size)+" "+(frameless?"frameless":"")+'"><div class="wrap">'+(markup?'<div class="ticker-shell"><div class="ticker-identity'+(identity?"":" hidden")+'" data-kind="'+esc(firstKind)+'">'+identity+'</div><div class="ticker-viewport"><div class="ticker-track '+(smooth?"smooth":"step")+'">'+markup+"</div></div></div>":'<div class="empty">No fantasy ticker data yet.</div>')+"</div></ha-card>"+this.dialog();this.bindTickerPlayers();this.bindDialog();this.restoreDialog(this.tickerPlayers(),this._config.stats);const viewport=this.shadowRoot.querySelector(".ticker-viewport");viewport?.addEventListener("scroll",()=>{if(this._config.scroll_style!=="smooth")this.updateIdentity(this.currentKind());},{passive:true});requestAnimationFrame(()=>this.syncMotion());}
}
class ESPNFantasyUnifiedTickerCard extends ESPNFantasyLeagueTickerCard { static getStubConfig(){return {type:"custom:espn-fantasy-ticker-card",content:"both",section_order:"players_first",scroll_style:"step",auto_scroll:true,scroll_speed:"normal",frame:false,team_header:"logo_name",league_header:"logo_name"};} }

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
    const rows=stories.map(({p,item})=>{const headline=String(item.headline||item.description||"Player update").trim(),description=item.description&&item.description!==item.headline?String(item.description).trim():"",spin=String(item.spin||"").trim(),published=item.published?fmtKickoff(item.published):"",title=item.url?`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(headline)}</a>`:esc(headline);return `<article class="feed-story" data-news-player="${esc(p.id)}"><div class="feed-player"><div class="portrait">${p.headshot?`<img src="${esc(p.headshot)}" alt="" loading="lazy">`:""}${injuryBadge(p)}</div><div><div class="player-name">${esc(p.name)}</div><div class="player-meta">${esc([p.position,p.nfl_team].filter(Boolean).join(" · "))}</div></div></div><div class="news-meta">${esc(published)}${item.type?` · ${esc(item.type)}`:""}</div><div class="news-headline">${title}</div>${description?`<div class="news-description">${esc(description)}</div>`:""}${spin?`<div class="news-spin"><strong>Fantasy:</strong> ${esc(spin)}</div>`:""}</article>`;}).join("");
    this.shadowRoot.innerHTML=`<style>${this.styles()}.news-feed{display:grid;gap:10px}.feed-story{padding:12px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.feed-player{display:flex;align-items:center;gap:10px;margin-bottom:10px}.feed-player .portrait{width:48px;height:48px;flex:0 0 48px}.feed-story+.feed-story{margin-top:2px}</style><ha-card><div class="wrap"><div class="header"><div class="title">Fantasy news</div><div class="subtle">Newest ${stories.length}</div></div>${stories.length?`<div class="news-feed">${rows}</div>`:'<div class="empty">No player news available yet.</div>'}</div></ha-card>${this.dialog()}`;this.shadowRoot.querySelectorAll("[data-news-player]").forEach(x=>x.addEventListener("click",e=>{if(e.target.closest("a"))return;const hit=stories.find(({p})=>String(p.id)===String(x.dataset.newsPlayer));this.openPlayer(hit?.p,this._config.stats);}));this.bindDialog();
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

for(const [tag,cls] of [["espn-fantasy-player-card",ESPNFantasyPlayerCard],["espn-fantasy-player-ticker-card",ESPNFantasyTickerCard],["espn-fantasy-team-card",ESPNFantasyTeamCard],["espn-fantasy-matchup-card",ESPNFantasyMatchupCard],["espn-fantasy-league-card",ESPNFantasyLeagueCard],["espn-fantasy-league-ticker-card",ESPNFantasyLeagueTickerCard],["espn-fantasy-ticker-card",ESPNFantasyUnifiedTickerCard],["espn-fantasy-news-card",ESPNFantasyNewsCard]]) if(!customElements.get(tag)) customElements.define(tag,cls);
window.customCards=window.customCards||[];
for(const card of [
 {type:"espn-fantasy-player-card",name:"ESPN Fantasy Player",description:"Individual player card with stats, outlook, and news.",preview:true},
 {type:"espn-fantasy-league-card",name:"ESPN Fantasy League",description:"Roster, standings, scoreboard, matchup, and optional news in one card.",preview:true},
 {type:"espn-fantasy-ticker-card",name:"ESPN Fantasy Ticker",description:"Players, league scores, or both with customizable section headers.",preview:true},
 {type:"espn-fantasy-news-card",name:"ESPN Fantasy News",description:"Newest fantasy player stories with player portraits and names.",preview:true},
]) if(!window.customCards.some((x)=>x.type===card.type)) window.customCards.push({...card,documentationURL:"https://github.com/sutty-2017/ha-espn-fantasy"});
console.info(`%c ESPN Fantasy cards ${CARD_VERSION} loaded`,"color:#e31837;font-weight:bold;");

