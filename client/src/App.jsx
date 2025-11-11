import React, { useState } from 'react';
import DeckCalculator from './components/DeckCalculator';

export default function App() {
  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, Arial' }}>
      <h1>Clash Royale Deck Gayness Calculator</h1>
      <p>Enter a player tag (with or without the leading #) or create a deck manually.</p>
      <DeckCalculator />
      <footer style={{ marginTop: 20 }}>
        <small>Note: This is a humor app. Be kind.</small>
      </footer>
    </div>
  );
}