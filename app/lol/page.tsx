'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import MatchOutcomeIcon from '@/app/components/MatchOutcomeIcon';


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
  summoner1Id?: number;
  summoner2Id?: number;
  riotIdGameName: string;
  teamId: number;
  win: boolean;
  teamParticipantId?: string;
  totalTimeCCDealt?: number;
  timeCCingOthers?: number;
  totalDamageDealtToChampions?: number;
  totalDamageTaken?: number;
  totalHeal?: number;
}

interface Team {
  teamId: number;
  win: boolean;
  objectives?: {
    champion?: {
      kills: number;
    };
    tower?: {
      kills: number;
    };
    inhibitor?: {
      kills: number;
    };
    baron?: {
      kills: number;
    };
    dragon?: {
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
  // Ensure all properties exist with default values
  const kills = participant.kills || 0;
  const assists = participant.assists || 0;
  const deaths = participant.deaths || 0;
  const totalDamageDealtToChampions = participant.totalDamageDealtToChampions || 0;
  const totalDamageTaken = participant.totalDamageTaken || 0;
  const totalHeal = participant.totalHeal || 0;
  
  // KDA impact (kills and assists are positive, deaths are negative)
  const kdaScore = (kills * 3 + assists - deaths * 2);
  
  // Damage contribution (damage dealt vs damage taken ratio)
  const damageScore = totalDamageDealtToChampions / Math.max(1, totalDamageTaken) * 100;
  
  // Healing contribution
  const healingScore = totalHeal / 100;
  
  // Combine scores with weights
  const totalScore = (kdaScore * 0.4) + (damageScore * 0.4) + (healingScore * 0.2);
  
  // Return rounded score
  return Math.round(totalScore * 10) / 10;
};

const getBestInColumn = (participants: MatchParticipant[], column: string) => {
  switch (column) {
    case 'kda':
      return Math.max(...participants.map(p => ((p.kills || 0) + (p.assists || 0)) / Math.max(1, (p.deaths || 0))));
    case 'damageDealt':
      return Math.max(...participants.map(p => p.totalDamageDealtToChampions || 0));
    case 'healing':
      return Math.max(...participants.map(p => p.totalHeal || 0));
    case 'damageTaken':
      return Math.max(...participants.map(p => p.totalDamageTaken || 0));
    case 'effectiveness':
      return Math.max(...participants.map(p => calculateEffectivenessScore(p)));
    case 'ccTime':
      return Math.max(...participants.map(p => p.totalTimeCCDealt || 0));
    case 'ccingOthers':
      return Math.max(...participants.map(p => p.timeCCingOthers || 0));
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



const SummonerPage = () => {
  const [summoner, setSummoner] = useState<Summoner | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchTagline, setSearchTagline] = useState('');
  const [searchRegion, setSearchRegion] = useState('na1');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [currentSearch, setCurrentSearch] = useState<{
    region: string;
    riotIdGameName: string;
    tagline: string;
  } | null>(null);
  const router = useRouter();

  // Load recent searches from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('lol-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches:', e);
      }
    }
  }, []);

  // Update tagline default when region changes
  useEffect(() => {
    if (!searchTagline) {
      setSearchTagline(searchRegion.toUpperCase());
    }
  }, [searchRegion, searchTagline]);

  // Save recent searches to localStorage
  const saveRecentSearch = (summonerName: string) => {
    const updatedSearches = [summonerName, ...recentSearches.filter(name => name !== summonerName)].slice(0, 10);
    setRecentSearches(updatedSearches);
    localStorage.setItem('lol-recent-searches', JSON.stringify(updatedSearches));
  };

  const fetchSummonerData = async (region: string, riotIdGameName: string, tagline: string) => {
    try {
      setLoading(true);
      setError(null);
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
        await fetchMatchHistory(data.summoner.puuid, region);
        // Save successful search to recent searches
        saveRecentSearch(riotIdGameName);
      }
    } catch (err) {
      setError('Failed to fetch summoner data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchHistory = async (puuid: string, region: string) => {
    try {
      const res = await fetch(`/api/lol/matches?puuid=${puuid}&region=${region}`);
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setMatches(data.matches.filter((match: any) => match.info));
      console.log('matches', data.matches);
    } catch (err) {
      setError('Failed to fetch match history');
      console.error(err);
    }
  };

  const calculateWinStats = (matches: Match[], searchedPlayerName: string) => {
    const totalGames = matches.length;
    const wins = matches.reduce((count, match) => {
      const playerParticipant = match.info.participants.find(p =>
        p.riotIdGameName.toLowerCase() === searchedPlayerName.toLowerCase()
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
    if (searchName.trim() && searchTagline.trim() && searchRegion.trim()) {
      const searchData = {
        region: searchRegion,
        riotIdGameName: searchName,
        tagline: searchTagline
      };
      setCurrentSearch(searchData);
      fetchSummonerData(searchRegion, searchName, searchTagline);
    }
  };

  const isSearchedPlayer = (participant: MatchParticipant) => {
    return currentSearch ? participant.riotIdGameName.toLowerCase() === currentSearch.riotIdGameName.toLowerCase() : false;
  };

  return (
    <div className="p-4">
      <form onSubmit={handleSearch} className="mb-6 flex gap-2 flex-wrap">
        <select
          value={searchRegion}
          onChange={(e) => {
            setSearchRegion(e.target.value);
            // Update tagline to match new region if it's still the default
            if (!searchTagline || searchTagline === searchRegion.toUpperCase()) {
              setSearchTagline(e.target.value.toUpperCase());
            }
          }}
          className="px-4 py-2 border text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="na1">NA1</option>
          <option value="euw1">EUW1</option>
          <option value="eun1">EUN1</option>
          <option value="kr">KR</option>
          <option value="jp1">JP1</option>
          <option value="br1">BR1</option>
          <option value="la1">LA1</option>
          <option value="la2">LA2</option>
          <option value="oc1">OC1</option>
          <option value="tr1">TR1</option>
          <option value="ru">RU</option>
        </select>
        <div className="relative">
          <input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Enter summoner name..."
            list="recent-searches"
            className="px-4 py-2 border text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="recent-searches">
            {recentSearches.map((search, index) => (
              <option key={index} value={search} />
            ))}
          </datalist>
        </div>
        <input
          type="text"
          value={searchTagline}
          onChange={(e) => setSearchTagline(e.target.value)}
          placeholder="Enter tagline (e.g. NA1)..."
          className="px-4 py-2 border text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {currentSearch && (
        <h1 className="text-2xl font-bold mb-4">
          {currentSearch.riotIdGameName} ({currentSearch.region.toUpperCase()})
        </h1>
      )}
      
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

      {matches.length > 0 && currentSearch && (
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <h2 className="text-xl font-semibold mb-2">Overall Performance</h2>
          <div className="flex gap-8">
            {(() => {
              const stats = calculateWinStats(matches, currentSearch.riotIdGameName);
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
                  <MatchOutcomeIcon
                    imageSrc={teamStats.won ? `../images/teemo-happy.jpg` : `../images/amumu-sad.jpg`}
                    text={teamStats.won ? "Win" : "Loss"}
                    />
                  <h3 className="font-semibold">
                    {teamId === 100 ? 'Blue' : 'Red'} Team
                    {teamStats.won && ' (Winner)'}
                  </h3>
                  <div className="flex flex-col gap-1">
                    <span>Champion Kills: {teamStats.objectives?.champion?.kills || 0}</span>
                    <span>Tower Kills: {teamStats.objectives?.tower?.kills || 0}</span>
                    <span>Inhibitor Kills: {teamStats.objectives?.inhibitor?.kills || 0}</span>
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
                      (b.totalDamageDealtToChampions || 0) - (a.totalDamageDealtToChampions || 0)
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
                      (b.totalHeal || 0) - (a.totalHeal || 0)
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
                      (b.totalDamageTaken || 0) - (a.totalDamageTaken || 0)
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
                      (b.totalTimeCCDealt || 0) - (a.totalTimeCCDealt || 0)
                    )}
                  >
                    Time Spent CC&apos;d
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
                      (b.timeCCingOthers || 0) - (a.timeCCingOthers || 0)
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
                      <span className="hover:text-blue-400 cursor-pointer">
                        {participant.riotIdGameName}
                      </span>
                    </td>
                    <td className="p-2 border-b border-gray-600 text-white">{participant.championName}</td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      (participant.kills + participant.assists) / Math.max(1, participant.deaths) === getBestInColumn(match.info.participants, 'kda')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {participant.kills || 0}/{participant.deaths || 0}/{participant.assists || 0}
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      (participant.totalDamageDealtToChampions || 0) === getBestInColumn(match.info.participants, 'damageDealt')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {participant.totalDamageDealtToChampions || 0}
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      (participant.totalHeal || 0) === getBestInColumn(match.info.participants, 'healing')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {participant.totalHeal || 0}
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      (participant.totalDamageTaken || 0) === getBestInColumn(match.info.participants, 'damageTaken')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {participant.totalDamageTaken || 0}
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      participant.totalTimeCCDealt === getBestInColumn(match.info.participants, 'ccTime')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {(participant.totalTimeCCDealt || 0)}s
                    </td>
                    <td className={`p-2 border-b border-gray-600 text-white ${
                      participant.timeCCingOthers === getBestInColumn(match.info.participants, 'ccingOthers')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {(participant.timeCCingOthers || 0)}s
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