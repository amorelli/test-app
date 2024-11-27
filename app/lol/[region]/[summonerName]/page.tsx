'use client'

import React, { useState, useEffect } from 'react';

interface PageProps {
  params: {
    region: string;
    summonerName: string;
  }
}

interface Summoner {
  id: string;
  accountId: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

interface MatchMetadata {
  dataVersion: string;
  matchId: string;
  participants: string[];
}

interface MatchInfo {
  gameCreation: number;
  gameDuration: number;
  gameMode: string;
  gameType: string;
  participants: MatchParticipant[];
  teams: Team[];
  gameId: string;
}

interface MatchParticipant {
  assists: number;
  championId: number;
  championName: string;
  deaths: number;
  kills: number;
  puuid: string;
  summoner1Id: number;
  summoner2Id: number;
  summonerName: string;
  teamId: number;
  win: boolean;
}

interface Team {
  teamId: number;
  win: boolean;
  objectives: {
    champion: {
      kills: number;
    };
    tower: {
      kills: number;
    };
    inhibitor: {
      kills: number;
    };
  };
}

interface Match {
  metadata: MatchMetadata;
  info: MatchInfo;
}

const SummonerPage = ({ params }: PageProps) => {
  const { region, summonerName } = params;
  const [summoner, setSummoner] = useState<Summoner | null>(null);
  const [matches, setMatches] = useState<Match>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummonerData();
  }, [region, summonerName]);

  const fetchSummonerData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/lol/account?summonerName=${summonerName}&region=${region}`);
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setSummoner(data.summoner);
      if (data.summoner?.puuid) {
        await fetchMatchHistory(data.summoner.puuid);
      }
    } catch (err) {
      setError('Failed to fetch summoner data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchHistory = async (puuid: string) => {
    try {
      const res = await fetch(`/api/lol/matches?puuid=${puuid}&region=${region}`);
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setMatches(data.matches);
      console.log('matches', data.matches);
    } catch (err) {
      setError('Failed to fetch match history');
      console.error(err);
    }
  };
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">
        {summonerName} ({region})
      </h1>
      
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}
      
      {summoner && (
        <div className="bg-grey rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-2">Summoner Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <p>Summoner Level: {summoner.summonerLevel}</p>
            <p>Account ID: {summoner.accountId}</p>
            <p>PUUID: {summoner.puuid}</p>
            <p>Profile Icon: {summoner.profileIconId}</p>
          </div>
        </div>
      )}

      {matches.info && (
        <div className="bg-grey rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-2">Last Game Played</h2>
                Game ID: {matches.info.gameId}
                <br />
                Mode: {matches.info.gameMode}
                <br />
                Match time: {new Date(matches.info.gameCreation).toLocaleDateString()}
                <div>
                    Participants: 
                    <ul>
                      {matches.info.participants.map((participant) => 
                        <li key={participant.puuid}>{participant.summonerName}</li>)}
                    </ul>
                </div>
        </div>
      )}
    </div>
  );
};

export default SummonerPage;