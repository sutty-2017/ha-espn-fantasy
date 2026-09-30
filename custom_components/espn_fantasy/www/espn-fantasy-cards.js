const CARD_VERSION = "0.1.37";
const ESPN_FANTASY_ICON = `/espn_fantasy/icon.png?v=${CARD_VERSION}`;

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
  const advice=adviceAllowed&&p.lineup_alert==="lower_than_bench"?`<span class="lineup-advice-badge lineup-down" title="${esc(`Bench upgrade: ${p.lineup_alert_player_name||"player"} +${num(p.lineup_alert_difference)} pts`)}">−</span>`:adviceAllowed&&p.lineup_alert==="higher_than_starter"?`<span class="lineup-advice-badge lineup-up" title="${esc(`Projected upgrade over ${p.lineup_alert_player_name||"starter"}: +${num(p.lineup_alert_difference)} pts`)}">+</span>`:"";
  const projection = p.projected_points == null ? "" : `Proj ${num(p.projected_points)}`;
  const meta = [opts.showSlot ? p.lineup_slot : p.position, p.nfl_team, opponentText(p)].filter(Boolean).join(" · ");
  const badge = status === "in_progress" ? '<span class="status live">LIVE</span>' :
    status === "final" ? '<span class="status final">FINAL</span>' :
    status === "bye" ? '<span class="status">BYE</span>' : "";
  const injury = injuryBadge(p);
  const liveHalo = status === "in_progress" && opts.showLiveHalo !== false;
  const haloStyle = liveHalo ? ` style="--live-halo:${esc(cssColor(opts.haloColor))}"` : "";
  const watermark=opts.teamWatermark&&p.nfl_team_logo?`<img class="player-team-watermark" src="${esc(p.nfl_team_logo)}" alt="" loading="lazy">`:"";
  return `<div class="player-tile ${esc(status)}" data-player-id="${esc(p.id)}" data-entity="${esc(entity)}">${watermark}
    <div class="portrait${liveHalo ? " live-halo" : ""}"${haloStyle}>${p.headshot ? `<img src="${esc(p.headshot)}" alt="" loading="lazy">` : ""}${injury}${advice}</div>
    <div class="player-main"><div class="player-name">${esc(p.name)}</div><div class="player-meta">${esc(meta)}</div><div class="badges">${badge}</div></div>
    <div class="player-score"><strong>${esc(primary)}</strong><span>${projection}</span></div>
  </div>`;
}

function statGrid(p, order) {
  const stats=p.stats||{}, labels=p.stat_labels||{};
  const keys=(order?.length?order:p.default_stats||[]).filter((key)=>stats[key]!==undefined);
  return keys.length ? `<div class="stat-grid">${keys.map((key)=>`<div class="stat-cell"><span>${esc(labels[key]||key.replaceAll("_"," "))}</span><strong>${num(stats[key])}</strong></div>`).join("")}</div>` : '<div class="empty">No game stats available yet.</div>';
}
const orderedStats = (p, configured) => { const available=Object.keys(p?.stats||{}); return (configured?.length?configured:p?.default_stats||[]).filter(k=>available.includes(k)); };

function outlookDetails(p, open = true) {
  const weekly = String(p?.weekly_outlook || "").trim();
  const season = String(p?.season_outlook || "").trim();
  if (!weekly && !season) return "";
  const updated = p.last_news_date ? `<div class="outlook-date">Updated ${esc(fmtKickoff(p.last_news_date))}</div>` : "";
  const body = `${updated}${weekly ? `<div class="outlook-title">This week</div><div class="outlook-text">${esc(weekly)}</div>` : ""}${season ? `<div class="outlook-title">Season outlook</div><div class="outlook-text">${esc(season)}</div>` : ""}`;
  return popupSection("outlook", "Fantasy outlook", body, open);
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
function biographyDetails(p, collapsible = true, open = false) {
  const b=p?.biography||{};
  const rows=[["Height",b.height],["Weight",b.weight],["Age",b.age],["Born",b.birthplace],["College",b.college],["Experience",b.experience!=null?(b.experience+" years"):null],["Jersey",b.jersey?("#"+b.jersey):null]].filter(([,value])=>value!==null&&value!==undefined&&value!=="");
  const draft=b.draft||{},draftText=[draft.year,draft.round!=null?("Round "+draft.round):null,draft.selection!=null?("Pick "+draft.selection):null,draft.team].filter(Boolean).join(" · ");
  if(draftText)rows.push(["Draft",draftText]);
  const history=(b.team_history||[]).map(item=>'<div class="bio-history-row">'+(item.logo?'<img src="'+esc(item.logo)+'" alt="">':"")+'<span>'+esc(item.team_name||"Team")+'</span><strong>'+esc(item.seasons||"")+'</strong></div>').join("");
  if(!rows.length&&!history)return "";
  const body='<div class="bio-grid">'+rows.map(([label,value])=>'<div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join("")+'</div>'+(history?'<div class="bio-history"><div class="outlook-title">Team history</div>'+history+'</div>':"");
  return collapsible?popupSection("biography","Biography",body,open):'<div class="inline-biography"><div class="outlook-heading">Biography</div>'+body+'</div>';
}

function playerDetails(p, order, opts = {}) {
  const sections=opts.sectionState||{};
  return `<div class="player-details">${playerTile(p,{...opts,teamWatermark:opts.teamWatermark!==false})}${biographyDetails(p,true,sections.biography===true)}${popupSection("stats","Stats",statGrid(p,order),sections.stats!==false)}${popupSection("history","Historical stats",historicalDetails(p),sections.history!==false)}${outlookDetails(p,sections.outlook!==false)}${popupSection("news","Latest news",newsDetails(p),sections.news!==false)}</div>`;
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
      {name:"show_team_logo_background",selector:{boolean:{}}},
      {name:"live_halo_color",selector:{color_rgb:{}}},
      {name:"appearance",selector:{select:{mode:"dropdown",options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},
      {name:"accent_color",selector:{color_rgb:{}}},
      {name:"glass_strength",selector:{select:{mode:"dropdown",options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},
      {name:"border_style",selector:{select:{mode:"dropdown",options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}
    ];
    this.shadowRoot.innerHTML=`<style>:host{display:block}.stats-title{font-weight:600;margin:18px 0 4px}.hint{font-size:12px;color:var(--secondary-text-color);margin-bottom:8px}.row{display:grid;grid-template-columns:minmax(0,1fr) 40px 40px;gap:6px;align-items:center;min-height:42px;border-bottom:1px solid var(--divider-color)}button{border:0;background:var(--secondary-background-color);color:var(--primary-text-color);border-radius:8px;min-height:34px;cursor:pointer}button:disabled{opacity:.35}label{overflow:hidden;text-overflow:ellipsis}</style><ha-form></ha-form><div class="stats-title">Expanded stats</div><div class="hint">Choose the stats to show and use the arrows to set their order.</div>${state?keys.map((k,i)=>`<div class="row"><label><input type="checkbox" data-key="${esc(k)}" ${selected.includes(k)?"checked":""}> ${esc(p.stat_labels[k]||k.replaceAll("_"," "))}</label><button data-dir="-1" data-i="${i}" ${i===0?"disabled":""}>↑</button><button data-dir="1" data-i="${i}" ${i===keys.length-1?"disabled":""}>↓</button></div>`).join(""):'<div class="hint">Select a player entity to configure stats.</div>'}`;
    const form=this.shadowRoot.querySelector("ha-form");form.hass=this.hass;form.data=this._config;form.schema=schema;form.computeLabel=(s)=>({entity:"Player",layout:"Layout",display:"Display mode",show_live_halo:"Show live-player halo",show_team_logo_background:"Show team logo background",live_halo_color:"Live halo color",appearance:"Appearance",accent_color:"Accent color",glass_strength:"Glass strength",border_style:"Border"}[s.name]||s.name);form.addEventListener("value-changed",(e)=>this.fire({...this._config,...e.detail.value}));
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
      const labels={started:"STARTED",benched:"BENCHED",roster_move:"ROSTER MOVE",added:"ADDED",dropped:"DROPPED",traded:"TRADED"};
      const cols=ordered.map(item=>renderPlayer(item,labels[item.type]||"PLAYER")).join("");
      body=`<div class="transaction-head">${teamLogo(event.team_logo,event.team_name||"Team")}<div><strong>${esc(event.team_name||"League transaction")}</strong><div class="activity-meta">${meta}</div></div></div><div class="transaction-grid ${ordered.length===1?"single":""}">${cols||'<div class="empty">Player details unavailable for this transaction.</div>'}</div>`;
    }
    dialog.classList.add("transaction-dialog");
    dialog.querySelector(".dialog-content").innerHTML=body;
    if(!dialog.open)dialog.showModal();
  }
  bindActivities(events){ this.shadowRoot.querySelectorAll("[data-activity-index]").forEach(x=>x.addEventListener("click",()=>this.openActivity((events||[])[Number(x.dataset.activityIndex)],this._config.stats))); }
  openPlayer(p, order){ if(!p)return; this._openPlayerId=String(p.id); const dialog=this.shadowRoot.querySelector("dialog.player-dialog"); if(!dialog)return; dialog.querySelector(".dialog-back")?.classList.remove("visible"); dialog.classList.remove("transaction-dialog"); const key=String(p.id),sectionState=this._popupSections?.[key]||{}; dialog.querySelector(".dialog-content").innerHTML=playerDetails(p,order,{showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color,teamWatermark:this._config.show_team_logo_background!==false,sectionState}); dialog.querySelectorAll(".popup-section").forEach(x=>x.addEventListener("toggle",()=>{this._popupSections??={};this._popupSections[key]??={};this._popupSections[key][x.dataset.popupSection]=x.open;})); if(!dialog.open)dialog.showModal(); }
  dialog(){ return `<dialog class="player-dialog"><button class="dialog-back" aria-label="Back" title="Back">‹</button><button class="dialog-close" aria-label="Close">×</button><div class="dialog-content"></div></dialog>`; }
  bindDialog(){ const d=this.shadowRoot.querySelector("dialog.player-dialog"); if(!d)return; const close=()=>{this._openPlayerId=null;d.close();}; d.querySelector(".dialog-close")?.addEventListener("click",close); d.addEventListener("click",(e)=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}); d.addEventListener("close",()=>{this._openPlayerId=null;}); }
  restoreDialog(players, order){ if(!this._openPlayerId)return; const p=(players||[]).find(x=>String(x.id)===String(this._openPlayerId)); if(p)this.openPlayer(p,order); else this._openPlayerId=null; }
  appearanceStyles(){const mode=this._config.appearance||"theme",accent=cssColor(this._config.accent_color,"var(--primary-color)"),blur=this._config.glass_strength==="strong"?"18px":"10px",border=this._config.border_style||"theme";return `:host{--espn-accent:${accent}}ha-card{overflow:hidden;background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color);border-radius:var(--ha-card-border-radius,12px)}${mode==="glass"?`ha-card{background:color-mix(in srgb,var(--ha-card-background,var(--card-background-color)) ${this._config.glass_strength==="strong"?"72%":"56%"},transparent)!important;backdrop-filter:blur(${blur}) saturate(1.15);-webkit-backdrop-filter:blur(${blur}) saturate(1.15)}`:""}${mode==="solid"?`ha-card{background:var(--ha-card-background,var(--card-background-color))!important;backdrop-filter:none!important}`:""}${mode==="transparent"?`ha-card{background:transparent!important;box-shadow:none!important;backdrop-filter:none!important}`:""}${border==="none"?`ha-card{border:none!important}`:""}${border==="subtle"?`ha-card{border:1px solid color-mix(in srgb,var(--primary-text-color) 14%,transparent)!important}`:""}`; }
  styles(){ return `
    :host{display:block;color:var(--primary-text-color);overflow-anchor:none}${this.appearanceStyles()}.wrap{padding:16px;box-sizing:border-box}
    .header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.title{font-size:20px;font-weight:700}.subtle{font-size:12px;color:var(--secondary-text-color)}
    .player-list{display:grid;gap:7px}.player-tile{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:64px;padding:7px 10px;border-radius:14px;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);cursor:pointer;box-sizing:border-box}.player-tile>*:not(.player-team-watermark){position:relative;z-index:1}.player-team-watermark{position:absolute;z-index:0;right:5%;top:50%;width:46%;height:120%;object-fit:contain;transform:translateY(-50%);opacity:.12;pointer-events:none;filter:saturate(.8)}
    .portrait{position:relative;width:48px;height:48px;border-radius:50%;background:color-mix(in srgb,var(--primary-text-color) 7%,transparent)}.portrait.live-halo{box-shadow:0 0 0 2px var(--live-halo,#35d07f),0 0 12px 2px var(--live-halo,#35d07f),0 0 22px color-mix(in srgb,var(--live-halo,#35d07f) 55%,transparent)}.portrait img{width:100%;height:100%;object-fit:cover;border-radius:50%}.injury-badge{position:absolute;right:-4px;bottom:-3px;min-width:20px;height:20px;padding:0 4px;box-sizing:border-box;border-radius:999px;display:grid;place-items:center;font-size:9px;font-weight:900;line-height:1;color:#fff;background:var(--error-color,#db4437);border:2px solid var(--card-background-color,var(--primary-background-color))}.injury-out,.injury-ir{background:var(--error-color,#db4437)}.lineup-advice-badge{position:absolute;left:-4px;bottom:-3px;width:20px;height:20px;box-sizing:border-box;border-radius:50%;display:grid;place-items:center;font-size:15px;font-weight:900;line-height:1;color:#fff;border:2px solid var(--card-background-color,var(--primary-background-color));z-index:2}.lineup-advice-badge.lineup-down{background:var(--warning-color,#f39c12)}.lineup-advice-badge.lineup-up{background:var(--success-color,#2eaf62)}.player-main{min-width:0}.player-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-meta{font-size:12px;color:var(--secondary-text-color);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .player-score{text-align:right;display:flex;flex-direction:column;gap:2px}.player-score strong{font-size:16px}.player-score span{font-size:11px;color:var(--secondary-text-color)}.badges{display:flex;gap:4px;margin-top:4px}.status,.injury{font-size:9px;font-weight:800;padding:2px 5px;border-radius:999px;background:var(--secondary-background-color)}.status.live{background:var(--error-color);color:white}.status.final{opacity:.75}.injury{background:color-mix(in srgb,var(--warning-color,#f6a623) 25%,transparent);color:var(--primary-text-color)}
    .matchup-shell{position:relative}.matchup-week{text-align:center;font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--secondary-text-color);margin-bottom:8px}.team-head{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:start;text-align:center;margin-bottom:14px}.team-side{display:flex;flex-direction:column;align-items:center}.team-logo-wrap{position:relative;width:58px;height:58px;margin:0 auto 6px}.team-logo,.team-logo-fallback{position:absolute;inset:0;width:58px;height:58px}.team-logo{display:block;object-fit:contain;opacity:1}.team-logo.loaded{opacity:1}.team-logo-fallback{display:grid;place-items:center;border-radius:50%;background:var(--secondary-background-color);font-weight:800;font-size:18px;color:var(--secondary-text-color)}.team-name{font-weight:700}.big-score{font-size:28px;font-weight:800}.projection{font-size:11px;color:var(--secondary-text-color)}.vs{font-size:11px;font-weight:800;color:var(--secondary-text-color);align-self:center}.win-prob{font-size:12px;font-weight:700;margin-top:5px}.starter-progress{width:min(150px,100%);margin-top:7px}.progress-track{height:4px;border-radius:99px;overflow:hidden;background:color-mix(in srgb,var(--primary-text-color) 12%,transparent)}.progress-track span{display:block;height:100%;border-radius:inherit;background:var(--espn-accent,var(--primary-color))}.progress-label{font-size:9px;color:var(--secondary-text-color);margin-top:3px;white-space:nowrap}
    .league-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:20px;font-weight:800;margin-bottom:12px}.league-title span,.league-section-title{font-size:11px;color:var(--secondary-text-color);text-transform:uppercase}.league-section-title{font-weight:800;margin:16px 0 8px}.league-table-head,.league-row{display:grid;grid-template-columns:28px minmax(0,1fr) 62px 58px;gap:8px;align-items:center}.league-table-head{font-size:10px;color:var(--secondary-text-color);padding:0 6px 5px}.league-row{min-height:46px;padding:5px 6px;border-top:1px solid var(--divider-color);font-size:12px}.league-team{display:flex;align-items:center;gap:7px;min-width:0}.league-team .team-logo-wrap,.league-team .team-logo,.league-team .team-logo-fallback{width:30px;height:30px;margin:0}.league-team .team-logo-fallback{font-size:10px}.league-team span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.league-scoreboard{display:grid;gap:8px}.league-game{padding:9px 10px;border-radius:12px;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.league-game-team{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:7px;align-items:center}.league-game-team+.league-game-proj{margin-bottom:6px}.league-game-team .team-logo-wrap,.league-game-team .team-logo,.league-game-team .team-logo-fallback{width:28px;height:28px;margin:0}.league-game-team .team-logo-fallback{font-size:9px}.league-game-team span{font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.league-game-team strong{font-size:16px}.league-game-proj{font-size:9px;color:var(--secondary-text-color);text-align:right;margin-top:-5px}.injury-detail{margin-top:8px;text-align:center;font-size:12px;font-weight:700;color:var(--secondary-text-color)}.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px;margin-top:12px}.stat-cell{padding:10px;min-height:54px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:3px}.stat-cell span{font-size:10px;color:var(--secondary-text-color);text-transform:uppercase}.stat-cell strong{font-size:18px}.player-dialog{width:min(520px,calc(100% - 32px));border:var(--ha-card-border-width,0) solid var(--ha-card-border-color,var(--divider-color));border-radius:var(--ha-card-border-radius,16px);background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color);box-shadow:var(--ha-card-box-shadow);padding:16px}.player-dialog::backdrop{background:rgba(0,0,0,.55);backdrop-filter:blur(3px)}.dialog-back{position:absolute;left:10px;top:8px;display:none;border:0;background:transparent;color:var(--primary-text-color);font-size:30px;line-height:1;cursor:pointer;z-index:3}.dialog-back.visible{display:block}.dialog-back.visible~.dialog-content{padding-top:22px}.player-dialog.transaction-dialog{width:min(980px,calc(100% - 32px));max-height:calc(100vh - 40px);overflow:auto}.transaction-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}.transaction-head .team-logo-wrap,.transaction-head .team-logo,.transaction-head .team-logo-fallback,.trade-team .team-logo-wrap,.trade-team .team-logo,.trade-team .team-logo-fallback{width:42px;height:42px;margin:0}.transaction-grid,.trade-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.transaction-grid.single{grid-template-columns:1fr}.transaction-label{text-align:center;font-size:11px;font-weight:900;letter-spacing:.08em;margin-bottom:6px}.transaction-player{min-width:0}.transaction-player .player-tile{cursor:default}.trade-side{min-width:0;padding:10px;border-radius:12px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}.trade-team{display:flex;align-items:center;gap:9px;margin-bottom:10px;padding-bottom:9px;border-bottom:1px solid var(--divider-color)}.transaction-meta{text-align:center;margin-bottom:10px}.dialog-close{float:right;border:0;background:transparent;color:var(--primary-text-color);font-size:28px;cursor:pointer}.dialog-content{clear:both}.popup-section{margin-top:12px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);overflow:hidden}.popup-section>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;cursor:pointer;font-size:13px;font-weight:800}.popup-section>summary::-webkit-details-marker{display:none}.popup-chevron{font-size:18px;line-height:1;transition:transform .18s ease}.popup-section[open] .popup-chevron{transform:rotate(180deg)}.popup-section-body{padding:0 12px 12px}.popup-section .stat-grid{margin-top:0}.season-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:9px}.season-summary>div{display:flex;flex-direction:column;align-items:center;padding:7px;border-radius:9px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}.season-summary span{font-size:9px;text-transform:uppercase;color:var(--secondary-text-color)}.season-summary strong{font-size:12px}.history-list{display:grid;gap:7px}.history-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--divider-color)}.history-row:first-child{border-top:0}.history-stats{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:10px;color:var(--secondary-text-color)}.history-points{display:flex;flex-direction:column;align-items:flex-end;white-space:nowrap}.history-points span{font-size:10px;color:var(--secondary-text-color)}.outlook-card{margin-top:14px;padding:11px 12px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.outlook-heading{font-size:13px;font-weight:800}.outlook-preview{font-size:13px;line-height:1.45;margin-top:5px;color:var(--secondary-text-color)}.outlook{margin-top:8px;border-top:1px solid var(--divider-color);padding-top:8px}.outlook summary{cursor:pointer;font-weight:700}.outlook-date{font-size:11px;color:var(--secondary-text-color);margin:7px 0}.outlook-title{font-size:12px;font-weight:700;margin-top:10px}.outlook-text{font-size:13px;line-height:1.45;margin-top:4px;white-space:pre-wrap}.news-card{margin-top:14px;padding:11px 12px;border-radius:var(--ha-card-border-radius,12px);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.news-item{padding:10px 0;border-top:1px solid var(--divider-color)}.news-item:first-of-type{border-top:0}.news-meta{font-size:10px;color:var(--secondary-text-color);text-transform:uppercase}.news-headline{font-size:13px;font-weight:750;line-height:1.35;margin-top:3px}.news-headline a{color:var(--primary-text-color);text-decoration:none}.news-description,.news-spin{font-size:12px;line-height:1.45;margin-top:5px;color:var(--secondary-text-color)}.news-spin strong{color:var(--primary-text-color)}.ticker{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:3px}.ticker .player-tile{min-width:270px;scroll-snap-align:start}.activity-item{cursor:pointer}.activity-team{display:flex;align-items:center;gap:8px;min-width:0}.activity-team .team-logo-wrap,.activity-team .team-logo,.activity-team .team-logo-fallback{width:34px;height:34px;margin:0}.activity-team-copy{min-width:0}.activity-team-copy>strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.activity-players{display:grid;gap:5px;margin-top:0}.activity-player{display:flex;align-items:center;gap:7px;min-width:150px}.activity-player>div:last-child{min-width:0}.activity-player strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.activity-player span{display:block;font-size:10px;color:var(--secondary-text-color);white-space:nowrap}.activity-headshot{width:34px;height:34px;border-radius:50%;overflow:hidden;background:var(--secondary-background-color);flex:0 0 34px}.activity-headshot img{width:100%;height:100%;object-fit:cover}.bio-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0}.bio-grid>div{display:flex;flex-direction:column;padding:8px;border-radius:10px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}.bio-grid span{font-size:10px;color:var(--secondary-text-color)}.bio-history{margin-top:10px}.bio-history-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center;padding:5px 0}.bio-history-row img{width:26px;height:26px;object-fit:contain}.bio-history-row strong{font-size:11px;color:var(--secondary-text-color)}.inline-biography{margin-top:12px}.waiver-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.waiver-heading span{font-size:11px;color:var(--secondary-text-color)}.waiver-list{display:grid;gap:5px}.waiver-row{display:grid;grid-template-columns:28px 34px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 9px;border-radius:10px;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.waiver-row.mine{outline:1px solid var(--espn-accent,var(--primary-color))}.waiver-row .team-logo-wrap,.waiver-row .team-logo,.waiver-row .team-logo-fallback{width:30px;height:30px;margin:0}.waiver-row em{font-size:11px;color:var(--secondary-text-color);font-style:normal}.empty{padding:12px;color:var(--secondary-text-color)}
    @media(max-width:600px){.transaction-grid,.trade-grid{grid-template-columns:1fr}.wrap{padding:12px}.player-tile{grid-template-columns:42px minmax(0,1fr) auto}.portrait{width:42px;height:42px}.ticker .player-tile{min-width:240px}.team-head{grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr);gap:4px}.team-logo-wrap,.team-logo,.team-logo-fallback{width:48px;height:48px}.team-name{font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.big-score{font-size:23px}.starter-progress{width:100%}.progress-label{font-size:8px}.win-prob{font-size:11px}}
  `; }
}

class ESPNFantasyPlayerCard extends ESPNBaseCard {
  constructor(){ super(); this._expanded=false; }
  static getStubConfig(){ return {type:"custom:espn-fantasy-player-card",layout:"horizontal",display:"expandable"}; }
  static getConfigElement(){ return document.createElement("espn-fantasy-player-editor"); }

  player(){ const s=this.hass?.states[this._config.entity],a=s?.attributes||{}; return s?{id:a.player_id,name:a.player_name||a.friendly_name,position:a.position,lineup_slot:a.roster_slot,nfl_team:a.nfl_team,nfl_team_logo:a.nfl_team_logo,biography:a.biography||{},headshot:a.headshot,injury_status:a.injury_status,actual_points:a.live_points??a.actual_points??Number(s.state),projected_points:a.projected_points,game_status:a.game_status,game_start:a.game_start,home_away:a.home_away,opponent_abbrev:a.opponent_abbrev,stats:a.stats||{},stat_labels:a.stat_labels||{},default_stats:a.default_stats||[],last_news_date:a.last_news_date,weekly_outlook:a.weekly_outlook,season_outlook:a.season_outlook,news:a.news||[]}:null; }
  render(){ if(!this.hass)return; const p=this.player(),vertical=this._config.layout==="vertical",mode=this._config.display||"expandable",expanded=mode==="expanded"||(mode==="expandable"&&this._expanded); this.shadowRoot.innerHTML=`<style>${this.styles()}${vertical?`.player-tile{grid-template-columns:1fr;text-align:center;justify-items:center}.portrait{width:82px;height:82px}.player-main{width:100%}.player-score{text-align:center}.badges{justify-content:center}`:""}</style><ha-card><div class="wrap">${p?`${playerTile(p,{showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color})}${expanded?`${biographyDetails(p,false)}${statGrid(p,this._config.stats)}${outlookDetails(p)}${newsDetails(p)}`:""}`:'<div class="empty">Choose an ESPN Fantasy player entity.</div>'}</div></ha-card>`; if(p&&mode==="expandable")this.bindPlayers(()=>{this._expanded=!this._expanded;this.render();}); }
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
  static getConfigForm(){ return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"show_bench",selector:{boolean:{}}},{name:"show_team_logo_background",selector:{boolean:{}}},{name:"auto_scroll",selector:{boolean:{}}},{name:"scroll_speed",selector:{select:{options:["slow","normal","fast"]}}},{name:"frame",selector:{boolean:{}}},{name:"size",selector:{select:{options:[{value:"compact",label:"Compact"},{value:"standard",label:"Standard"},{value:"large",label:"Large"},{value:"xl",label:"XL / wall panel"}]}}},{name:"show_live_halo",selector:{boolean:{}}},{name:"live_halo_color",selector:{color_rgb:{}}},{name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},{name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},{name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}]}; }
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
    const opts={showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color,teamWatermark:this._config.show_team_logo_background!==false};
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
function leagueStandings(teams, limit, interactive=false) {
  const rows=(teams||[]).slice(0,limit||undefined);
  return `<div class="league-standings"><div class="league-table-head"><span>#</span><span>Team</span><span>Record</span><span>PF</span></div>${rows.map((t,i)=>`<div class="league-row${interactive?" interactive":""}" ${interactive?`data-team-id="${esc(t.id)}" tabindex="0" role="button"`:""}><strong>${esc(t.standing??i+1)}</strong><div class="league-team">${teamLogo(t.logo,t.name)}<span>${esc(t.name)}</span></div><span>${esc(leagueRecord(t))}</span><span>${num(t.points_for)}</span></div>`).join("")}</div>`;
}
function leagueGame(g,index=null,interactive=false) {
  return `<div class="league-game${interactive?" interactive":""}" ${interactive?`data-scoreboard-index="${esc(index)}" tabindex="0" role="button"`:""}><div class="league-game-team">${teamLogo(g.away_logo,g.away_team_name)}<span>${esc(g.away_team_name||"Away")}</span><strong>${num(g.away_score,2)}</strong></div><div class="league-game-proj">Proj ${num(g.away_projected_score)}</div><div class="league-game-team">${teamLogo(g.home_logo,g.home_team_name)}<span>${esc(g.home_team_name||"Home")}</span><strong>${num(g.home_score,2)}</strong></div><div class="league-game-proj">Proj ${num(g.home_projected_score)}</div></div>`;
}
function leagueScoreboard(games,interactive=false) {
  return `<div class="league-scoreboard">${(games||[]).map((g,i)=>leagueGame(g,i,interactive)).join("")}</div>`;
}
function activityIcon(type="") {
  const t=String(type).toLowerCase();
  return t.includes("trade")?"↔":t.includes("waiver")?"W":t.includes("start")?"↑":t.includes("bench")?"↓":t.includes("roster")?"⇄":t.includes("add")?"+":t.includes("drop")?"−":"•";
}
function activityPlayer(item) {
  const action={started:"Started",benched:"Benched",roster_move:"Roster move",added:"Added",dropped:"Dropped",traded:"Traded"}[item.type]||String(item.type||"").replaceAll("_"," ");
  const slots=item.from_lineup_slot&&item.to_lineup_slot?item.from_lineup_slot+" → "+item.to_lineup_slot:"";
  const meta=[action,slots,item.position,item.nfl_team].filter(Boolean).join(" · ");
  return `<div class="activity-player"><div class="activity-headshot">${item.headshot?`<img src="${esc(item.headshot)}" alt="" loading="lazy">`:""}</div><div><strong>${esc(item.player_name||"Player")}</strong><span>${esc(meta)}</span></div></div>`;
}
function activityItem(event, compact=false, index=0) {
  const when=event.timestamp?fmtKickoff(event.timestamp):"";
  const bid=Number(event.bid_amount)>0?` · FAAB ${num(event.bid_amount,0)}`:"";
  const players=(event.items||[]).map(activityPlayer).join("");
  const meta=esc([when,event.status].filter(Boolean).join(" · ")+bid);
  return `<article class="activity-item${compact?" compact":""}" data-activity-index="${index}"><div class="activity-team">${teamLogo(event.team_logo,event.team_name||"Team")}<div class="activity-team-copy"><strong>${esc(event.team_name||"League transaction")}</strong><div class="activity-meta">${meta}</div></div></div><div class="activity-players">${players}</div></article>`;
}

class ESPNFantasyLeagueEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:"open"});this._config={};}
  set hass(v){this._hass=v;this.shadowRoot.querySelectorAll("ha-form").forEach(form=>form.hass=v);if(!this.shadowRoot.hasChildNodes())this.render();} get hass(){return this._hass;}
  setConfig(v){this._config=v||{};this.render();}
  defaults(){return ["roster","standings","scoreboard","matchup","news","activity","waivers","schedule","bracket"];}
  enabled(){
    const d=this.defaults(),hasNew=d.some(v=>Object.prototype.hasOwnProperty.call(this._config,"section_"+v));
    if(hasNew)return Object.fromEntries(d.map(v=>[v,this._config["section_"+v]!==false]));
    const mode=this._config.display_mode||"all";
    if(mode!=="all")return Object.fromEntries(d.map(v=>[v,v===mode]));
    return {roster:true,standings:true,scoreboard:true,matchup:true,news:this._config.include_news!==false,activity:this._config.include_activity===true,waivers:false,schedule:false,bracket:false};
  }
  order(){const d=this.defaults(),configured=d.map((_,i)=>this._config["section_"+(i+1)]).filter(v=>d.includes(v));return [...new Set([...configured,...d])];}
  visibleOrder(){const enabled=this.enabled();return this.order().filter(v=>enabled[v]);}
  scrollPositions(){const positions=[],seen=new Set();let node=this;while(node){let parent=node.parentNode;if(!parent&&node.getRootNode)parent=node.getRootNode().host;node=parent;if(node instanceof Element&&node.scrollHeight>node.clientHeight+1&&!seen.has(node)){positions.push([node,node.scrollLeft,node.scrollTop]);seen.add(node);}}const doc=document.scrollingElement;if(doc&&!seen.has(doc))positions.push([doc,doc.scrollLeft,doc.scrollTop]);return positions;}
  fire(config){const positions=this.scrollPositions();this._config=config;this.dispatchEvent(new CustomEvent("config-changed",{detail:{config},bubbles:true,composed:true}));this.render();const restore=()=>positions.forEach(([el,left,top])=>{el.scrollLeft=left;el.scrollTop=top;});restore();requestAnimationFrame(()=>{restore();requestAnimationFrame(restore);});}
  toggle(section,checked){const enabled=this.enabled();enabled[section]=checked;if(!Object.values(enabled).some(Boolean))return;const patch={};for(const key of this.defaults())patch["section_"+key]=enabled[key];this.fire({...this._config,...patch});}
  move(i,direction){const visible=this.visibleOrder(),j=i+direction;if(j<0||j>=visible.length)return;[visible[i],visible[j]]=[visible[j],visible[i]];const enabled=this.enabled(),hidden=this.order().filter(v=>!enabled[v]),combined=[...visible,...hidden],patch={};combined.forEach((v,n)=>patch["section_"+(n+1)]=v);this.fire({...this._config,...patch});}
  bindForm(name,schema,labels,data={}){
    const form=this.shadowRoot.querySelector('ha-form[data-form="'+name+'"]');if(!form)return;
    form.hass=this.hass;form.data={...data,...this._config};form.schema=schema;form.computeLabel=x=>labels[x.name]||x.name;
    form.addEventListener("value-changed",e=>this.fire({...this._config,...e.detail.value}));
  }
  render(){
    if(!this.hass)return;
    const enabled=this.enabled(),visible=this.visibleOrder();
    const labels={roster:"Roster",standings:"Standings",scoreboard:"Scoreboard",matchup:"My Matchup",news:"News",activity:"Activity",waivers:"Waivers",schedule:"Schedule",bracket:"Playoff Bracket"};
    const checkboxRows=this.defaults().map(v=>'<label class="section-check"><input type="checkbox" data-section="'+v+'" '+(enabled[v]?"checked":"")+'><span>'+esc(labels[v])+'</span></label>').join("");
    const orderRows=visible.map((v,i,a)=>'<div class="order-row"><span>'+esc(labels[v])+'</span><button type="button" data-i="'+i+'" data-d="-1" '+(i===0?"disabled":"")+'>↑</button><button type="button" data-i="'+i+'" data-d="1" '+(i===a.length-1?"disabled":"")+'>↓</button></div>').join("");
    const groups=[];
    groups.push('<section class="editor-group"><div class="group-title">Card</div><ha-form data-form="card"></ha-form></section>');
    if(enabled.roster)groups.push('<section class="editor-group"><div class="group-title">Roster</div><ha-form data-form="roster"></ha-form></section>');
    if(enabled.standings)groups.push('<section class="editor-group"><div class="group-title">Standings</div><ha-form data-form="standings"></ha-form></section>');
    if(enabled.scoreboard)groups.push('<section class="editor-group"><div class="group-title">Scoreboard</div><ha-form data-form="scoreboard"></ha-form></section>');
    if(enabled.matchup)groups.push('<section class="editor-group"><div class="group-title">Matchup</div><ha-form data-form="matchup"></ha-form></section>');
    if(enabled.roster||enabled.matchup)groups.push('<section class="editor-group"><div class="group-title">Roster & Matchup</div><ha-form data-form="lineup"></ha-form></section>');
    if(enabled.news)groups.push('<section class="editor-group"><div class="group-title">News</div><ha-form data-form="news"></ha-form></section>');
    if(enabled.activity)groups.push('<section class="editor-group"><div class="group-title">Activity</div><ha-form data-form="activity"></ha-form></section>');
    if(enabled.waivers)groups.push('<section class="editor-group"><div class="group-title">Waivers</div><ha-form data-form="waivers"></ha-form></section>');
    if(enabled.news||enabled.activity)groups.push('<section class="editor-group"><div class="group-title">News & Activity feed</div><div class="hint">These controls are shared by the enabled feed sections.</div><ha-form data-form="feeds"></ha-form></section>');
    if(enabled.schedule)groups.push('<section class="editor-group"><div class="group-title">Schedule</div><ha-form data-form="schedule"></ha-form></section>');
    if(enabled.bracket)groups.push('<section class="editor-group"><div class="group-title">Playoff Bracket</div><ha-form data-form="bracket"></ha-form></section>');
    groups.push('<section class="editor-group"><div class="group-title">Appearance</div><ha-form data-form="appearance"></ha-form></section>');
    this.shadowRoot.innerHTML='<style>:host{display:block}.section-box{margin-bottom:18px}.group-title,.order-title{font-weight:700;margin:18px 0 7px}.group-title{font-size:14px}.hint{font-size:12px;color:var(--secondary-text-color);margin-bottom:8px}.checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:10px}.section-check{display:flex;align-items:center;gap:8px;min-height:38px;padding:0 9px;border:1px solid var(--divider-color);border-radius:10px}.section-check input{width:18px;height:18px}.order-row{display:grid;grid-template-columns:minmax(0,1fr) 40px 40px;gap:6px;align-items:center;min-height:40px;border-bottom:1px solid var(--divider-color)}button{border:0;background:var(--secondary-background-color);color:var(--primary-text-color);border-radius:8px;min-height:32px;cursor:pointer}button:disabled{opacity:.35}.editor-group{margin-top:8px;padding-top:2px;border-top:1px solid var(--divider-color)}@media(max-width:430px){.checks{grid-template-columns:1fr}}</style><div class="section-box"><div class="order-title">Sections & Order</div><div class="hint">Choose the sections to include. Only enabled sections appear in the order list.</div><div class="checks">'+checkboxRows+'</div>'+orderRows+'</div>'+groups.join("");
    this.shadowRoot.querySelectorAll("input[data-section]").forEach(x=>x.addEventListener("change",()=>this.toggle(x.dataset.section,x.checked)));
    this.shadowRoot.querySelectorAll("button[data-i]").forEach(x=>x.addEventListener("click",()=>this.move(Number(x.dataset.i),Number(x.dataset.d))));
    this.bindForm("card",[
      {name:"entity",selector:{entity:{domain:"sensor"}}},{name:"title",selector:{text:{}}},{name:"hide_title",selector:{boolean:{}}},{name:"show_header_logo",selector:{boolean:{}}},{name:"show_team_logo_background",selector:{boolean:{}}}
    ],{entity:"Entity",title:"Title",hide_title:"Hide title",show_header_logo:"Show ESPN Fantasy logo",show_team_logo_background:"Show team logo background"},{show_header_logo:true,show_team_logo_background:true});
    if(enabled.roster)this.bindForm("roster",[
      {name:"label_roster",selector:{text:{}}},{name:"roster_lineup_advice",selector:{boolean:{}}},{name:"lineup_alert_threshold",selector:{number:{min:0,max:50,step:0.5,mode:"box",unit_of_measurement:"pts"}}}
    ],{label_roster:"Shortcut title",roster_lineup_advice:"Show lineup advice badges",lineup_alert_threshold:"Lineup alert threshold"},{roster_lineup_advice:true,lineup_alert_threshold:0});
    if(enabled.standings)this.bindForm("standings",[{name:"label_standings",selector:{text:{}}},{name:"standings_roster_popups",selector:{boolean:{}}}],{label_standings:"Shortcut title",standings_roster_popups:"Enable roster popups"},{standings_roster_popups:true});
    if(enabled.scoreboard)this.bindForm("scoreboard",[{name:"label_scoreboard",selector:{text:{}}},{name:"scoreboard_matchup_popups",selector:{boolean:{}}}],{label_scoreboard:"Shortcut title",scoreboard_matchup_popups:"Enable matchup popups"},{scoreboard_matchup_popups:true});
    if(enabled.matchup)this.bindForm("matchup",[{name:"label_matchup",selector:{text:{}}},{name:"matchup_lineup_advice",selector:{boolean:{}}}],{label_matchup:"Shortcut title",matchup_lineup_advice:"Show lineup advice badges"},{matchup_lineup_advice:true});
    if(enabled.roster||enabled.matchup)this.bindForm("lineup",[{name:"label_starters",selector:{text:{}}},{name:"label_bench_ir",selector:{text:{}}}],{label_starters:"Starters title",label_bench_ir:"Bench / IR title"});
    if(enabled.news)this.bindForm("news",[{name:"label_news",selector:{text:{}}}],{label_news:"Shortcut title"});
    if(enabled.activity)this.bindForm("activity",[{name:"label_activity",selector:{text:{}}}],{label_activity:"Shortcut title"});
    if(enabled.waivers)this.bindForm("waivers",[{name:"label_waivers",selector:{text:{}}}],{label_waivers:"Shortcut title"});
    if(enabled.news||enabled.activity)this.bindForm("feeds",[
      {name:"story_count",selector:{number:{min:1,max:20,mode:"box"}}},{name:"news_height",selector:{number:{min:200,max:1200,step:25,mode:"box",unit_of_measurement:"px"}}}
    ],{story_count:"Items to show",news_height:"Feed height"},{story_count:5,news_height:500});
    if(enabled.schedule)this.bindForm("schedule",[{name:"label_schedule",selector:{text:{}}}],{label_schedule:"Shortcut title"});
    if(enabled.bracket)this.bindForm("bracket",[{name:"label_bracket",selector:{text:{}}}],{label_bracket:"Shortcut title"});
    this.bindForm("appearance",[
      {name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},
      {name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},
      {name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}
    ],{appearance:"Appearance",accent_color:"Accent color",glass_strength:"Glass strength",border_style:"Border"});
  }
}
if(!customElements.get("espn-fantasy-league-editor"))customElements.define("espn-fantasy-league-editor",ESPNFantasyLeagueEditor);

class ESPNFantasyLeagueCard extends ESPNBaseCard {
  constructor(){super();this._leagueView=null;this._matchupView=null;this._rosterView=null;this._schedulePeriod=null;this._newsScrollTop=0;this._activityScrollTop=0;this._bracketScrollLeft={};}
  set hass(v){const old=this._hass;this._hass=v;if(!old||!this.shadowRoot.hasChildNodes()){this.renderStable();return;}const ids=[findRoster(v,this._config.entity)?.entity_id,findLeague(v,this._config.entity)?.entity_id,findMatchup(v,this._config.entity)?.entity_id].filter(Boolean);if(!ids.length||ids.some(id=>old.states?.[id]!==v.states?.[id]))this.renderStable();}
  get hass(){return this._hass;}
  static getStubConfig(){return {type:"custom:espn-fantasy-league-card",section_roster:true,section_standings:true,section_scoreboard:true,section_matchup:true,section_news:true,section_activity:true,section_waivers:true,section_schedule:true,section_bracket:true,story_count:5,news_height:500,lineup_alert_threshold:0,roster_lineup_advice:true,matchup_lineup_advice:true,standings_roster_popups:true,scoreboard_matchup_popups:true,show_header_logo:true};}
  static async getConfigElement(){return document.createElement("espn-fantasy-league-editor");}
  getGridOptions(){return {rows:"auto",columns:12,min_rows:4,min_columns:4};}
  defaults(){return ["roster","standings","scoreboard","matchup","news","activity","waivers","schedule","bracket"];}
  enabledSections(){
    const d=this.defaults(),hasNew=d.some(v=>Object.prototype.hasOwnProperty.call(this._config,"section_"+v));
    if(hasNew)return Object.fromEntries(d.map(v=>[v,this._config["section_"+v]!==false]));
    const mode=this._config.display_mode||"all";
    if(mode!=="all")return Object.fromEntries(d.map(v=>[v,v===mode]));
    return {roster:true,standings:true,scoreboard:true,matchup:true,news:this._config.include_news!==false,activity:this._config.include_activity===true,schedule:false,bracket:false};
  }
  labels(){return {roster:this._config.label_roster||"Roster",standings:this._config.label_standings||"Standings",scoreboard:this._config.label_scoreboard||"Scoreboard",matchup:this._config.label_matchup||"My Matchup",news:this._config.label_news||"News",activity:this._config.label_activity||"Activity",waivers:this._config.label_waivers||"Waivers",schedule:this._config.label_schedule||"Schedule",bracket:this._config.label_bracket||"Playoff Bracket",starters:this._config.label_starters||"Starters",bench:this._config.label_bench_ir||"Bench / IR"};}
  key(part){return "espn-fantasy-main:"+(this._config.entity||"auto")+":"+part;}
  remembered(part,fallback){try{return localStorage.getItem(this.key(part))||fallback}catch(_){return fallback}}
  remember(part,value){try{localStorage.setItem(this.key(part),value)}catch(_){}}
  rosterState(){return findRoster(this.hass,this._config.entity)||findRoster(this.hass);}
  leagueState(){return findLeague(this.hass,this._config.entity)||findLeague(this.hass);}
  matchupState(){return findMatchup(this.hass,this._config.entity)||findMatchup(this.hass);}
  orderedViews(){
    const defaults=this.defaults(),configured=defaults.map((_,i)=>this._config["section_"+(i+1)]).filter(v=>defaults.includes(v)),order=[...new Set([...configured,...defaults])],enabled=this.enabledSections();
    return order.filter(v=>enabled[v]);
  }
  rosterBody(){
    const s=this.rosterState(),a=s?.attributes||{},labels=this.labels(),view=this._rosterView||this.remembered("roster","starters");
    if(!s)return '<div class="empty">No roster data yet.</div>';
    const starters=a.starters||[],starterIds=new Set(starters.map(p=>String(p.id))),all=a.players||starters,players=rosterOrder(view==="bench"?all.filter(p=>!starterIds.has(String(p.id))):starters);this._players=players;
    return '<div class="team-head single"><div class="team-side">'+teamLogo(a.team_logo,a.team_name)+'<div class="team-name">'+esc(a.team_name)+'</div><div class="big-score">'+num(a.score,2)+'</div><div class="projection">Proj '+num(a.live_projected_score??a.projected_score)+'</div></div></div><div class="sub-switch"><button data-roster="starters" class="'+(view==="starters"?"active":"")+'">'+esc(labels.starters)+'</button><button data-roster="bench" class="'+(view==="bench"?"active":"")+'">'+esc(labels.bench)+'</button></div><div class="player-list">'+players.map(p=>playerTile(p,{showSlot:true,showLineupAdvice:this._config.roster_lineup_advice!==false,lineupAdviceThreshold:this._config.lineup_alert_threshold||0,showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color})).join("")+'</div>';
  }
  matchupBody(){
    const s=this.matchupState(),a=s?.attributes||{},labels=this.labels(),view=this._matchupView||this.remembered("matchup","starters");
    if(!s)return '<div class="empty">No matchup data yet.</div>';
    const startersMine=a.my_roster||[],startersOpp=a.opponent_roster||[],starterIds=new Set(startersMine.map(p=>String(p.id))),oppStarterIds=new Set(startersOpp.map(p=>String(p.id)));
    const mine=rosterOrder(view==="bench"?(a.my_players||[]).filter(p=>!starterIds.has(String(p.id))):startersMine);
    const opp=rosterOrder(view==="bench"?(a.opponent_players||[]).filter(p=>!oppStarterIds.has(String(p.id))):startersOpp);this._players=[...mine,...opp];
    let rows="";for(let i=0;i<Math.max(mine.length,opp.length);i++)rows+='<div class="match-row">'+(mine[i]?playerTile(mine[i],{showSlot:true,showLineupAdvice:this._config.matchup_lineup_advice!==false,lineupAdviceThreshold:this._config.lineup_alert_threshold||0}):"<div></div>")+(opp[i]?playerTile(opp[i],{showSlot:true,showLineupAdvice:this._config.matchup_lineup_advice!==false,lineupAdviceThreshold:this._config.lineup_alert_threshold||0}):"<div></div>")+"</div>";
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
  waiversBody(){
    const waivers=this.leagueState()?.attributes?.waivers||{},order=waivers.order||[];
    if(!waivers.available||!order.length)return '<div class="empty">Waiver order is not available for this league.</div>';
    const myId=String(this.matchupState()?.attributes?.team_id??this.rosterState()?.attributes?.team_id??"");
    return '<div class="waiver-heading"><strong>'+esc(waivers.label||"Waiver Order")+'</strong>'+(waivers.acquisition_budget!=null?'<span>Budget '+num(waivers.acquisition_budget,0)+'</span>':'')+'</div><div class="waiver-list">'+order.map(item=>'<div class="waiver-row '+(myId&&String(item.team_id)===myId?"mine":"")+'"><strong>'+esc(item.rank)+'</strong>'+teamLogo(item.team_logo,item.team_name)+'<span>'+esc(item.team_name||"Team")+'</span>'+(item.budget_remaining!=null?'<em>'+num(item.budget_remaining,0)+' left</em>':'')+'</div>').join("")+'</div>';
  }
  scheduleBody(){
    const a=this.leagueState()?.attributes||{},schedule=a.schedule||[],periods=(a.schedule_periods||[]).filter(x=>Number.isFinite(Number(x))).map(Number);
    if(!schedule.length||!periods.length)return '<div class="empty">No league schedule available yet.</div>';
    const current=Number(a.matchup_period||a.current_week),selected=Number(this._schedulePeriod||(periods.includes(current)?current:periods[0]));
    this._schedulePeriod=selected;
    const myId=String(this.matchupState()?.attributes?.team_id??this.rosterState()?.attributes?.team_id??"");
    const mode=this._scheduleView||this.remembered("schedule-view","league");
    this._scheduleView=mode;
    const switcher='<div class="sub-switch schedule-switch"><button data-schedule-view="league" class="'+(mode==="league"?"active":"")+'">League</button><button data-schedule-view="team" class="'+(mode==="team"?"active":"")+'">My Team</button></div>';
    const gameRow=(g,showWeek=false)=>{const mine=myId&&(String(g.home_team_id)===myId||String(g.away_team_id)===myId),isCurrent=Number(g.matchup_period)===current;const status=g.status==="final"?"Final":g.status==="current"?"Current":"Scheduled";return '<div class="schedule-game '+(!showWeek&&mine?"mine ":"")+(showWeek&&isCurrent?"current-week":"")+'">'+(showWeek?'<div class="schedule-week-label">Week '+esc(g.matchup_period)+(isCurrent?" · Current":"")+'</div>':'')+'<div class="schedule-status">'+esc(status)+'</div>'+leagueGame(g)+'</div>';};
    if(mode==="team"){
      const games=schedule.filter(g=>myId&&(String(g.home_team_id)===myId||String(g.away_team_id)===myId)).sort((x,y)=>Number(x.matchup_period)-Number(y.matchup_period));
      return switcher+(games.length?'<div class="schedule-list team-schedule">'+games.map(g=>gameRow(g,true)).join("")+'</div>':'<div class="empty">No team schedule available yet.</div>');
    }
    const index=Math.max(0,periods.indexOf(selected)),prev=periods[index-1],next=periods[index+1];
    const nav='<div class="schedule-week-nav"><button data-schedule-period="'+(prev??"")+'" aria-label="Previous week" '+(prev==null?"disabled":"")+'>‹</button><strong>Week '+esc(selected)+'</strong><button data-schedule-period="'+(next??"")+'" aria-label="Next week" '+(next==null?"disabled":"")+'>›</button></div>';
    const games=schedule.filter(g=>Number(g.matchup_period)===selected);
    return switcher+nav+(games.length?'<div class="schedule-list">'+games.map(g=>gameRow(g)).join("")+'</div>':'<div class="empty">No matchups for this week.</div>');
  }

  bracketTeam(game,side){
    const name=game[side+"_team_name"]||"TBD",logo=game[side+"_logo"],seed=game[side+"_seed"],score=game[side+"_score"],proj=game[side+"_projected_score"],winner=String(game.winner||"").toUpperCase()===side.toUpperCase(),projected=game.status==="projected";
    const value=score!=null&&!projected?num(score,2):(proj!=null?"Proj "+num(proj):"");
    return '<div class="bracket-team '+(winner?"winner":"")+'">'+(seed!=null?'<span class="bracket-seed">'+esc(seed)+'</span>':'<span class="bracket-seed">—</span>')+teamLogo(logo,name)+'<span class="bracket-name">'+esc(name)+'</span><strong>'+esc(value)+'</strong></div>';
  }
  bracketMarkup(expanded=false){
    const bracket=this.leagueState()?.attributes?.playoff_bracket||{},fallback=bracket.rounds?.length?[{tier:"WINNERS_BRACKET",label:"Championship Bracket",rounds:bracket.rounds}]:[],sections=bracket.sections?.length?bracket.sections:fallback;
    if(!bracket.available||!sections.length)return '<div class="empty">Playoff bracket data is not available yet.</div>';
    const source=bracket.source==="standings_projection"?"Projected from current standings":(bracket.projected?"Projected by ESPN schedule":"Playoff bracket");
    const toolbar='<div class="bracket-toolbar"><div><strong>'+esc(source)+'</strong><div class="subtle">'+(bracket.projected?"Projected · updates with league data":"Actual playoff results")+'</div></div>'+(expanded?"":'<button class="expand-bracket" data-expand-bracket aria-label="Expand playoff bracket" title="Expand playoff bracket"><ha-icon icon="mdi:arrow-expand-all"></ha-icon></button>')+'</div>';
    const groups=sections.map((section,sectionIndex)=>{const rounds=section.rounds||[];const columns=rounds.map((round,i)=>'<section class="bracket-round" data-round-index="'+i+'"><div class="bracket-round-title">'+esc(round.label||("Round "+(i+1)))+(round.matchup_period?'<span>Week '+esc(round.matchup_period)+'</span>':"")+'</div><div class="bracket-matches">'+(round.matches||[]).map(game=>'<div class="bracket-match">'+this.bracketTeam(game,"home")+this.bracketTeam(game,"away")+'</div>').join("")+'</div></section>').join("");return '<section class="bracket-section"><div class="bracket-section-title">'+esc(section.label||String(section.tier||"Playoff").replaceAll("_"," "))+'</div><div class="playoff-bracket-scroll '+(expanded?"expanded":"")+'" data-bracket-section="'+sectionIndex+'"><div class="playoff-bracket">'+columns+'</div></div></section>';}).join("");
    return toolbar+groups;
  }

  bracketBody(){return this.bracketMarkup(false);}
  bodyFor(view){
    const la=this.leagueState()?.attributes||{},standings=la.standings||[],games=la.scoreboard||[];
    if(view==="roster")return this.rosterBody();
    if(view==="standings")return standings.length?leagueStandings(standings,undefined,this._config.standings_roster_popups!==false):'<div class="empty">No standings data yet.</div>';
    if(view==="scoreboard")return games.length?leagueScoreboard(games,this._config.scoreboard_matchup_popups!==false):'<div class="empty">No scoreboard data yet.</div>';
    if(view==="matchup")return this.matchupBody();
    if(view==="activity")return this.activityBody();
    if(view==="waivers")return this.waiversBody();
    if(view==="schedule")return this.scheduleBody();
    if(view==="bracket")return this.bracketBody();
    return this.newsBody();
  }
  bindBracket(root=this.shadowRoot){
    this._bracketScrollLeft??={};
    root.querySelectorAll(".playoff-bracket-scroll").forEach(scroll=>{const key=scroll.dataset.bracketSection||"0";if(root===this.shadowRoot)scroll.scrollLeft=this._bracketScrollLeft[key]||0;scroll.addEventListener("scroll",()=>{if(root===this.shadowRoot)this._bracketScrollLeft[key]=scroll.scrollLeft;},{passive:true});});
    root.querySelector("[data-expand-bracket]")?.addEventListener("click",()=>this.openBracket());
  }
  openBracket(){
    const dialog=this.shadowRoot.querySelector("dialog.bracket-dialog");if(!dialog)return;
    dialog.querySelector(".bracket-dialog-content").innerHTML=this.bracketMarkup(true);
    this.bindBracket(dialog);
    if(!dialog.open)dialog.showModal();
  }
  teamDetail(teamId){
    return (this.leagueState()?.attributes?.team_rosters||[]).find(team=>String(team.team_id)===String(teamId));
  }
  leagueDialogMarkup(view){
    if(view.type==="player")return playerDetails(view.player,this._config.stats,{showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color,teamWatermark:this._config.show_team_logo_background!==false,sectionState:{}});
    if(view.type==="roster"){
      const team=view.team,players=rosterOrder(team?.roster||[]),starters=players.filter(p=>p.starter),bench=players.filter(p=>!p.starter);
      return '<div class="popup-view-title">'+teamLogo(team?.team_logo,team?.team_name)+'<div><strong>'+esc(team?.team_name||"Team")+'</strong><span>Roster</span></div></div>'+(starters.length?'<div class="popup-roster-label">Starters</div><div class="player-list">'+starters.map(p=>playerTile(p,{showSlot:true})).join("")+'</div>':"")+(bench.length?'<div class="popup-roster-label">Bench / IR</div><div class="player-list">'+bench.map(p=>playerTile(p,{showSlot:true})).join("")+'</div>':"");
    }
    const game=view.game||{},home=game.home_team||this.teamDetail(game.home_team_id),away=game.away_team||this.teamDetail(game.away_team_id),mode=view.mode||"starters";
    const homePlayers=rosterOrder(mode==="bench"?(home?.roster||[]).filter(p=>!p.starter):(home?.starters||[]));
    const awayPlayers=rosterOrder(mode==="bench"?(away?.roster||[]).filter(p=>!p.starter):(away?.starters||[]));
    const header='<div class="popup-matchup-head"><button type="button" data-dialog-team-id="'+esc(away?.team_id||game.away_team_id)+'">'+teamLogo(away?.team_logo||game.away_logo,away?.team_name||game.away_team_name)+'<span>'+esc(away?.team_name||game.away_team_name||"Away")+'</span><strong>'+num(game.away_score,2)+'</strong></button><div class="vs">VS</div><button type="button" data-dialog-team-id="'+esc(home?.team_id||game.home_team_id)+'">'+teamLogo(home?.team_logo||game.home_logo,home?.team_name||game.home_team_name)+'<span>'+esc(home?.team_name||game.home_team_name||"Home")+'</span><strong>'+num(game.home_score,2)+'</strong></button></div>';
    let rows="";for(let i=0;i<Math.max(awayPlayers.length,homePlayers.length);i++)rows+='<div class="match-row">'+(awayPlayers[i]?playerTile(awayPlayers[i],{showSlot:true}):"<div></div>")+(homePlayers[i]?playerTile(homePlayers[i],{showSlot:true}):"<div></div>")+"</div>";
    return header+'<div class="sub-switch"><button type="button" data-popup-matchup-view="starters" class="'+(mode==="starters"?"active":"")+'">Starters</button><button type="button" data-popup-matchup-view="bench" class="'+(mode==="bench"?"active":"")+'">Bench / IR</button></div>'+rows;
  }
  openLeagueDialog(view,push=true){
    const dialog=this.shadowRoot.querySelector("dialog.player-dialog");if(!dialog||!view)return;
    this._leagueDialogStack??=[];if(push)this._leagueDialogStack.push(view);else if(this._leagueDialogStack.length)this._leagueDialogStack[this._leagueDialogStack.length-1]=view;else this._leagueDialogStack=[view];
    const current=this._leagueDialogStack[this._leagueDialogStack.length-1];dialog.classList.remove("transaction-dialog");dialog.querySelector(".dialog-content").innerHTML=this.leagueDialogMarkup(current);dialog.querySelector(".dialog-back")?.classList.toggle("visible",this._leagueDialogStack.length>1);
    dialog.querySelectorAll(".player-tile[data-player-id]").forEach(node=>node.addEventListener("click",()=>{const pools=current.type==="roster"?(current.team?.roster||[]):current.type==="matchup"?[...(current.game?.away_team?.roster||this.teamDetail(current.game?.away_team_id)?.roster||[]),...(current.game?.home_team?.roster||this.teamDetail(current.game?.home_team_id)?.roster||[])]:[];const player=pools.find(p=>String(p.id)===String(node.dataset.playerId));if(player)this.openLeagueDialog({type:"player",player},true);}));
    dialog.querySelectorAll("[data-dialog-team-id]").forEach(node=>node.addEventListener("click",()=>{const team=this.teamDetail(node.dataset.dialogTeamId);if(team)this.openLeagueDialog({type:"roster",team},true);}));
    dialog.querySelectorAll("[data-popup-matchup-view]").forEach(node=>node.addEventListener("click",()=>this.openLeagueDialog({...current,mode:node.dataset.popupMatchupView},false)));
    if(!dialog.open)dialog.showModal();
  }
  bindLeagueContent(){
    this.bindPlayers(id=>{const pools=[...(this.rosterState()?.attributes?.players||[]),...(this.matchupState()?.attributes?.my_players||[]),...(this.matchupState()?.attributes?.opponent_players||[])];this.openPlayer(pools.find(p=>String(p.id)===String(id)),this._config.stats);});
    this.shadowRoot.querySelectorAll("[data-news-player]").forEach(x=>x.addEventListener("click",e=>{if(e.target.closest("a"))return;const p=(this.rosterState()?.attributes?.players||[]).find(p=>String(p.id)===String(x.dataset.newsPlayer));this.openPlayer(p,this._config.stats);}));
    this.bindActivities(this.leagueState()?.attributes?.activity||[]);
    this.shadowRoot.querySelectorAll("[data-team-id]").forEach(node=>{const open=()=>{if(this._config.standings_roster_popups===false)return;const team=this.teamDetail(node.dataset.teamId);if(team){this._leagueDialogStack=[];this.openLeagueDialog({type:"roster",team},true);}};node.addEventListener("click",open);node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});});
    this.shadowRoot.querySelectorAll("[data-scoreboard-index]").forEach(node=>{const open=()=>{if(this._config.scoreboard_matchup_popups===false)return;const game=(this.leagueState()?.attributes?.scoreboard||[])[Number(node.dataset.scoreboardIndex)];if(game){this._leagueDialogStack=[];this.openLeagueDialog({type:"matchup",game,mode:"starters"},true);}};node.addEventListener("click",open);node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});});
    this.shadowRoot.querySelectorAll("button[data-matchup]").forEach(x=>x.addEventListener("click",()=>this.setMatchupView(x.dataset.matchup)));
    this.shadowRoot.querySelectorAll("button[data-roster]").forEach(x=>x.addEventListener("click",()=>this.setRosterView(x.dataset.roster)));
    this.shadowRoot.querySelectorAll("button[data-schedule-period]:not([disabled])").forEach(x=>x.addEventListener("click",()=>{const period=Number(x.dataset.schedulePeriod);if(Number.isFinite(period)&&period>0){this._schedulePeriod=period;this.replaceBody("schedule");}}));
    this.shadowRoot.querySelectorAll("button[data-schedule-view]").forEach(x=>x.addEventListener("click",()=>{this._scheduleView=x.dataset.scheduleView;this.remember("schedule-view",this._scheduleView);this.replaceBody("schedule");}));
    const feed=this.shadowRoot.querySelector(".news-feed");if(feed){feed.scrollTop=this._newsScrollTop;feed.addEventListener("scroll",()=>{this._newsScrollTop=feed.scrollTop;},{passive:true});}
    const activity=this.shadowRoot.querySelector(".activity-feed");if(activity){activity.scrollTop=this._activityScrollTop;activity.addEventListener("scroll",()=>{this._activityScrollTop=activity.scrollTop;},{passive:true});}
    this.bindBracket(this.shadowRoot);
  }
  replaceBody(view){const content=this.shadowRoot.querySelector(".main-content");if(!content){this.renderStable();return;}const feed=this.shadowRoot.querySelector(".news-feed");if(feed)this._newsScrollTop=feed.scrollTop;const activity=this.shadowRoot.querySelector(".activity-feed");if(activity)this._activityScrollTop=activity.scrollTop;this.shadowRoot.querySelectorAll(".playoff-bracket-scroll").forEach(scroll=>{this._bracketScrollLeft??={};this._bracketScrollLeft[scroll.dataset.bracketSection||"0"]=scroll.scrollLeft;});content.innerHTML=this.bodyFor(view);this.shadowRoot.querySelectorAll(".main-switch button").forEach(x=>x.classList.toggle("active",x.dataset.view===view));this.bindLeagueContent();}
  setView(v){this._leagueView=v;this.remember("view",v);this.replaceBody(v);}
  setMatchupView(v){this._matchupView=v;this.remember("matchup",v);this.replaceBody("matchup");}
  setRosterView(v){this._rosterView=v;this.remember("roster",v);this.replaceBody("roster");}
  render(){
    if(!this.hass)return;const labels=this.labels(),league=this.leagueState(),la=league?.attributes||{};
    const views=this.orderedViews();if(!views.length)return;
    const remembered=this._leagueView||this.remembered("view",views[0]),view=views.includes(remembered)?remembered:views[0],body=this.bodyFor(view);
    const nav=views.length>1?'<div class="main-switch">'+views.map(v=>'<button data-view="'+v+'" class="'+(view===v?"active":"")+'">'+esc(labels[v])+"</button>").join("")+"</div>":"";
    const title=this._config.title??league?.state??this.rosterState()?.attributes?.team_name??"ESPN Fantasy",logo=this._config.show_header_logo===false?"":'<img class="header-brand" src="'+ESPN_FANTASY_ICON+'" alt="ESPN Fantasy">',header=this._config.hide_title?"":'<div class="header"><div class="title-group">'+logo+'<div class="title">'+esc(title)+'</div></div><div class="subtle">Week '+esc(la.current_week??la.matchup_period??"—")+'</div></div>';
    this.shadowRoot.innerHTML='<style>'+this.styles()+'.league-row.interactive,.league-game.interactive{cursor:pointer}.popup-view-title{display:flex;align-items:center;gap:10px;margin:8px 0 16px}.popup-view-title .team-logo-wrap,.popup-view-title .team-logo,.popup-view-title .team-logo-fallback{width:48px;height:48px;margin:0}.popup-view-title>div:last-child{display:flex;flex-direction:column}.popup-view-title span,.popup-roster-label{font-size:11px;color:var(--secondary-text-color);text-transform:uppercase}.popup-roster-label{font-weight:800;margin:14px 0 6px}.popup-matchup-head{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin:8px 0 14px}.popup-matchup-head button{border:0;background:transparent;color:var(--primary-text-color);display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;min-width:0}.popup-matchup-head .team-logo-wrap,.popup-matchup-head .team-logo,.popup-matchup-head .team-logo-fallback{width:52px;height:52px;margin:0}.popup-matchup-head span{font-weight:700;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.popup-matchup-head strong{font-size:22px}.title-group{display:flex;align-items:center;gap:10px;min-width:0}.header-brand{width:34px;height:34px;object-fit:contain;flex:0 0 34px}.main-switch,.sub-switch{display:flex;gap:5px;overflow-x:auto;margin:0 0 12px;scrollbar-width:none}.main-switch button,.sub-switch button{white-space:nowrap;border:1px solid var(--divider-color);border-radius:999px;padding:6px 11px;background:var(--secondary-background-color);color:var(--secondary-text-color);cursor:pointer}.main-switch button.active,.sub-switch button.active{background:color-mix(in srgb,var(--espn-accent,var(--primary-color)) 20%,var(--ha-card-background,var(--card-background-color)));color:var(--primary-text-color);border-color:var(--espn-accent,var(--primary-color))}.team-head.single{grid-template-columns:1fr}.match-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}.news-feed,.activity-feed{display:grid;gap:10px;max-height:var(--news-height,500px);overflow-y:auto;overscroll-behavior:contain;padding-right:4px}.feed-story{padding:12px;cursor:pointer;border-radius:var(--ha-card-border-radius,12px);background:var(--secondary-background-color)}.feed-player{display:flex;align-items:center;gap:10px;margin-bottom:8px}.feed-player .portrait{width:48px;height:48px;flex:0 0 48px}.activity-item{display:flex;align-items:center;gap:10px;padding:11px;border-radius:var(--ha-card-border-radius,12px);background:var(--secondary-background-color)}.schedule-week-nav{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:8px;margin:0 0 12px}.schedule-week-nav strong{text-align:center}.schedule-week-nav button{min-width:44px;min-height:36px;border:1px solid var(--divider-color);border-radius:999px;background:var(--secondary-background-color);color:var(--primary-text-color);font-size:24px;line-height:1;cursor:pointer}.schedule-week-nav button:disabled{opacity:.3;cursor:default}.schedule-list{display:grid;gap:8px}.schedule-week-label{font-size:12px;font-weight:900;margin:0 0 3px 6px}.team-schedule .schedule-game{scroll-margin-top:8px}.schedule-game{position:relative;border-radius:12px}.schedule-game.mine,.schedule-game.current-week{outline:1px solid var(--espn-accent,var(--primary-color));outline-offset:1px}.schedule-status{font-size:9px;font-weight:800;text-transform:uppercase;color:var(--secondary-text-color);margin:0 0 3px 6px}.bracket-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.expand-bracket{display:grid;place-items:center;width:40px;height:40px;padding:0;border:1px solid var(--espn-accent,var(--primary-color));border-radius:10px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer;flex:0 0 auto}.expand-bracket ha-icon{--mdc-icon-size:20px}.bracket-section+.bracket-section{margin-top:18px}.bracket-section-title{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px}.playoff-bracket-scroll{overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;padding:4px 2px 10px}.playoff-bracket{display:flex;align-items:stretch;gap:36px;width:max-content;min-width:100%}.bracket-round{position:relative;flex:0 0 min(280px,78vw);scroll-snap-align:start;display:flex;flex-direction:column}.bracket-round-title{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;margin-bottom:9px}.bracket-round-title span{display:block;font-size:9px;font-weight:500;color:var(--secondary-text-color);margin-top:2px}.bracket-matches{display:flex;flex:1;flex-direction:column;justify-content:space-around;gap:14px}.bracket-match{position:relative;border:1px solid var(--divider-color);border-radius:12px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent);padding:5px}.bracket-round:not(:last-child) .bracket-match:after{content:"";position:absolute;right:-37px;top:50%;width:36px;border-top:1px solid var(--divider-color)}.bracket-team{display:grid;grid-template-columns:20px 28px minmax(0,1fr) auto;gap:6px;align-items:center;min-height:38px;padding:3px 4px;border-radius:8px}.bracket-team+.bracket-team{border-top:1px solid var(--divider-color);border-radius:0}.bracket-team.winner{font-weight:800;background:color-mix(in srgb,var(--espn-accent,var(--primary-color)) 12%,transparent)}.bracket-team .team-logo-wrap,.bracket-team .team-logo,.bracket-team .team-logo-fallback{width:26px;height:26px;margin:0}.bracket-team .team-logo-fallback{font-size:8px}.bracket-seed{font-size:10px;color:var(--secondary-text-color);text-align:center}.bracket-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.bracket-team strong{font-size:11px}.bracket-dialog{width:min(1200px,calc(100% - 24px));max-width:1200px;max-height:calc(100vh - 30px);overflow:auto;border:var(--ha-card-border-width,0) solid var(--ha-card-border-color,var(--divider-color));border-radius:var(--ha-card-border-radius,16px);background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color);padding:16px}.bracket-dialog::backdrop{background:rgba(0,0,0,.62);backdrop-filter:blur(3px)}.bracket-dialog-close{float:right;border:0;background:transparent;color:var(--primary-text-color);font-size:28px;cursor:pointer}.bracket-dialog-content{clear:both}.bracket-dialog .bracket-round{flex-basis:280px}@media(max-width:600px){.match-row{gap:5px}.match-row .player-tile{grid-template-columns:36px minmax(0,1fr);padding:6px}.match-row .portrait{width:36px;height:36px}.match-row .player-score{grid-column:2;text-align:left}.bracket-toolbar{align-items:flex-start;flex-direction:column}}</style><ha-card><div class="wrap">'+header+nav+'<div class="main-content" style="--news-height:'+Math.min(1200,Math.max(200,Number(this._config.news_height)||500))+'px">'+body+'</div></div></ha-card>'+this.dialog()+'<dialog class="bracket-dialog"><button class="bracket-dialog-close" aria-label="Close">×</button><div class="bracket-dialog-content"></div></dialog>';
    this.shadowRoot.querySelectorAll(".main-switch button").forEach(x=>x.addEventListener("click",()=>this.setView(x.dataset.view)));
    this.bindLeagueContent();this.bindDialog();const leagueDialog=this.shadowRoot.querySelector("dialog.player-dialog");leagueDialog?.querySelector(".dialog-back")?.addEventListener("click",()=>{if((this._leagueDialogStack||[]).length>1){this._leagueDialogStack.pop();this.openLeagueDialog(this._leagueDialogStack[this._leagueDialogStack.length-1],false);}});leagueDialog?.addEventListener("close",()=>{this._leagueDialogStack=[];});this.restoreDialog(this.rosterState()?.attributes?.players||[],this._config.stats);
    const bracketDialog=this.shadowRoot.querySelector(".bracket-dialog");bracketDialog?.querySelector(".bracket-dialog-close")?.addEventListener("click",()=>bracketDialog.close());bracketDialog?.addEventListener("click",e=>{if(e.target===bracketDialog)bracketDialog.close();});
  }
}

class ESPNFantasyTickerEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:"open"});this._config={};}
  set hass(v){this._hass=v;this.shadowRoot.querySelectorAll("ha-form").forEach(form=>form.hass=v);if(!this.shadowRoot.hasChildNodes())this.render();} get hass(){return this._hass;}
  setConfig(v){this._config=v||{};this.render();}
  defaults(){return ["players","scoreboard","activity"];}
  enabled(){
    const hasNew=this.defaults().some(v=>Object.prototype.hasOwnProperty.call(this._config,"ticker_"+v));
    if(hasNew)return {players:this._config.ticker_players!==false,scoreboard:this._config.ticker_scoreboard!==false,activity:this._config.ticker_activity!==false};
    const fallback=this._config.type==="custom:espn-fantasy-league-ticker-card"?"scoreboard":"both",mode=this._config.content||fallback;
    return {players:mode!=="scoreboard",scoreboard:mode!=="players",activity:this._config.include_activity===true};
  }
  order(){
    const d=this.defaults(),configured=d.map((_,i)=>this._config["ticker_section_"+(i+1)]).filter(v=>d.includes(v));
    if(configured.length)return [...new Set([...configured,...d])];
    return this._config.section_order==="scoreboard_first"?["scoreboard","players","activity"]:d;
  }
  visibleOrder(){const e=this.enabled();return this.order().filter(v=>e[v]);}
  scrollPositions(){const positions=[],seen=new Set();let node=this;while(node){let parent=node.parentNode;if(!parent&&node.getRootNode)parent=node.getRootNode().host;node=parent;if(node instanceof Element&&node.scrollHeight>node.clientHeight+1&&!seen.has(node)){positions.push([node,node.scrollLeft,node.scrollTop]);seen.add(node);}}const doc=document.scrollingElement;if(doc&&!seen.has(doc))positions.push([doc,doc.scrollLeft,doc.scrollTop]);return positions;}
  fire(config){const positions=this.scrollPositions();this._config=config;this.dispatchEvent(new CustomEvent("config-changed",{detail:{config},bubbles:true,composed:true}));this.render();const restore=()=>positions.forEach(([el,left,top])=>{el.scrollLeft=left;el.scrollTop=top;});restore();requestAnimationFrame(()=>{restore();requestAnimationFrame(restore);});}
  toggle(section,checked){const e=this.enabled();e[section]=checked;if(!Object.values(e).some(Boolean))return;this.fire({...this._config,ticker_players:e.players,ticker_scoreboard:e.scoreboard,ticker_activity:e.activity});}
  move(i,direction){const visible=this.visibleOrder(),j=i+direction;if(j<0||j>=visible.length)return;[visible[i],visible[j]]=[visible[j],visible[i]];const e=this.enabled(),hidden=this.order().filter(v=>!e[v]),all=[...visible,...hidden],patch={};all.forEach((v,n)=>patch["ticker_section_"+(n+1)]=v);this.fire({...this._config,...patch});}
  bindForm(name,schema,labels,data={}){
    const form=this.shadowRoot.querySelector('ha-form[data-form="'+name+'"]');if(!form)return;form.hass=this.hass;form.data={...data,...this._config};form.schema=schema;form.computeLabel=x=>labels[x.name]||x.name;form.addEventListener("value-changed",e=>this.fire({...this._config,...e.detail.value}));
  }
  render(){
    if(!this.hass)return;const enabled=this.enabled(),visible=this.visibleOrder(),names={players:"Players",scoreboard:"Scoreboard",activity:"Activity"};
    const checks=this.defaults().map(v=>'<label class="section-check"><input type="checkbox" data-section="'+v+'" '+(enabled[v]?"checked":"")+'><span>'+names[v]+'</span></label>').join("");
    const order=visible.map((v,i,a)=>'<div class="order-row"><span>'+names[v]+'</span><button type="button" data-i="'+i+'" data-d="-1" '+(i===0?"disabled":"")+'>↑</button><button type="button" data-i="'+i+'" data-d="1" '+(i===a.length-1?"disabled":"")+'>↓</button></div>').join("");
    const groups=['<section class="editor-group"><div class="group-title">Sources</div><ha-form data-form="sources"></ha-form></section>'];
    if(enabled.players)groups.push('<section class="editor-group"><div class="group-title">Players</div><ha-form data-form="players"></ha-form></section>');
    if(enabled.scoreboard)groups.push('<section class="editor-group"><div class="group-title">Scoreboard</div><ha-form data-form="scoreboard"></ha-form></section>');
    if(enabled.activity)groups.push('<section class="editor-group"><div class="group-title">Activity</div><ha-form data-form="activity"></ha-form></section>');
    groups.push('<section class="editor-group"><div class="group-title">Ticker behavior</div><ha-form data-form="behavior"></ha-form></section><section class="editor-group"><div class="group-title">Appearance</div><ha-form data-form="appearance"></ha-form></section>');
    this.shadowRoot.innerHTML='<style>:host{display:block}.order-title,.group-title{font-weight:700;margin:18px 0 7px}.hint{font-size:12px;color:var(--secondary-text-color);margin-bottom:8px}.checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:10px}.section-check{display:flex;align-items:center;gap:8px;min-height:38px;padding:0 9px;border:1px solid var(--divider-color);border-radius:10px}.section-check input{width:18px;height:18px}.order-row{display:grid;grid-template-columns:minmax(0,1fr) 40px 40px;gap:6px;align-items:center;min-height:40px;border-bottom:1px solid var(--divider-color)}button{border:0;background:var(--secondary-background-color);color:var(--primary-text-color);border-radius:8px;min-height:32px;cursor:pointer}button:disabled{opacity:.35}.editor-group{margin-top:8px;padding-top:2px;border-top:1px solid var(--divider-color)}@media(max-width:430px){.checks{grid-template-columns:1fr}}</style><div class="order-title">Sections & Order</div><div class="hint">Choose the ticker sections to include. Only enabled sections appear below.</div><div class="checks">'+checks+'</div>'+order+groups.join("");
    this.shadowRoot.querySelectorAll("input[data-section]").forEach(x=>x.addEventListener("change",()=>this.toggle(x.dataset.section,x.checked)));
    this.shadowRoot.querySelectorAll("button[data-i]").forEach(x=>x.addEventListener("click",()=>this.move(Number(x.dataset.i),Number(x.dataset.d))));
    this.bindForm("sources",[{name:"roster_entity",selector:{entity:{domain:"sensor"}}},{name:"league_entity",selector:{entity:{domain:"sensor"}}}],{roster_entity:"Roster entity",league_entity:"League entity"});
    if(enabled.players)this.bindForm("players",[
      {name:"show_bench",selector:{boolean:{}}},{name:"show_live_halo",selector:{boolean:{}}},{name:"show_team_logo_background",selector:{boolean:{}}},{name:"live_halo_color",selector:{color_rgb:{}}},
      {name:"team_header",selector:{select:{options:[{value:"logo_name",label:"Logo + name"},{value:"logo",label:"Logo only"},{value:"name",label:"Name only"},{value:"hidden",label:"Hidden"}]}}},{name:"team_label",selector:{text:{}}}
    ],{show_bench:"Include bench / IR",show_live_halo:"Show live-player halo",show_team_logo_background:"Show team logo background",live_halo_color:"Live halo color",team_header:"Players header",team_label:"Players header title"});
    if(enabled.scoreboard)this.bindForm("scoreboard",[
      {name:"league_header",selector:{select:{options:[{value:"logo_name",label:"Logo + name"},{value:"logo",label:"Logo only"},{value:"name",label:"Name only"},{value:"hidden",label:"Hidden"}]}}},{name:"league_label",selector:{text:{}}}
    ],{league_header:"Scoreboard header",league_label:"Scoreboard header title"});
    if(enabled.activity)this.bindForm("activity",[
      {name:"story_count",selector:{number:{min:1,max:20,mode:"box"}}},{name:"activity_header",selector:{select:{options:[{value:"logo_name",label:"Logo + name"},{value:"logo",label:"Logo only"},{value:"name",label:"Name only"},{value:"hidden",label:"Hidden"}]}}},{name:"activity_label",selector:{text:{}}}
    ],{story_count:"Activity items",activity_header:"Activity header",activity_label:"Activity header title"},{story_count:5});
    this.bindForm("behavior",[
      {name:"scroll_style",selector:{select:{options:[{value:"step",label:"Step"},{value:"smooth",label:"Smooth / continuous"}]}}},{name:"auto_scroll",selector:{boolean:{}}},{name:"scroll_speed",selector:{select:{options:["slow","normal","fast"]}}},{name:"size",selector:{select:{options:[{value:"compact",label:"Compact"},{value:"standard",label:"Standard"},{value:"large",label:"Large"},{value:"xl",label:"XL / wall panel"}]}}},{name:"frame",selector:{boolean:{}}},{name:"header_background_color",selector:{color_rgb:{}}}
    ],{scroll_style:"Scroll style",auto_scroll:"Auto scroll",scroll_speed:"Scroll speed",size:"Size",frame:"Show frame",header_background_color:"Pinned header background"},{scroll_style:"step",auto_scroll:true,scroll_speed:"normal",size:"standard",frame:false});
    this.bindForm("appearance",[
      {name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},{name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},{name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}
    ],{appearance:"Appearance",accent_color:"Accent color",glass_strength:"Glass strength",border_style:"Border"});
  }
}
if(!customElements.get("espn-fantasy-ticker-editor"))customElements.define("espn-fantasy-ticker-editor",ESPNFantasyTickerEditor);

class ESPNFantasyLeagueTickerCard extends ESPNBaseCard {
  constructor(){super();this._timer=null;this._raf=null;this._index=0;this._lastFrame=0;}
  set hass(v){const old=this._hass;this._hass=v;if(!old||!this.shadowRoot.querySelector(".ticker-viewport"))this.render();else{const ids=[this.roster()?.entity_id,this.league()?.entity_id].filter(Boolean);if(!ids.length||ids.some(id=>old.states?.[id]!==v.states?.[id]))this.updateTicker();}}
  get hass(){return this._hass;}
  stopMotion(){if(this._timer){clearInterval(this._timer);this._timer=null;}if(this._raf){cancelAnimationFrame(this._raf);this._raf=null;}this._lastFrame=0;}
  setConfig(v){this.stopMotion();this._config=v||{};this.render();}
  static getStubConfig(){return {type:"custom:espn-fantasy-ticker-card",ticker_players:true,ticker_scoreboard:true,ticker_activity:true,ticker_section_1:"players",ticker_section_2:"scoreboard",ticker_section_3:"activity",story_count:5,scroll_style:"step",auto_scroll:true,scroll_speed:"normal",frame:false,team_header:"logo_name",league_header:"logo_name",activity_header:"logo_name"};}
  static async getConfigElement(){return document.createElement("espn-fantasy-ticker-editor");}
  getGridOptions(){return {rows:"auto",columns:12,min_rows:2,min_columns:4};}
  disconnectedCallback(){this.stopMotion();}
  roster(){return findRoster(this.hass,this._config.roster_entity||this._config.entity)||findRoster(this.hass);}
  league(){return findLeague(this.hass,this._config.league_entity||this._config.entity)||findLeague(this.hass);}
  enabledKinds(){
    const hasNew=["players","scoreboard","activity"].some(v=>Object.prototype.hasOwnProperty.call(this._config,"ticker_"+v));
    if(hasNew)return {team:this._config.ticker_players!==false,league:this._config.ticker_scoreboard!==false,activity:this._config.ticker_activity!==false};
    const fallback=this._config.type==="custom:espn-fantasy-league-ticker-card"?"scoreboard":"both",mode=this._config.content||fallback;
    return {team:mode!=="scoreboard",league:mode!=="players",activity:this._config.include_activity===true};
  }
  orderedKinds(){
    const enabled=this.enabledKinds(),map={players:"team",scoreboard:"league",activity:"activity"},configured=[this._config.ticker_section_1,this._config.ticker_section_2,this._config.ticker_section_3].filter(v=>map[v]).map(v=>map[v]);
    let order=configured.length?[...new Set([...configured,"team","league","activity"])]:this._config.section_order==="scoreboard_first"?["league","team","activity"]:["team","league","activity"];
    return order.filter(v=>enabled[v]);
  }
  sectionData(kind){
    if(kind==="team"){const a=this.roster()?.attributes||{};return {kind,name:this._config.team_label||a.team_name||"My Team",logo:a.team_logo,setting:this._config.team_header||"logo_name"};}
    const l=this.league(),a=l?.attributes||{};
    if(kind==="activity")return {kind,name:this._config.activity_label||"Activity",logo:a.league_logo||ESPN_FANTASY_ICON,setting:this._config.activity_header||this._config.league_header||"logo_name"};
    return {kind,name:this._config.league_label||l?.state||a.league_name||"League",logo:a.league_logo||ESPN_FANTASY_ICON,setting:this._config.league_header||"logo_name"};
  }
  identityMarkup(kind){const d=this.sectionData(kind);if(d.setting==="hidden")return "";return (d.setting!=="name"?teamLogo(d.logo,d.name):"")+(d.setting!=="logo"?'<strong>'+esc(d.name)+"</strong>":"");}
  baseMarkup(){const r=this.roster(),ra=r?.attributes||{},l=this.league(),la=l?.attributes||{},parts={team:[],league:[],activity:[]};for(const p of rosterOrder((this._config.show_bench?ra.players:ra.starters)||ra.players||[]))parts.team.push('<div class="ticker-item" data-kind="team" data-copy="0">'+playerTile(p,{showSlot:true,showLiveHalo:this._config.show_live_halo!==false,haloColor:this._config.live_halo_color,teamWatermark:this._config.show_team_logo_background!==false})+"</div>");for(const g of la.scoreboard||[])parts.league.push('<div class="ticker-item" data-kind="league" data-copy="0">'+leagueGame(g)+"</div>");for(const [i,event] of (la.activity||[]).slice(0,Math.min(20,Math.max(1,Number(this._config.story_count)||5))).entries())parts.activity.push('<div class="ticker-item activity-ticker-item" data-kind="activity" data-copy="0">'+activityItem(event,true,i)+"</div>");return this.orderedKinds().flatMap(k=>parts[k]).join("");}
  markup(){const base=this.baseMarkup();return this._config.scroll_style==="smooth"&&base?base+base.replaceAll('data-copy="0"','data-copy="1"'):base;}
  cycleWidth(){const first=this.shadowRoot.querySelector('.ticker-item[data-copy="0"]'),copy=this.shadowRoot.querySelector('.ticker-item[data-copy="1"]');return first&&copy?copy.offsetLeft-first.offsetLeft:0;}
  currentKind(){const viewport=this.shadowRoot.querySelector(".ticker-viewport"),items=[...this.shadowRoot.querySelectorAll('.ticker-item[data-copy="0"]')];if(!items.length)return this.orderedKinds()[0]||"team";const x=viewport?.scrollLeft||0,cycle=this.cycleWidth(),pos=cycle?x%cycle:x,identity=this.shadowRoot.querySelector(".ticker-identity"),edge=pos+(identity&&!identity.classList.contains("hidden")?identity.offsetWidth:0)+8;let current=items[0];for(const item of items){if(item.offsetLeft<=edge)current=item;else break;}return current.dataset.kind||"team";}
  updateIdentity(kind=this.currentKind()){const box=this.shadowRoot.querySelector(".ticker-identity");if(!box)return;const html=this.identityMarkup(kind);if(box.dataset.kind===kind&&box.innerHTML===html)return;box.dataset.kind=kind;box.innerHTML=html;box.classList.toggle("hidden",!html);}
  syncMotion(){this.stopMotion();const viewport=this.shadowRoot.querySelector(".ticker-viewport"),items=[...this.shadowRoot.querySelectorAll('.ticker-item[data-copy="0"]')];if(!viewport||!items.length){this.updateIdentity();return;}this.updateIdentity(this.currentKind());if(!this._config.auto_scroll)return;if(this._config.scroll_style==="smooth"){const speed={slow:18,normal:30,fast:48}[this._config.scroll_speed]||30;const tick=(ts)=>{if(!this._lastFrame)this._lastFrame=ts;const dt=Math.min(50,ts-this._lastFrame);this._lastFrame=ts;const cycle=this.cycleWidth();viewport.scrollLeft+=speed*dt/1000;if(cycle&&viewport.scrollLeft>=cycle)viewport.scrollLeft-=cycle;this.updateIdentity(this.currentKind());this._raf=requestAnimationFrame(tick);};this._raf=requestAnimationFrame(tick);return;}const ms={slow:6000,normal:4000,fast:2500}[this._config.scroll_speed]||4000;this._index=Math.max(0,Math.min(this._index,items.length-1));this._timer=setInterval(()=>{const current=[...this.shadowRoot.querySelectorAll('.ticker-item[data-copy="0"]')];if(current.length<2)return;this._index=(this._index+1)%current.length;const item=current[this._index];viewport.scrollTo({left:item.offsetLeft,behavior:this._index===0?"auto":"smooth"});this.updateIdentity(item.dataset.kind);},ms);}
  tickerPlayers(){return this.roster()?.attributes?.players||[];}
  bindTickerPlayers(){this.bindPlayers(id=>this.openPlayer(this.tickerPlayers().find(p=>String(p.id)===String(id)),this._config.stats));this.bindActivities(this.league()?.attributes?.activity||[]);}
  updateTicker(){const track=this.shadowRoot.querySelector(".ticker-track"),viewport=this.shadowRoot.querySelector(".ticker-viewport");if(!track||!viewport){this.render();return;}const left=viewport.scrollLeft,oldImages=new Map();track.querySelectorAll("img[src]").forEach(img=>{const key=img.getAttribute("src"),list=oldImages.get(key)||[];list.push(img);oldImages.set(key,list);});this.stopMotion();track.innerHTML=this.markup();track.querySelectorAll("img[src]").forEach(img=>{const list=oldImages.get(img.getAttribute("src"));const prior=list?.shift();if(prior&&prior!==img)img.replaceWith(prior);});viewport.scrollLeft=left;this.bindTickerPlayers();requestAnimationFrame(()=>{const cycle=this.cycleWidth();if(cycle&&viewport.scrollLeft>=cycle)viewport.scrollLeft%=cycle;this.syncMotion();});}
  render(){if(!this.hass)return;this.stopMotion();const headerBg=cssColor(this._config.header_background_color,"var(--card-background-color,var(--primary-background-color))"),markup=this.markup(),frameless=this._config.frame===false,size=this._config.size||"standard",firstKind=this.orderedKinds()[0]||"team",identity=this.identityMarkup(firstKind),smooth=this._config.scroll_style==="smooth";this.shadowRoot.innerHTML='<style>'+this.styles()+':host{--ticker-header-bg:'+headerBg+'}.ticker-shell{position:relative;min-width:0;overflow:hidden}.ticker-identity{position:absolute;left:0;top:0;bottom:0;z-index:3;width:190px;display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 16px;box-sizing:border-box;background:var(--ticker-header-bg);border-right:1px solid var(--divider-color)}.ticker-identity:after{content:"";position:absolute;top:0;bottom:0;right:-24px;width:24px;pointer-events:none;background:linear-gradient(90deg,var(--ticker-header-bg) 0%,var(--ticker-header-bg) 35%,transparent 100%)}.ticker-identity.hidden{display:none}.ticker-identity .team-logo-wrap{margin:0;width:46px;height:46px;flex:0 0 46px}.ticker-identity .team-logo,.ticker-identity .team-logo-fallback{width:46px;height:46px}.ticker-identity strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ticker-viewport{min-width:0;width:100%;overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain}.ticker-track{display:flex;gap:8px;width:max-content;min-width:100%;padding-left:190px;box-sizing:border-box}.ticker-identity.hidden+.ticker-viewport .ticker-track{padding-left:0}.ticker-track.step{scroll-snap-type:x mandatory}.ticker-item{flex:0 0 auto;scroll-snap-align:start;display:flex;align-items:stretch}.ticker-item>.player-tile{min-width:320px;height:100%;box-sizing:border-box}.ticker-item>.league-game{min-width:280px;height:100%;box-sizing:border-box}.activity-ticker-item>.activity-item{min-width:450px;height:100%;box-sizing:border-box;display:grid;grid-template-columns:minmax(155px,auto) minmax(190px,1fr);gap:10px 14px;align-items:center}.activity-ticker-item .activity-team{align-self:center}.activity-ticker-item .activity-players{margin:0;display:grid;gap:4px;align-self:center}.activity-ticker-item .activity-player{min-width:180px}.fantasy-ticker-card.size-compact .activity-ticker-item>.activity-item{min-width:340px}.fantasy-ticker-card.size-large .activity-ticker-item>.activity-item{min-width:540px}.fantasy-ticker-card.size-xl .activity-ticker-item>.activity-item{min-width:650px}.fantasy-ticker-card.frameless{background:transparent!important;border:none!important;box-shadow:none!important;backdrop-filter:none!important}.fantasy-ticker-card.frameless .wrap{padding:0}.fantasy-ticker-card.size-compact .ticker-item>.player-tile{min-width:220px;grid-template-columns:40px minmax(0,1fr) auto;min-height:54px}.fantasy-ticker-card.size-compact .portrait{width:40px;height:40px}.fantasy-ticker-card.size-large .ticker-item>.player-tile{min-width:340px;grid-template-columns:62px minmax(0,1fr) auto;min-height:82px}.fantasy-ticker-card.size-large .portrait{width:62px;height:62px}.fantasy-ticker-card.size-xl .ticker-item>.player-tile{min-width:430px;grid-template-columns:82px minmax(0,1fr) auto;min-height:108px}.fantasy-ticker-card.size-xl .portrait{width:82px;height:82px}@media(max-width:600px){.ticker-identity{width:130px;padding:6px 10px}.ticker-track{padding-left:130px}.ticker-identity .team-logo-wrap{width:38px;height:38px;flex-basis:38px}.ticker-identity .team-logo,.ticker-identity .team-logo-fallback{width:38px;height:38px}}</style><ha-card class="fantasy-ticker-card size-'+esc(size)+" "+(frameless?"frameless":"")+'"><div class="wrap">'+(markup?'<div class="ticker-shell"><div class="ticker-identity'+(identity?"":" hidden")+'" data-kind="'+esc(firstKind)+'">'+identity+'</div><div class="ticker-viewport"><div class="ticker-track '+(smooth?"smooth":"step")+'">'+markup+"</div></div></div>":'<div class="empty">No fantasy ticker data yet.</div>')+"</div></ha-card>"+this.dialog();this.bindTickerPlayers();this.bindDialog();this.restoreDialog(this.tickerPlayers(),this._config.stats);const viewport=this.shadowRoot.querySelector(".ticker-viewport");viewport?.addEventListener("scroll",()=>{if(this._config.scroll_style!=="smooth")this.updateIdentity(this.currentKind());},{passive:true});requestAnimationFrame(()=>this.syncMotion());}
}
class ESPNFantasyUnifiedTickerCard extends ESPNFantasyLeagueTickerCard { static getStubConfig(){return {type:"custom:espn-fantasy-ticker-card",ticker_players:true,ticker_scoreboard:true,ticker_activity:true,ticker_section_1:"players",ticker_section_2:"scoreboard",ticker_section_3:"activity",story_count:5,scroll_style:"step",auto_scroll:true,scroll_speed:"normal",frame:false,team_header:"logo_name",league_header:"logo_name",activity_header:"logo_name"};} }

class ESPNFantasyNewsCard extends ESPNBaseCard {
  static getStubConfig(){return {type:"custom:espn-fantasy-news-card",story_count:5};}
  static getConfigForm(){return {schema:[{name:"entity",required:true,selector:{entity:{domain:"sensor"}}},{name:"story_count",selector:{number:{min:1,max:20,mode:"box"}}},{name:"show_team_logo_background",selector:{boolean:{}}},{name:"appearance",selector:{select:{options:[{value:"theme",label:"Home Assistant theme"},{value:"glass",label:"Glass"},{value:"solid",label:"Solid"},{value:"transparent",label:"Transparent"}]}}},{name:"accent_color",selector:{color_rgb:{}}},{name:"glass_strength",selector:{select:{options:[{value:"subtle",label:"Subtle"},{value:"strong",label:"Strong"}]}}},{name:"border_style",selector:{select:{options:[{value:"theme",label:"Theme"},{value:"subtle",label:"Subtle"},{value:"none",label:"None"}]}}}]};}
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
 {type:"espn-fantasy-league-card",name:"ESPN Fantasy League",description:"Section-based league card with roster, standings, scores, matchup, news, activity, schedule, and playoff bracket.",preview:true},
 {type:"espn-fantasy-ticker-card",name:"ESPN Fantasy Ticker",description:"Section-based ticker for players, league scores, and activity with configurable order and scrolling.",preview:true},
 {type:"espn-fantasy-news-card",name:"ESPN Fantasy News",description:"Newest fantasy player stories with player portraits and names.",preview:true},
]) if(!window.customCards.some((x)=>x.type===card.type)) window.customCards.push({...card,documentationURL:"https://github.com/sutty-2017/ha-espn-fantasy"});
console.info(`%c ESPN Fantasy cards ${CARD_VERSION} loaded`,"color:#e31837;font-weight:bold;");

