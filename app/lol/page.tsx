'use client'

import React from 'react';
import MatchHistory from './MatchHistory';

const App: React.FC = () => {
  return (
    <div>
      <MatchHistory riotIdGameName="Milpool" region="NA1" />
    </div>
  );
};

export default App;