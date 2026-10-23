import { scryfallFetch } from '../utils/scryfall';
import { subtypeCatalogs } from './tokenModel';

// Sottotipi per le tendine della riga del tipo: le liste ufficiali di Scryfall (api.scryfall.com/catalog/<nome>), una
// richiesta per catalogo e per sessione. Senza rete, i sottotipi più comuni sui token (si riprova alla prossima scelta).
const FALLBACK = {
  'creature-types': ['Angel', 'Bat', 'Bear', 'Beast', 'Bird', 'Cat', 'Construct', 'Demon', 'Dragon', 'Drake', 'Elemental',
    'Elf', 'Faerie', 'Germ', 'Goat', 'Goblin', 'Golem', 'Horror', 'Human', 'Illusion', 'Insect', 'Knight', 'Myr', 'Ooze',
    'Pirate', 'Rat', 'Saproling', 'Servo', 'Shapeshifter', 'Snake', 'Soldier', 'Spider', 'Spirit', 'Squirrel', 'Thopter',
    'Treefolk', 'Vampire', 'Warrior', 'Wizard', 'Wolf', 'Wurm', 'Zombie'],
  'artifact-types': ['Blood', 'Clue', 'Equipment', 'Food', 'Gold', 'Incubator', 'Junk', 'Map', 'Powerstone', 'Treasure', 'Vehicle'],
  'enchantment-types': ['Aura', 'Background', 'Class', 'Curse', 'Room', 'Rune', 'Saga', 'Shard', 'Shrine'],
  'land-types': ['Cave', 'Desert', 'Forest', 'Gate', 'Island', 'Mountain', 'Plains', 'Swamp', 'Town'],
};
const catalogs = new Map();
const catalog = (name) => {
  if (!catalogs.has(name)) {
    catalogs.set(name, scryfallFetch(`https://api.scryfall.com/catalog/${name}`)
      .then((r) => r.json()).then((j) => (Array.isArray(j.data) ? j.data.filter((s) => typeof s === 'string') : []))
      .catch(() => { catalogs.delete(name); return FALLBACK[name] || []; }));
  }
  return catalogs.get(name);
};

// I sottotipi dei tipi scelti, uniti e in ordine alfabetico (nessuno per i soli supertipi).
export async function loadSubtypes(types) {
  const lists = await Promise.all(subtypeCatalogs(types).map(catalog));
  return [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b));
}
