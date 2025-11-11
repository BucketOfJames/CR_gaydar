const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const CARDS_FILE = path.join(__dirname, 'cards.json');
let cardMap = {};
try {
  cardMap = JSON.parse(fs.readFileSync(CARDS_FILE));
} catch (err) {
  console.error('Could not read cards.json. Create one at server/cards.json', err);
  process.exit(1);
}

const CR_API_TOKEN = process.env.CR_API_TOKEN || '';
const PORT = process.env.PORT || 4000;

if (!CR_API_TOKEN) {
  console.warn('Warning: CR_API_TOKEN not set. Player lookups will fail until it is configured.');
}

// Helper: map card name to mapping entry (case-insensitive)
function lookupCard(name) {
  if (!name) return null;
  // exact match
  if (cardMap[name]) return cardMap[name];
  // try case-insensitive
  const key = Object.keys(cardMap).find(k => k.toLowerCase() === name.toLowerCase());
  if (key) return cardMap[key];
  return null;
}

// Calculation logic implementing "true points" behavior
function calculateDeckScore(deckCards /* array of {name, count} */) {
  let truePoints = 0;
  let regularPoints = 0;
  let breakdown = [];

  deckCards.forEach(card => {
    const entry = lookupCard(card.name);
    const qty = card.count || 1;
    if (!entry) {
      breakdown.push({ name: card.name, value: null, qty, note: 'unknown card — add to cards.json' });
      return;
    }
    const points = entry.value * qty;
    if (entry.true) {
      truePoints += points;
    } else {
      regularPoints += points;
    }
    breakdown.push({ name: card.name, value: entry.value, qty, subtotal: points, true: !!entry.true });
  });

  let effective;
  if (truePoints > 0) {
    effective = truePoints + Math.max(regularPoints, 0);
  } else {
    effective = regularPoints;
  }

  // classification
  let label = '';
  if (effective < 8) label = 'Straight';
  else if (effective >= 8 && effective <= 12) label = 'Kinda Sus';
  else if (effective >= 13 && effective <= 16) label = 'You Like Femboys';
  else if (effective >= 17 && effective <= 20) label = 'You Like Guys And Gals';
  else if (effective > 20) label = 'You Like Dudes';

  return {
    truePoints,
    regularPoints,
    effective,
    label,
    breakdown
  };
}

// POST /api/calcDeck
// Body: { cards: [{ name: string, count?: number }] }
app.post('/api/calcDeck', (req, res) => {
  try {
    const cards = req.body.cards || [];
    const result = calculateDeckScore(cards);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});

// GET /api/player/:tag
// Fetch player from Clash Royale API (requires CR_API_TOKEN). Exposes currentDeck and recent battles (if available)
// Player tag should be URL-encoded (include %23 for #). Example: /api/player/%23TAG
app.get('/api/player/:tag', async (req, res) => {
  const tag = req.params.tag;
  if (!CR_API_TOKEN) {
    return res.status(500).json({ error: 'CR_API_TOKEN not configured on server' });
  }
  try {
    // Player endpoint
    const url = `https://api.clashroyale.com/v1/players/${encodeURIComponent(tag)}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${CR_API_TOKEN}` }});
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: 'api error', detail: txt });
    }
    const player = await r.json();

    // The API returns currentDeck and maybe some deck data. For full deck history you'd normally parse recent battles endpoint.
    // Try recentBattles
    let recent = [];
    try {
      const br = await fetch(`https://api.clashroyale.com/v1/players/${encodeURIComponent(tag)}/battlelog`, {
        headers: { Authorization: `Bearer ${CR_API_TOKEN}` }
      });
      if (br.ok) {
        recent = await br.json();
      }
    } catch (e) {
      // non-fatal
    }

    // Extract decks from current deck and battle log — normalized format: array of cards {name, count}
    const decks = [];

    if (player.currentDeck && Array.isArray(player.currentDeck.cards)) {
      decks.push({
        name: 'Current Deck',
        source: 'player.currentDeck',
        cards: player.currentDeck.cards.map(c => ({ name: c.name, count: 1 }))
      });
    }

    // From battle log, try to capture unique decks used (may contain duplicates)
    if (Array.isArray(recent)) {
      recent.forEach((battle, idx) => {
        // battle.team and battle.opponent contain card arrays in some battle types
        if (battle.team) {
          const combined = [];
          battle.team.forEach(member => {
            if (member.cards) {
              combined.push(member.cards.map(c => ({ name: c.name, count: 1 })));
            }
          });
          // flatten and try pushing unique sets
          // For simplicity push first if present
          const cards = [];
          if (battle.team[0] && battle.team[0].cards) {
            battle.team[0].cards.forEach(c => cards.push({ name: c.name, count: 1 }));
            decks.push({ name: `Recent Battle ${idx+1}`, source: 'battlelog', cards });
          }
        } else if (battle.team && battle.team[0] && battle.team[0].cards) {
          const cards = battle.team[0].cards.map(c => ({ name: c.name, count: 1 }));
          decks.push({ name: `Recent Battle ${idx+1}`, source: 'battlelog', cards });
        }
      });
    }

    return res.json({ player, decks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});