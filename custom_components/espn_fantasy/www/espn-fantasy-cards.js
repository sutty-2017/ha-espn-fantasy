const CARD_VERSION = "0.1.6";
const PLAYER_PREFIX = "sensor.espn_fantasy_";
const GAME_PREFIX = "binary_sensor.espn_fantasy_";
const ROSTER_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "D/ST", "Bench", "IR"];

const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[char]));

const number = (value, digits = 1) => {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : esc(value);
};

const playerStates = (hass, config = {}) => {
  let states = Object.values(hass.states || {}).filter((state) =>
    state.entity_id.startsWith(PLAYER_PREFIX) && state.attributes?.player_id !== undefined
  );

  if (config.entity) {
    const parts = config.entity.split("_");
    if (parts.length >= 4) {
      const prefix = `${parts.slice(0, 4).join("_")}_`;
      states = states.filter((state) => state.entity_id.startsWith(prefix));
    }
  }

  return states;
};

const showMoreInfo = (element, entityId) => {
  element.dispatchEvent(new CustomEvent("hass-more-info", {
    bubbles: true,
    composed: true,
    detail: { entityId },
  }));
};

class ESPNBaseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._config = {};
  }

  set hass(value) {
    this._hass = value;
    this.render();
  }

  get hass() {
    return this._hass;
  }

  setConfig(config) {
    this._config = config || {};
    this.render();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return { rows: 6, columns: 12, min_rows: 3, max_rows: 12 };
  }

  _baseStyles() {
    return `
      :host { display:block; }
      ha-card { overflow:hidden; }
      .wrap { padding:16px; }
      .title { display:flex; align-items:center; gap:10px; font-size:20px; font-weight:600; margin-bottom:14px; }
      .title-icon { font-size:22px; }
      .grid { display:grid; grid-template-columns:repeat(var(--columns, 4), minmax(0, 1fr)); gap:10px; }
      .section { margin-top:16px; }
      .section:first-of-type { margin-top:0; }
      .section-title { font-size:13px; font-weight:700; opacity:.75; text-transform:uppercase; letter-spacing:.05em; margin:0 0 8px; }
      .player { position:relative; display:grid; grid-template-columns:52px 1fr; gap:10px; align-items:center; min-height:70px; padding:9px; border-radius:14px; background:var(--ha-card-background,var(--card-background-color)); border:1px solid var(--divider-color); cursor:pointer; box-sizing:border-box; }
      .player:hover { filter:brightness(1.05); }
      .photo { width:52px; height:52px; border-radius:50%; object-fit:cover; background:var(--secondary-background-color); }
      .name { font-weight:650; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .meta { font-size:12px; opacity:.72; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .points { font-size:17px; font-weight:700; margin-top:5px; }
      .badge { position:absolute; top:7px; right:7px; padding:2px 6px; border-radius:999px; font-size:10px; font-weight:800; background:var(--error-color); color:white; }
      .empty { opacity:.65; padding:8px 0; }
      .error { color:var(--error-color); }
      @media (max-width: 600px) { .grid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
    `;
  }
}

class ESPNFantasyRosterCard extends ESPNBaseCard {
  static getStubConfig() {
    return { type: "custom:espn-fantasy-roster-card" };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "entity", selector: { entity: { domain: "sensor" } } },
        { name: "columns", selector: { number: { min: 1, max: 6, mode: "box" } } },
      ],
    };
  }

  getCardSize() { return 8; }

  render() {
    if (!this.shadowRoot || !this.hass) return;
    const states = playerStates(this.hass, this._config);
    const columns = Math.max(1, Math.min(6, Number(this._config.columns || 4)));
    const grouped = Object.fromEntries(ROSTER_ORDER.map((slot) => [slot, []]));

    states.forEach((state) => {
      const slot = state.attributes?.roster_slot || "Bench";
      (grouped[slot] ||= []).push(state);
    });

    const sections = ROSTER_ORDER
      .filter((slot) => grouped[slot]?.length)
      .map((slot) => `
        <section class="section">
          <div class="section-title">${esc(slot)}</div>
          <div class="grid" style="--columns:${columns}">
            ${grouped[slot].map((state) => this._player(state)).join("")}
          </div>
        </section>
      `).join("");

    this.shadowRoot.innerHTML = `
      <style>${this._baseStyles()}</style>
      <ha-card>
        <div class="wrap">
          <div class="title"><span class="title-icon">🏈</span><span>ESPN Fantasy Roster</span></div>
          ${sections || '<div class="empty">No ESPN Fantasy player sensors found.</div>'}
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll(".player").forEach((node) => {
      node.addEventListener("click", () => showMoreInfo(this, node.dataset.entity));
    });
  }

  _player(state) {
    const a = state.attributes || {};
    const liveEntity = Object.values(this.hass.states || {}).find((candidate) =>
      candidate.entity_id.startsWith(GAME_PREFIX) && String(candidate.attributes?.player_id) === String(a.player_id)
    );
    const live = liveEntity?.state === "on";
    const team = a.nfl_team || "";
    const opponent = a.opponent ? `vs ${a.opponent}` : "";
    const meta = [a.position, team, opponent].filter(Boolean).join(" · ");
    const points = live && a.live_points !== undefined && a.live_points !== null
      ? `${number(a.live_points)} live`
      : `${number(state.state)} pts`;
    const projection = a.projected_points !== undefined ? ` · ${number(a.projected_points)} proj` : "";
    const picture = a.headshot || "";
    return `
      <div class="player" data-entity="${esc(state.entity_id)}">
        ${picture ? `<img class="photo" src="${esc(picture)}" alt="" loading="lazy">` : `<div class="photo"></div>`}
        <div>
          <div class="name">${esc(a.friendly_name || state.name || state.entity_id)}</div>
          <div class="meta">${esc(meta || "ESPN Fantasy")}</div>
          <div class="points">${esc(points)}${esc(projection)}</div>
        </div>
        ${live ? '<span class="badge">LIVE</span>' : ""}
      </div>
    `;
  }
}

class ESPNFantasyLiveCard extends ESPNBaseCard {
  static getStubConfig() {
    return { type: "custom:espn-fantasy-live-card" };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "entity", selector: { entity: { domain: "binary_sensor" } } },
        { name: "columns", selector: { number: { min: 1, max: 6, mode: "box" } } },
      ],
    };
  }

  getCardSize() { return 4; }

  render() {
    if (!this.shadowRoot || !this.hass) return;
    const liveStates = Object.values(this.hass.states || {}).filter((state) =>
      state.entity_id.startsWith(GAME_PREFIX) && state.entity_id.endsWith("_game_active") && state.state === "on"
    );
    const columns = Math.max(1, Math.min(6, Number(this._config.columns || 3)));
    const players = liveStates.map((live) => {
      const id = live.attributes?.player_id;
      return Object.values(this.hass.states || {}).find((state) =>
        state.entity_id.startsWith(PLAYER_PREFIX) && String(state.attributes?.player_id) === String(id)
      );
    }).filter(Boolean);

    this.shadowRoot.innerHTML = `
      <style>${this._baseStyles()}</style>
      <ha-card>
        <div class="wrap">
          <div class="title"><span class="title-icon">🔴</span><span>ESPN Fantasy Live</span></div>
          ${players.length
            ? `<div class="grid" style="--columns:${columns}">${players.map((state) => this._player(state)).join("")}</div>`
            : '<div class="empty">No rostered players are live right now.</div>'}
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll(".player").forEach((node) => {
      node.addEventListener("click", () => showMoreInfo(this, node.dataset.entity));
    });
  }

  _player(state) {
    const a = state.attributes || {};
    const game = Object.values(this.hass.states || {}).find((candidate) =>
      candidate.entity_id.startsWith(GAME_PREFIX) && String(candidate.attributes?.player_id) === String(a.player_id)
    );
    const ga = game?.attributes || {};
    const points = ga.live_points ?? a.live_points ?? state.state;
    const meta = [a.position, a.nfl_team, a.opponent ? `vs ${a.opponent}` : ""].filter(Boolean).join(" · ");
    return `
      <div class="player" data-entity="${esc(state.entity_id)}">
        ${a.headshot ? `<img class="photo" src="${esc(a.headshot)}" alt="" loading="lazy">` : '<div class="photo"></div>'}
        <div>
          <div class="name">${esc(a.friendly_name || state.name || state.entity_id)}</div>
          <div class="meta">${esc(meta || "ESPN Fantasy")}</div>
          <div class="points">${number(points)} pts</div>
        </div>
        <span class="badge">LIVE</span>
      </div>
    `;
  }
}

if (!customElements.get("espn-fantasy-roster-card")) {
  customElements.define("espn-fantasy-roster-card", ESPNFantasyRosterCard);
}
if (!customElements.get("espn-fantasy-live-card")) {
  customElements.define("espn-fantasy-live-card", ESPNFantasyLiveCard);
}

window.customCards = window.customCards || [];
const registerCard = (entry) => {
  if (!window.customCards.some((card) => card.type === entry.type)) {
    window.customCards.push(entry);
  }
};

registerCard({
  type: "espn-fantasy-roster-card",
  name: "ESPN Fantasy Roster",
  description: "A live roster card for ESPN Fantasy Football.",
  preview: true,
  documentationURL: "https://github.com/sutty-2017/ha-espn-fantasy",
  getEntitySuggestion: (hass, entityId) => {
    if (!entityId.startsWith(PLAYER_PREFIX)) return null;
    return { config: { type: "custom:espn-fantasy-roster-card", entity: entityId } };
  },
});

registerCard({
  type: "espn-fantasy-live-card",
  name: "ESPN Fantasy Live",
  description: "Shows rostered ESPN Fantasy players whose NFL games are currently live.",
  preview: true,
  documentationURL: "https://github.com/sutty-2017/ha-espn-fantasy",
  getEntitySuggestion: (hass, entityId) => {
    if (!entityId.startsWith(GAME_PREFIX) || !entityId.endsWith("_game_active")) return null;
    return { config: { type: "custom:espn-fantasy-live-card", entity: entityId } };
  },
});

console.info(`%c ESPN Fantasy cards ${CARD_VERSION} loaded`, "color:#e31837;font-weight:bold;");
