// Execute actual card helpers with legacy highlight settings/data present.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const registry = new Map();
const context = vm.createContext({
  HTMLElement: class {}, window: {}, console: { info() {} },
  customElements: { get: tag => registry.get(tag), define: (tag, cls) => registry.set(tag, cls) },
  assert,
});
vm.runInContext(fs.readFileSync('custom_components/espn_fantasy/www/espn-fantasy-cards.js', 'utf8'), context);
vm.runInContext(`
  const legacyPlayer = {id: 100, name: 'Player One', position: 'QB',
    news: [{headline: 'Fantasy news retained', description: 'Story content'}],
    highlights: [{source: 'https://example.invalid/clip.mp4', headline: 'Old clip'}]};
  const card = Object.create(ESPNFantasyLeagueCard.prototype);
  card._config = {news_highlights: true, news_highlights_position: 'above', story_count: 5};
  card.rosterState = () => ({attributes: {players: [legacyPlayer]}});
  card.leagueState = () => ({attributes: {highlights: legacyPlayer.highlights}});
  const news = card.newsBody();
  assert.ok(news.includes('Fantasy news retained'));
  assert.ok(news.includes('Player One'));
  assert.ok(!news.includes('<video') && !news.includes('Old clip'));
  const popup = playerDetails(legacyPlayer, []);
  assert.ok(popup.includes('Fantasy news retained'));
  assert.ok(!popup.includes('<video') && !popup.includes('Old clip'));
  card.rosterState = () => ({attributes: {players: []}});
  assert.ok(card.newsBody().includes('No player news available yet.'));
`, context);
assert.equal(registry.size, 11, 'All existing card and editor registrations remain');
console.log('Frontend legacy-settings/news/player-popup checks passed');
