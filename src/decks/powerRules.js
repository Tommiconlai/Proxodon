/**
 * Calcolatore di potenza: tutto ciò che cambia nel tempo sta qui, il calcolo in powerAnalysis.js.
 * Liste fisse, combo note, fasce e regole ufficiali dei bracket (Wizards, aggiornate a novembre 2026).
 */

// Usata solo se manca il dato game_changer di Scryfall (53 carte, novembre 2026).
export const GAME_CHANGERS = [
  'Ad Nauseam', 'Ancient Tomb', 'Aura Shards', 'Biorhythm', "Bolas's Citadel", 'Braids, Cabal Minion', 'Chrome Mox', 'Coalition Victory',
  'Consecrated Sphinx', 'Crop Rotation', 'Cyclonic Rift', 'Demonic Tutor', 'Drannith Magistrate', 'Enlightened Tutor', 'Farewell',
  'Field of the Dead', 'Fierce Guardianship', 'Force of Will', "Gaea's Cradle", 'Gamble', 'Gifts Ungiven', 'Glacial Chasm',
  'Grand Arbiter Augustin IV', 'Grim Monolith', 'Humility', 'Imperial Seal', 'Intuition', "Jeska's Will", "Lion's Eye Diamond", 'Mana Vault',
  "Mishra's Workshop", 'Mox Diamond', 'Mystical Tutor', 'Narset, Parter of Veils', 'Natural Order', 'Necropotence', 'Notion Thief',
  'Opposition Agent', 'Orcish Bowmasters', 'Panoptic Mirror', 'Rhystic Study', 'Seedborn Muse', "Serra's Sanctum", 'Smothering Tithe',
  'Survival of the Fittest', "Teferi's Protection", 'Tergrid, God of Fright', "Thassa's Oracle", 'The One Ring',
  'The Tabernacle at Pendrell Vale', 'Underworld Breach', 'Vampiric Tutor', 'Worldly Tutor',
];

// Fast mana che le regole sul testo non vedono (terre, o carte che rendono più mana di quanto costano).
export const FAST_EXTRA = [
  'Ancient Tomb', 'Burnt Offering', 'Cabal Ritual', 'City of Traitors', 'Culling the Weak', 'Desperate Ritual', 'Elvish Spirit Guide',
  "Gaea's Cradle", 'Gemstone Caverns', 'Grim Monolith', 'Infernal Plunge', 'Jeweled Lotus', "Lion's Eye Diamond", 'Lotus Petal', 'Mana Crypt',
  'Mana Vault', "Mishra's Workshop", 'Pyretic Ritual', 'Seething Song', "Serra's Sanctum", 'Simian Spirit Guide', 'Springleaf Drum',
];

// Mai fast mana, anche se le regole direbbero di sì.
export const NOT_FAST = ['Astral Cornucopia', 'Everflowing Chalice', 'Mox Tantalite'];

// Tutor che non usano le parole "search your library".
export const TUTOR_EXTRA = [
  'Burning Wish', 'Cunning Wish', 'Death Wish', 'Demonic Consultation', 'Glittering Wish', 'Golden Wish', 'Living Wish',
  "Mastermind's Acquisition", 'Ring of Maruf', 'Spoils of the Vault', 'Tainted Pact', 'Wishclaw Talisman',
];

// Land denial di massa secondo la definizione dei bracket.
export const MLD = [
  'Acid Rain', 'Apocalypse', 'Armageddon', 'Back to Basics', 'Bearer of the Heavens', 'Blood Moon', 'Boil', 'Boom // Bust', 'Burning of Xinye',
  'Cataclysm', 'Catastrophe', 'Choke', 'Cleansing', 'Contamination', 'Death Cloud', 'Decree of Annihilation', 'Destructive Force', 'Devastation',
  'Epicenter', 'Flashfires', 'Global Ruin', 'Hokori, Dust Drinker', 'Ice Cauldron', 'Impending Disaster', 'Infernal Darkness', 'Jokulhaups',
  'Keldon Firebombers', 'Mageta the Lion', 'Magus of the Moon', 'Mana Breach', 'Myojin of Infinite Rage', 'Obliterate', 'Overburden', 'Pox',
  'Price of Glory', 'Ravages of War', 'Restore Balance', 'Rising Waters', 'Ritual of Subdual', 'Ruination', 'Sire of Ruin', 'Smallpox', 'Stasis',
  'Static Orb', 'Sunder', 'Tangle Wire', 'Thoughts of Ruin', 'Tsunami', 'Upheaval', 'Vorinclex, Voice of Hunger', 'Wildfire', 'Winter Orb',
  'Worldslayer',
];

// Le combo più famose: valgono anche con Spellbook spento.
export const COMBOS = [
  "Thassa's Oracle + Demonic Consultation", "Thassa's Oracle + Tainted Pact", 'Laboratory Maniac + Demonic Consultation',
  'Laboratory Maniac + Tainted Pact', 'Jace, Wielder of Mysteries + Demonic Consultation', 'Jace, Wielder of Mysteries + Tainted Pact',
  'Isochron Scepter + Dramatic Reversal', 'Kiki-Jiki, Mirror Breaker + Zealous Conscripts', 'Kiki-Jiki, Mirror Breaker + Pestermite',
  'Kiki-Jiki, Mirror Breaker + Deceiver Exarch', 'Kiki-Jiki, Mirror Breaker + Felidar Guardian', 'Kiki-Jiki, Mirror Breaker + Restoration Angel',
  'Kiki-Jiki, Mirror Breaker + Village Bell-Ringer', 'Kiki-Jiki, Mirror Breaker + Bounding Krasis', 'Kiki-Jiki, Mirror Breaker + Corridor Monitor',
  'Splinter Twin + Pestermite', 'Splinter Twin + Deceiver Exarch', 'Splinter Twin + Village Bell-Ringer', 'Splinter Twin + Bounding Krasis',
  'Saheeli Rai + Felidar Guardian', 'Heliod, Sun-Crowned + Walking Ballista', 'Devoted Druid + Vizier of Remedies', 'Exquisite Blood + Sanguine Bond',
  'Exquisite Blood + Vito, Thorn of the Dusk Rose', 'Exquisite Blood + Marauding Blight-Priest', 'Bloodthirsty Conqueror + Sanguine Bond',
  'Bloodthirsty Conqueror + Vito, Thorn of the Dusk Rose', 'Food Chain + Eternal Scourge', 'Food Chain + Misthollow Griffin',
  'Food Chain + Squee, the Immortal', 'Worldgorger Dragon + Animate Dead', 'Worldgorger Dragon + Necromancy', 'Worldgorger Dragon + Dance of the Dead',
  'Basalt Monolith + Rings of Brighthearth', 'Basalt Monolith + Power Artifact', 'Grim Monolith + Power Artifact', 'Basalt Monolith + Forsaken Monument',
  'Kinnan, Bonder Prodigy + Basalt Monolith', 'Dualcaster Mage + Twinflame', 'Dualcaster Mage + Heat Shimmer', 'Deadeye Navigator + Peregrine Drake',
  'Deadeye Navigator + Palinchron', 'Bloom Tender + Freed from the Real', "Bloom Tender + Pemmin's Aura", 'Niv-Mizzet, Parun + Curiosity',
  'Niv-Mizzet, Parun + Ophidian Eye', 'Niv-Mizzet, Parun + Tandem Lookout', 'Niv-Mizzet, the Firemind + Curiosity',
  'Niv-Mizzet, the Firemind + Ophidian Eye', 'Niv-Mizzet, the Firemind + Tandem Lookout', "Painter's Servant + Grindstone",
  'Helm of Obedience + Rest in Peace', 'Godo, Bandit Warlord + Helm of the Host', 'Aggravated Assault + Sword of Feast and Famine',
  'Mindcrank + Duskmantle Guildmage', 'Earthcraft + Squirrel Nest', 'Professor Onyx + Chain of Smog', 'Witherbloom Apprentice + Chain of Smog',
  'Chatterfang, Squirrel General + Pitiless Plunderer', 'Scurry Oak + Ivy Lane Denizen', 'Pili-Pala + Grand Architect',
  "Auriok Salvagers + Lion's Eye Diamond", "Underworld Breach + Lion's Eye Diamond + Brain Freeze",
  "Bolas's Citadel + Sensei's Divining Top + Aetherflux Reservoir", 'Ghostly Flicker + Archaeomancer + Peregrine Drake',
  'Ghostly Flicker + Mnemonic Wall + Peregrine Drake', "Nim Deathmantle + Ashnod's Altar + Grave Titan",
].map((c) => c.split(' + '));

export const FACTORS = [
  ['S', 'Speed'], ['I', 'Interaction'], ['C', 'Consistency'], ['W', 'Win line'], ['M', 'Mana base'],
];
export const DEFAULT_WEIGHTS = { S: 0.3, I: 0.2, C: 0.2, W: 0.2, M: 0.1 };

// Forza del comandante: moltiplica l'indice.
export const STRENGTHS = [
  [0.9, 'Weak or theme'], [1, 'Neutral'], [1.1, 'Value engine'], [1.2, 'Wins alone or combo piece'],
];

// Linee di vittoria: valore della modalità nel fattore W.
export const WIN_LINES = { combo2fast: 10, combo2: 8, combo3: 6, value: 3.5, combat: 1.5 };
export const WIN_LABEL = {
  combo2fast: 'Fast two-card combo', combo2: 'Two-card combo', combo3: 'Three-card combo', value: 'Value', combat: 'Combat',
};

// Fasce dell'indice: from = da quel valore in su, value = per il confronto con le regole, label = sul quadrante.
export const TIERS = [
  { id: 'casual', name: 'Casual', label: 'B1–2', from: 0, value: 2 },
  { id: 'b3', name: 'B3', label: 'B3', from: 3, value: 3 },
  { id: 'b3plus', name: 'B3+', label: 'B3+', from: 5, value: 3.5 },
  { id: 'b4', name: 'B4', label: 'B4', from: 7, value: 4 },
  { id: 'b5', name: 'B5', label: 'B5', from: 8.5, value: 5 },
];
// Sul valore a due decimali, quello che si vede: un 2.996 mostrato 3.00 è già B3.
export const tierOf = (p) => {
  const v = Math.round(p * 100) / 100;
  return TIERS.findLast((t) => v >= t.from);
};

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Regole ufficiali: una riga per condizione, min = il bracket minimo se scatta, items = le carte che la fanno scattare.
export const ruleChecks = ({ gameChangers, twoCardCombos, mld, extraTurns }) => [
  { id: 'gc', on: gameChangers.length > 0, min: gameChangers.length > 3 ? 4 : 3, text: plural(gameChangers.length, 'Game Changer'),
    off: 'No Game Changers', items: gameChangers.map((c) => c.name) },
  { id: 'combo', on: twoCardCombos.length > 0, min: 3, text: plural(twoCardCombos.length, 'two-card combo'),
    off: 'No two-card combos', items: twoCardCombos.map((c) => c.cards.join(' + ')) },
  { id: 'mld', on: mld.length > 0, min: 4, text: 'Mass land denial', off: 'No mass land denial', items: mld.map((c) => c.name) },
  { id: 'turns', on: extraTurns.length > 0, min: 2, text: 'Extra turns', off: 'No extra turns', items: extraTurns.map((c) => c.name) },
];
