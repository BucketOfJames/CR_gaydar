import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function DeckCalculator() {
  const [tag, setTag] = useState('');
  const [playerResult, setPlayerResult] = useState(null);
  const [manualCards, setManualCards] = useState([{ name: '', count: 1 }]);
  const [calcResult, setCalcResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function fetchPlayer() {
    setLoading(true);
    try {
      // Normalize tag: ensure it starts with # for API
      let t = tag.trim();
      if (!t) return;
      if (t[0] !== '#') t = '#' + t;
      const encoded = encodeURIComponent(t);
      const res = await fetch(`${API_BASE}/api/player/${encoded}`);
      const data = await res.json();
      setPlayerResult(data);
    } catch (e) {
      console.error(e);
      setPlayerResult({ error: 'Network error' });
    } finally {
      setLoading(false);
    }
  }

  async function calcManual() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/calcDeck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: manualCards })
      });
      const data = await response.json();
      setCalcResult(data);
    } catch (e) {
      console.error(e);
      setCalcResult({ error: 'Network error' });
    } finally {
      setLoading(false);
    }
  }

  function updateCard(i, field, value) {
    const copy = manualCards.slice();
    copy[i] = { ...copy[i], [field]: field === 'count' ? Number(value) : value };
    setManualCards(copy);
  }

  function addCard() {
    setManualCards([...manualCards, { name: '', count: 1 }]);
  }

  function removeCard(i) {
    const copy = manualCards.slice();
    copy.splice(i, 1);
    setManualCards(copy);
  }

  return (
    <div>
      <section style={{ marginBottom: 20 }}>
        <h2>Lookup Player</h2>
        <input placeholder="Player tag (e.g. #P0LJ2G)" value={tag} onChange={e => setTag(e.target.value)} />
        <button onClick={fetchPlayer} disabled={loading}>Fetch Player Decks</button>

        {playerResult && playerResult.error && <div style={{ color: 'red' }}>{playerResult.error}</div>}

        {playerResult && playerResult.player && (
          <div style={{ marginTop: 10 }}>
            <h3>{playerResult.player.name} (trophies: {playerResult.player.trophies})</h3>

            {playerResult.decks && playerResult.decks.length === 0 && <div>No decks found in response.</div>}
            {playerResult.decks && playerResult.decks.map((d, idx) => (
              <div key={idx} style={{ border: '1px solid #ddd', padding: 8, marginTop: 8 }}>
                <strong>{d.name}</strong> (source: {d.source})
                <div>
                  {d.cards && d.cards.map((c, i) => <span key={i} style={{ marginRight: 6 }}>{c.name}</span>)}
                </div>
                <button onClick={async () => {
                  // Calculate using this deck
                  setLoading(true);
                  const res = await fetch(`${API_BASE}/api/calcDeck`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cards: d.cards })
                  });
                  const json = await res.json();
                  setCalcResult(json);
                  setLoading(false);
                }}>Calculate this deck</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Manual Deck Builder</h2>
        {manualCards.map((c, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <input placeholder="Card name" value={c.name} onChange={e => updateCard(i, 'name', e.target.value)} />
            <input type="number" min="1" style={{ width: 60, marginLeft: 6 }} value={c.count} onChange={e => updateCard(i, 'count', e.target.value)} />
            <button onClick={() => removeCard(i)} disabled={manualCards.length === 1}>Remove</button>
          </div>
        ))}
        <button onClick={addCard}>Add Card</button>
        <button onClick={calcManual} disabled={loading}>Calculate Manual Deck</button>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Result</h2>
        {loading && <div>Loading...</div>}
        {calcResult && (
          <div>
            {calcResult.error && <div style={{ color: 'red' }}>{calcResult.error}</div>}
            <div><strong>Effective Points:</strong> {calcResult.effective}</div>
            <div><strong>True Points:</strong> {calcResult.truePoints}</div>
            <div><strong>Regular Points:</strong> {calcResult.regularPoints}</div>
            <div><strong>Label:</strong> {calcResult.label}</div>
            <h4>Breakdown</h4>
            <ul>
              {calcResult.breakdown && calcResult.breakdown.map((b, i) => (
                <li key={i}>
                  {b.name}: {b.value === null ? 'unknown' : `${b.value} × ${b.qty} = ${b.subtotal ?? (b.value * b.qty)}`} {b.true ? '(true)' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}