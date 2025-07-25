'use client'

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

const SummonerStatsPage = () => {
  const params = useParams();
  const router = useRouter();
  const region = params.region as string;
  const riotIdGameName = decodeURIComponent(params.riotIdGameName as string);
  const tagline = decodeURIComponent(params.tagline as string);

  const [summoner, setSummoner] = useState<Summoner | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  
  // Form state
  const [searchName, setSearchName] = useState('');
  const [searchTagline, setSearchTagline] = useState('');
  const [searchRegion, setSearchRegion] = useState('na1');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Initialize form with URL parameters
  useEffect(() => {
    setSearchRegion(region);
    setSearchName(riotIdGameName);
    setSearchTagline(tagline);
  }, [region, riotIdGameName, tagline]);

  // Load recent searches from localStorage
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

  useEffect(() => {
    if (region && riotIdGameName && tagline) {
      fetchSummonerData(region, riotIdGameName, tagline);
    }
  }, [region, riotIdGameName, tagline]);

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
      // Save to recent searches
      const updatedSearches = [searchName, ...recentSearches.filter(name => name !== searchName)].slice(0, 10);
      setRecentSearches(updatedSearches);
      localStorage.setItem('lol-recent-searches', JSON.stringify(updatedSearches));
      
      // Navigate to the new search
      router.push(`/lol/${searchRegion}/${encodeURIComponent(searchName)}/${encodeURIComponent(searchTagline)}`);
    }
  };

  const isSearchedPlayer = (participant: MatchParticipant) => {
    return participant.riotIdGameName.toLowerCase() === riotIdGameName.toLowerCase();
  };

  const handleSummonerClick = (summonerName: string) => {
    // Don't navigate if clicking on the currently searched player
    if (summonerName.toLowerCase() === riotIdGameName.toLowerCase()) {
      return;
    }
    
    // Use the current region and region as default tagline
    const defaultTagline = region.toUpperCase();
    router.push(`/lol/${region}/${encodeURIComponent(summonerName)}/${encodeURIComponent(defaultTagline)}`);
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-500 text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          {riotIdGameName} ({region.toUpperCase()})
        </h1>
        
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
            required
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
          required
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          Search
        </button>
      </form>
      
      {matches.length > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <h2 className="text-xl font-semibold mb-2">Overall Performance</h2>
          <div className="flex gap-8">
            {(() => {
              const stats = calculateWinStats(matches, riotIdGameName);
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
        <div key={match.metadata.matchId} className="bg-gray-800 rounded-lg shadow p-4 mb-4">
          <div className="mb-3 text-sm text-gray-300">
            <span className="font-medium">{match.info.gameMode}</span> • {new Date(match.info.gameCreation).toLocaleDateString()}
          </div>
          
          <div className="flex gap-3 mb-4 h-20">
            {[100, 200].map(teamId => {
              const teamStats = getTeamStats(match, teamId);
              if (!teamStats) return null;
              
              const parties = getPartyGroups(teamStats.players);
              
              return (
                <div
                  key={teamId}
                  className={`flex-1 p-3 rounded-lg ${
                    teamId === 100 ? 'bg-blue-900' : 'bg-red-900'
                  } bg-opacity-40 border ${
                    teamId === 100 ? 'border-blue-700' : 'border-red-700'
                  } border-opacity-50`}
                >
                  <div className="flex items-center justify-between h-full">
                    <div className="flex items-center gap-3">
                      <img
                        src={teamStats.won ? `/images/teemo-happy.jpg` : `/images/amumu-sad.jpg`}
                        alt={teamStats.won ? "Win" : "Loss"}
                        className="w-12 h-12 rounded-full object-cover border-2 border-white border-opacity-20"
                      />
                      <div>
                        <h3 className="font-semibold text-white text-lg">
                          {teamId === 100 ? 'Blue' : 'Red'} Team
                        </h3>
                        <span className={`text-sm font-medium ${
                          teamStats.won ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {teamStats.won ? 'Victory' : 'Defeat'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 text-sm text-gray-300">
                      <div className="text-center">
                        <div className="font-semibold text-white">{teamStats.objectives?.champion?.kills || 0}</div>
                        <div className="text-xs">Kills</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-white">{teamStats.objectives?.tower?.kills || 0}</div>
                        <div className="text-xs">Towers</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-white">{teamStats.objectives?.inhibitor?.kills || 0}</div>
                        <div className="text-xs">Inhibs</div>
                      </div>
                    </div>
                  </div>
                  
                  {parties.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white border-opacity-20">
                      <span className="text-xs font-semibold text-gray-300">Parties:</span>
                      {parties.map((party, i) => (
                        <div key={i} className="text-xs text-gray-400">
                          Party {i + 1}: {party.map(p => p.riotIdGameName).join(', ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-gray-900 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-700">
                  <th
                    className={`text-left p-3 text-gray-200 cursor-pointer hover:bg-gray-600 transition-colors ${
                      sortConfigs[index]?.column === 'riotIdGameName' ? 'bg-gray-600' : ''
                    }`}
                    onClick={() => handleSort(index, 'riotIdGameName', (a, b) =>
                      a.riotIdGameName.localeCompare(b.riotIdGameName)
                    )}
                  >
                    Summoner Name
                    <span className="ml-2 text-blue-400">
                      {sortConfigs[index]?.column === 'riotIdGameName' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th
                    className={`text-left p-3 text-gray-200 cursor-pointer hover:bg-gray-600 transition-colors ${
                      sortConfigs[index]?.column === 'championName' ? 'bg-gray-600' : ''
                    }`}
                    onClick={() => handleSort(index, 'championName', (a, b) =>
                      a.championName.localeCompare(b.championName)
                    )}
                  >
                    Champion
                    <span className="ml-2 text-blue-400">
                      {sortConfigs[index]?.column === 'championName' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th
                    className={`text-left p-3 text-gray-200 cursor-pointer hover:bg-gray-600 transition-colors ${
                      sortConfigs[index]?.column === 'kda' ? 'bg-gray-600' : ''
                    }`}
                    onClick={() => handleSort(index, 'kda', (a, b) =>
                      (b.kills + b.assists - b.deaths) - (a.kills + a.assists - a.deaths)
                    )}
                  >
                    K/D/A
                    <span className="ml-2 text-blue-400">
                      {sortConfigs[index]?.column === 'kda' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th
                    className={`text-left p-3 text-gray-200 cursor-pointer hover:bg-gray-600 transition-colors ${
                      sortConfigs[index]?.column === 'damageDealt' ? 'bg-gray-600' : ''
                    }`}
                    onClick={() => handleSort(index, 'damageDealt', (a, b) =>
                      (b.totalDamageDealtToChampions || 0) - (a.totalDamageDealtToChampions || 0)
                    )}
                  >
                    Damage Dealt
                    <span className="ml-2 text-blue-400">
                      {sortConfigs[index]?.column === 'damageDealt' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th
                    className={`text-left p-3 text-gray-200 cursor-pointer hover:bg-gray-600 transition-colors ${
                      sortConfigs[index]?.column === 'healing' ? 'bg-gray-600' : ''
                    }`}
                    onClick={() => handleSort(index, 'healing', (a, b) =>
                      (b.totalHeal || 0) - (a.totalHeal || 0)
                    )}
                  >
                    Healing
                    <span className="ml-2 text-blue-400">
                      {sortConfigs[index]?.column === 'healing' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th
                    className={`text-left p-3 text-gray-200 cursor-pointer hover:bg-gray-600 transition-colors ${
                      sortConfigs[index]?.column === 'damageTaken' ? 'bg-gray-600' : ''
                    }`}
                    onClick={() => handleSort(index, 'damageTaken', (a, b) =>
                      (b.totalDamageTaken || 0) - (a.totalDamageTaken || 0)
                    )}
                  >
                    Damage Taken
                    <span className="ml-2 text-blue-400">
                      {sortConfigs[index]?.column === 'damageTaken' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th
                    className={`text-left p-3 text-gray-200 cursor-pointer hover:bg-gray-600 transition-colors ${
                      sortConfigs[index]?.column === 'ccTime' ? 'bg-gray-600' : ''
                    }`}
                    onClick={() => handleSort(index, 'ccTime', (a, b) =>
                      (b.totalTimeCCDealt || 0) - (a.totalTimeCCDealt || 0)
                    )}
                  >
                    CC Received
                    <span className="ml-2 text-blue-400">
                      {sortConfigs[index]?.column === 'ccTime' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th
                    className={`text-left p-3 text-gray-200 cursor-pointer hover:bg-gray-600 transition-colors ${
                      sortConfigs[index]?.column === 'ccingOthers' ? 'bg-gray-600' : ''
                    }`}
                    onClick={() => handleSort(index, 'ccingOthers', (a, b) =>
                      (b.timeCCingOthers || 0) - (a.timeCCingOthers || 0)
                    )}
                  >
                    CC Dealt
                    <span className="ml-2 text-blue-400">
                      {sortConfigs[index]?.column === 'ccingOthers' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th
                    className={`text-left p-3 text-gray-200 cursor-pointer hover:bg-gray-600 transition-colors ${
                      sortConfigs[index]?.column === 'effectiveness' ? 'bg-gray-600' : ''
                    }`}
                    onClick={() => handleSort(index, 'effectiveness', (a, b) =>
                      calculateEffectivenessScore(b) - calculateEffectivenessScore(a)
                    )}
                  >
                    Effectiveness
                    <span className="ml-2 text-blue-400">
                      {sortConfigs[index]?.column === 'effectiveness' && (
                        sortConfigs[index].direction === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {match.info.participants.map((participant, participantIndex) => (
                  <tr
                    key={participant.puuid}
                    className={`transition-colors hover:bg-gray-700 ${
                      isSearchedPlayer(participant)
                        ? `border-l-4 border-amber-400 ${
                            participant.teamId === 100
                              ? 'bg-blue-900'
                              : 'bg-red-900'
                          } bg-opacity-50 shadow-lg`
                        : participant.teamId === 100
                          ? 'bg-blue-900 bg-opacity-30'
                          : 'bg-red-900 bg-opacity-30'
                    } ${participantIndex % 2 === 0 ? 'bg-opacity-40' : ''}`}
                  >
                    <td className="p-3 border-b border-gray-700 text-white">
                      <span
                        className="hover:text-blue-400 cursor-pointer transition-colors"
                        onClick={() => handleSummonerClick(participant.riotIdGameName)}
                      >
                        {participant.riotIdGameName}
                      </span>
                    </td>
                    <td className="p-3 border-b border-gray-700 text-white font-medium">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${participant.championName.replace(/[^a-zA-Z0-9]/g, '')}.png`}
                          alt={participant.championName}
                          className="w-8 h-8 rounded-full object-cover border border-gray-600"
                          onError={(e) => {
                            // Fallback for champions with special characters or different naming
                            const target = e.target as HTMLImageElement;
                            target.src = `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${participant.championName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}.png`;
                          }}
                        />
                        <span>{participant.championName}</span>
                      </div>
                    </td>
                    <td className={`p-3 border-b border-gray-700 text-white ${
                      (participant.kills + participant.assists) / Math.max(1, participant.deaths) === getBestInColumn(match.info.participants, 'kda')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      <span className="text-green-400">{participant.kills || 0}</span>/
                      <span className="text-red-400">{participant.deaths || 0}</span>/
                      <span className="text-blue-400">{participant.assists || 0}</span>
                    </td>
                    <td className={`p-3 border-b border-gray-700 text-white ${
                      (participant.totalDamageDealtToChampions || 0) === getBestInColumn(match.info.participants, 'damageDealt')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {(participant.totalDamageDealtToChampions || 0).toLocaleString()}
                    </td>
                    <td className={`p-3 border-b border-gray-700 text-white ${
                      (participant.totalHeal || 0) === getBestInColumn(match.info.participants, 'healing')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {(participant.totalHeal || 0).toLocaleString()}
                    </td>
                    <td className={`p-3 border-b border-gray-700 text-white ${
                      (participant.totalDamageTaken || 0) === getBestInColumn(match.info.participants, 'damageTaken')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {(participant.totalDamageTaken || 0).toLocaleString()}
                    </td>
                    <td className={`p-3 border-b border-gray-700 text-white ${
                      participant.totalTimeCCDealt === getBestInColumn(match.info.participants, 'ccTime')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {(participant.totalTimeCCDealt || 0)}s
                    </td>
                    <td className={`p-3 border-b border-gray-700 text-white ${
                      participant.timeCCingOthers === getBestInColumn(match.info.participants, 'ccingOthers')
                        ? 'text-yellow-300 font-bold'
                        : ''
                    }`}>
                      {(participant.timeCCingOthers || 0)}s
                    </td>
                    <td className={`p-3 border-b border-gray-700 text-white ${
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
    </div>
  );
};

export default SummonerStatsPage;