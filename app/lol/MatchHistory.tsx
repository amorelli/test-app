import React, { useState } from 'react';
import axios from 'axios';

interface MatchHistoryProps {
  riotIdGameName: string;
  region: string;
}

interface Match {
  gameId: number;
  champion: number;
  queue: number;
  season: number;
  timestamp: number;
}

interface Summoner {
  id: string;
  accountId: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

const API_KEY = process.env.NEXT_PUBLIC_RIOT_API_KEY;

const MatchHistory: React.FC<MatchHistoryProps> = ({ riotIdGameName, region }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [summoner, setSummoner] = useState<Summoner | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSummonerName = async ({gameName = "NA1", tagLine ="Milpool"}: {gameName: string, tagLine: string}) => {
    try {
      const summonerResponse = await axios.get(`https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Milpool/NA1?api_key=${API_KEY}`, {
      });

      console.log(summonerResponse.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSummonerData = async () => {
    const res = await fetch('/api/lol/summoner');
    const data = await res.json();
    console.log(data);
    setSummoner(data.data);
  };

  return (
    <div>
      <h1>Match History for {riotIdGameName}</h1>
      <div style={{ display: 'flex', gap: '10px' }}>
        {/* <button onClick={fetchMatchHistory} type="button">Fetch Match History</button> */}
        <button onClick={fetchSummonerData} type="button">Fetch Summoner Info</button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {summoner && (
        <div>
          <h2>Summoner Info</h2>
          <p>ID: {summoner.id}</p>
          <p>Account ID: {summoner.accountId}</p>
        </div>
      )}
      <ul>
        {matches.map((match) => (
          <li key={match.gameId}>
            Game ID: {match.gameId}, Champion: {match.champion}, Queue: {match.queue}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MatchHistory;