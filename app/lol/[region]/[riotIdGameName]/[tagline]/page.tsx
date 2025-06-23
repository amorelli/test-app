'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/app/components/LoadingSpinner';

interface PageProps {
  params: {
    region: string;
    riotIdGameName: string;
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
  riotIdGameName: string;
  teamId: number;
  win: boolean;
  teamParticipantId?: string;
  totalTimeCCDealt: number;
  timeCCingOthers: number;
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

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

const calculateEffectivenessScore = (participant: MatchParticipant) => {
  // KDA impact (kills and assists are positive, deaths are negative)
  const kdaScore = (participant.kills * 3 + participant.assists - participant.deaths * 2);
  
  // Damage contribution (damage dealt vs damage taken ratio)
  const damageScore = participant.totalDamageDealtToChampions / Math.max(1, participant.totalDamageTaken) * 100;
  
  // Healing contribution
  const healingScore = participant.totalHeal / 100;
  
  // Combine scores with weights
  const totalScore = (kdaScore * 0.4) + (damageScore * 0.4) + (healingScore * 0.2);
  
  // Return rounded score
  return Math.round(totalScore * 10) / 10;
};

const getBestInColumn = (participants: MatchParticipant[], column: string) => {
  switch (column) {
    case 'kda':
      return Math.max(...participants.map(p => (p.kills + p.assists) / Math.max(1, p.deaths)));
    case 'damageDealt':
      return Math.max(...participants.map(p => p.totalDamageDealtToChampions));
    case 'healing':
      return Math.max(...participants.map(p => p.totalHeal));
    case 'damageTaken':
      return Math.max(...participants.map(p => p.totalDamageTaken));
    case 'effectiveness':
      return Math.max(...participants.map(p => calculateEffectivenessScore(p)));
    case 'ccTime':
      return Math.max(...participants.map(p => p.totalTimeCCDealt));
    case 'ccingOthers':
      return Math.max(...participants.map(p => p.timeCCingOthers));
    default:
      return null;
  }
};

const getWinningTeam = (match: Match) => {
  const winningTeam = match.info.teams.find(team => team.win);
  if (!winningTeam) return null;
  
  const winningPlayers = match.info.participants.filter(p => p.teamId === winningTeam.teamId);
  return {
    teamId: winningTeam.teamId,
    players: winningPlayers,
    objectives: winningTeam.objectives
  };
};

const getTeamStats = (match: Match, teamId: number) => {
  const team = match.info.teams.find(t => t.teamId === teamId);
  if (!team) return null;
  
  const players = match.info.participants.filter(p => p.teamId === teamId);
  return {
    teamId,
    players,
    objectives: team.objectives,
    won: team.win
  };
};

const getPartyGroups = (participants: MatchParticipant[]) => {
  const parties = new Map<string, MatchParticipant[]>();
  
  participants.forEach(participant => {
    if (participant.teamParticipantId) {
      const existing = parties.get(participant.teamParticipantId) || [];
      parties.set(participant.teamParticipantId, [...existing, participant]);
    }
  });

  return Array.from(parties.values()).filter(party => party.length > 1);
};



const SummonerPage = ({ params }: PageProps) => {
  const { region, riotIdGameName, tagline } = params;
  const [summoner, setSummoner] = useState<Summoner | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchTagline, setSearchTagline] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchSummonerData();
  }, [region, riotIdGameName, tagline]);

  const fetchSummonerData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/lol/account?riotIdGameName=${riotIdGameName}&tagline=${tagline}&region=${region}`);
      const data = await res.json();
      
      console.log('API Request:', {
        riotIdGameName,
        tagline,
        region
      });
      
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
      
      setMatches(data.matches.filter(match => match.info));
      console.log('matches', data.matches);
    } catch (err) {
      setError('Failed to fetch match history');
      console.error(err);
    }
  };

  const calculateWinStats = (matches: Match[]) => {
    const totalGames = matches.length;
    const wins = matches.reduce((count, match) => {
      const playerParticipant = match.info.participants.find(p => 
        p.riotIdGameName.toLowerCase() === riotIdGameName.toLowerCase()
      );
      return count + (playerParticipant?.win ? 1 : 0);
    }, 0);
    
    return {
      wins,
      losses: totalGames - wins,
      winRate: Math.round((wins / totalGames) * 100)
    };
  };

  const handleSort = (matchIndex: number, column: string, compareFn: (a: MatchParticipant, b: MatchParticipant) => number) => {
    const newSortConfigs = [...sortConfigs];
    const currentConfig = newSortConfigs[matchIndex] || { column: '', direction: 'asc' };
    
    const newDirection = 
      currentConfig.column === column && currentConfig.direction === 'asc' ? 'desc' : 'asc';
    
    const updatedMatches = [...matches];
    const sorted = [...updatedMatches[matchIndex].info.participants].sort((a, b) => {
      const compareResult = compareFn(a, b);
      return newDirection === 'asc' ? compareResult : -compareResult;
    });

    updatedMatches[matchIndex].info.participants = sorted;
    newSortConfigs[matchIndex] = { column, direction: newDirection };
    setSortConfigs(newSortConfigs);
    setMatches(updatedMatches);
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchName.trim() && searchTagline.trim()) {
      router.push(`/lol/${region}/${searchName}/${searchTagline}`);
    }
  };

  const isSearchedPlayer = (participant: MatchParticipant) => {
    return participant.riotIdGameName.toLowerCase() === riotIdGameName.toLowerCase();
  };

  return (
    <div className="p-4">
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <input
          type="text"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Enter summoner name..."
          className="px-4 py-2 border text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          value={searchTagline}
          onChange={(e) => setSearchTagline(e.target.value)}
          placeholder="Enter tagline (e.g. NA1)..."
          className="px-4 py-2 border text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
        <button 
          type="submit"
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Search
        </button>
      </form>

      <h1 className="text-2xl font-bold mb-4">
        {riotIdGameName} ({region})
      </h1>
      
      {loading && <LoadingSpinner />}
      {error && <div className="text-red-500">{error}</div>}
      
      {/* {summoner && (
        <div className="bg-grey rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-2">Summoner Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <p>Summoner Level: {summoner.summonerLevel}</p>
            <p>Account ID: {summoner.accountId}</p>
            <p>PUUID: {summoner.puuid}</p>
            <p>Profile Icon: {summoner.profileIconId}</p>
          </div>
        </div>
      )} */}

      {matches.length > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <h2 className="text-xl font-semibold mb-2">Overall Performance</h2>
          <div className="flex gap-8">
            {(() => {
              const stats = calculateWinStats(matches);
              return (
                <>
                  <div>
                    <span className="text-green-500 font-bold">{stats.wins}</span> Wins
                  </div>
                  <div>
                    <span className="text-red-500 font-bold">{stats.losses}</span> Losses
                  </div>
                  <div>
                    <span className={`font-bold ${
                      stats.winRate >= 50 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {stats.winRate}%
                    </span> Win Rate
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {matches.length > 0 && matches.map((match, index) => (
        <div key={match.metadata.matchId} className="bg-grey rounded-lg shadow p-4 mb-4">
          <h2 className="text-xl font-semibold mb-2">Game {index + 1}</h2>
          Mode: {match.info.gameMode}
          <br />
          Match time: {new Date(match.info.gameCreation).toLocaleDateString()}
          <div className="flex gap-4 mb-4">
            {[100, 200].map(teamId => {
              const teamStats = getTeamStats(match, teamId);
              if (!teamStats) return null;
              
              const parties = getPartyGroups(teamStats.players);
              
              return (
                <div 
                  key={teamId}
                  className={`flex-1 p-2 rounded ${
                    teamId === 100 ? 'bg-blue-900' : 'bg-red-900'
                  } bg-opacity-50`}
                >
                  <h3 className="font-semibold">
                    {teamId === 100 ? 'Blue' : 'Red'} Team 
                    {teamStats.won && ' (Winner)'}
                  </h3>
                  <div className="flex flex-col gap-1">
                    <span>Champion Kills: {teamStats.objectives.champion.kills}</span>
                    <span>Tower Kills: {teamStats.objectives.tower.kills}</span>
                    <span>Inhibitor Kills: {teamStats.objectives.inhibitor.kills}</span>
                    {parties.length > 0 && (
                      <div className="mt-2">
                        <span className="font-semibold">Parties:</span>
                        {parties.map((party, i) => (
                          <div key={i} className="text-sm opacity-80">
                            Party {i + 1}: {party.map(p => p.riotIdGameName).join(', ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th 
                    className={`text-left p-2 border-b-2 border-gray-300 text-white cursor-pointer hover:bg-gray-700 ${
                      sortConfigs[index]?.column === 'riotIdGameName' ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => handleSort(index, 'riotIdGameName', (a, b) => 
                      a.riotIdGameName.localeCompare(b.riotIdGameName)
                    )}
                  >
                    Summoner Name
                    <span className="ml-2">
                      {sortConfigs[index]?.column === 'riotIdGameName' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th 
                    className={`text-left p-2 border-b-2 border-gray-300 text-white cursor-pointer hover:bg-gray-700 ${
                      sortConfigs[index]?.column === 'championName' ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => handleSort(index, 'championName', (a, b) => 
                      a.championName.localeCompare(b.championName)
                    )}
                  >
                    Champion
                    <span className="ml-2">
                      {sortConfigs[index]?.column === 'championName' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th 
                    className={`text-left p-2 border-b-2 border-gray-300 text-white cursor-pointer hover:bg-gray-700 ${
                      sortConfigs[index]?.column === 'kda' ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => handleSort(index, 'kda', (a, b) => 
                      (b.kills + b.assists - b.deaths) - (a.kills + a.assists - a.deaths)
                    )}
                  >
                    K/D/A
                    <span className="ml-2">
                      {sortConfigs[index]?.column === 'kda' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th 
                    className={`text-left p-2 border-b-2 border-gray-300 text-white cursor-pointer hover:bg-gray-700 ${
                      sortConfigs[index]?.column === 'damageDealt' ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => handleSort(index, 'damageDealt', (a, b) => 
                      b.totalDamageDealtToChampions - a.totalDamageDealtToChampions
                    )}
                  >
                    Damage Dealt
                    <span className="ml-2">
                      {sortConfigs[index]?.column === 'damageDealt' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th 
                    className={`text-left p-2 border-b-2 border-gray-300 text-white cursor-pointer hover:bg-gray-700 ${
                      sortConfigs[index]?.column === 'healing' ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => handleSort(index, 'healing', (a, b) => 
                      b.totalHeal - a.totalHeal
                    )}
                  >
                    Total Healing
                    <span className="ml-2">
                      {sortConfigs[index]?.column === 'healing' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th 
                    className={`text-left p-2 border-b-2 border-gray-300 text-white cursor-pointer hover:bg-gray-700 ${
                      sortConfigs[index]?.column === 'damageTaken' ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => handleSort(index, 'damageTaken', (a, b) => 
                      b.totalDamageTaken - a.totalDamageTaken
                    )}
                  >
                    Damage Taken
                    <span className="ml-2">
                      {sortConfigs[index]?.column === 'damageTaken' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th 
                    className={`text-left p-2 border-b-2 border-gray-300 text-white cursor-pointer hover:bg-gray-700 ${
                      sortConfigs[index]?.column === 'ccTime' ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => handleSort(index, 'ccTime', (a, b) => 
                      b.totalTimeCCDealt - a.totalTimeCCDealt
                    )}
                  >
                    Time Spent CC'd
                    <span className="ml-2">
                      {sortConfigs[index]?.column === 'ccTime' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th 
                    className={`text-left p-2 border-b-2 border-gray-300 text-white cursor-pointer hover:bg-gray-700 ${
                      sortConfigs[index]?.column === 'ccingOthers' ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => handleSort(index, 'ccingOthers', (a, b) => 
                      b.timeCCingOthers - a.timeCCingOthers
                    )}
                  >
                    CC Time Dealt
                    <span className="ml-2">
                      {sortConfigs[index]?.column === 'ccingOthers' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th 
                    className={`text-left p-2 border-b-2 border-gray-300 text-white cursor-pointer hover:bg-gray-700 ${
                      sortConfigs[index]?.column === 'effectiveness' ? 'bg-gray-700' : ''
                    }`}
                    onClick={() => handleSort(index, 'effectiveness', (a, b) => 
                      calculateEffectivenessScore(b) - calculateEffectivenessScore(a)
                    )}
                  >
                    Effectiveness Score
                    <span className="ml-2">
                      {sortConfigs[index]?.column === 'effectiveness' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {console.log('match info', match.info)}
                {match.info.participants.map((participant) => (
                  <tr 
                    key={participant.puuid} 
                    className={`hover:bg-opacity-80 ${
                      isSearchedPlayer(participant)
                        ? `ring-2 ring-yellow-400 ${
                            participant.teamId === 100 
                              ? 'bg-blue-900'
                              : 'bg-red-900'
                          } bg-opacity-70`
                        : participant.teamId === 100 
                          ? 'bg-blue-900 bg-opacity-50' 
                          : 'bg-red-900 bg-opacity-50'
                    }`}
                  >
                    <td className="p-2 border-b border-gray-600 text-white">
                      <a 
                        href={`/lol/${region}/${participant.riotIdGameName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-400 underline cursor-pointer"
                      >
                        {participant.riotIdGameName}
                      </a>
                    </td>
                    <td className="p-2 border-b border-gray-600 text-white">{participant.championName}</td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      (participant.kills + participant.assists) / Math.max(1, participant.deaths) === getBestInColumn(match.info.participants, 'kda')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {participant.kills}/{participant.deaths}/{participant.assists}
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      participant.totalDamageDealtToChampions === getBestInColumn(match.info.participants, 'damageDealt')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {participant.totalDamageDealtToChampions}
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      participant.totalHeal === getBestInColumn(match.info.participants, 'healing')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {participant.totalHeal}
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      participant.totalDamageTaken === getBestInColumn(match.info.participants, 'damageTaken')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {participant.totalDamageTaken}
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      participant.totalTimeCCDealt === getBestInColumn(match.info.participants, 'ccTime')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {participant.totalTimeCCDealt}s
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      participant.timeCCingOthers === getBestInColumn(match.info.participants, 'ccingOthers')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {participant.timeCCingOthers}s
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      calculateEffectivenessScore(participant) === getBestInColumn(match.info.participants, 'effectiveness')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {calculateEffectivenessScore(participant)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SummonerPage;