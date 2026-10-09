// Compare real card markup for every synthetic matchup/team in both formats.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const registry = new Map();
const fixture = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const context = vm.createContext({HTMLElement: class {}, window: {}, console: {info() {}},
  customElements:{get:tag=>registry.get(tag),define:(tag,cls)=>registry.set(tag,cls)},assert,fixture});
vm.runInContext(fs.readFileSync('custom_components/espn_fantasy/www/espn-fantasy-cards.js','utf8'),context);
vm.runInContext(`
  const makeCard = attrs => {
    const card=Object.create(ESPNFantasyLeagueCard.prototype);
    card._config={stats:[]};card.leagueState=()=>({attributes:attrs});return card;
  };
  const legacy=makeCard(fixture.legacy),compact=makeCard(fixture.compact);
  for(const collection of ['schedule','scoreboard']) {
    fixture.legacy[collection].forEach((game,index)=>{
      for(const mode of ['starters','bench']) {
        assert.equal(compact.leagueDialogMarkup({type:'matchup',game:fixture.compact[collection][index],mode}),
                     legacy.leagueDialogMarkup({type:'matchup',game,mode}));
      }
    });
  }
  for(const team of fixture.legacy.team_rosters){
    const decoded=compact.teamDetail(team.team_id);
    assert.equal(compact.leagueDialogMarkup({type:'roster',team:decoded}),
                 legacy.leagueDialogMarkup({type:'roster',team}));
    for(let index=0;index<team.roster.length;index++){
      assert.equal(playerDetails(decoded.roster[index],[]),playerDetails(team.roster[index],[]));
    }
  }
  // Execute the actual popup's player click listener with a compact schedule.
  const game=fixture.compact.schedule[0],expected=fixture.legacy.schedule[0].away_team.roster[0];
  const handlers={},tile={dataset:{playerId:String(expected.id)},addEventListener:(event,fn)=>{handlers[event]=fn;}};
  const emptyClassList={remove(){},toggle(){}};
  const dialog={classList:emptyClassList,open:true,
    querySelector:selector=>selector==='.dialog-content'?{}:{classList:emptyClassList},
    querySelectorAll:selector=>selector==='.player-tile[data-player-id]'?[tile]:[]};
  compact.shadowRoot={querySelector:()=>dialog};
  compact.openLeagueDialog({type:'matchup',game,mode:'starters'});
  let clicked;
  compact.openLeagueDialog=view=>{clicked=view;};
  handlers.click();
  assert.equal(clicked.type,'player');
  assert.deepEqual(clicked.player,expected);
  assert.equal(expandLeagueTeam(undefined),undefined);
  assert.equal(expandLeagueTeam({roster_refs:['missing'],starter_refs:[]},{}).roster.length,0);
`,context);
console.log('Compact/legacy matchup, roster, player markup and nested player navigation match');
