'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [searchName, setSearchName] = useState('');
  const [searchTagline, setSearchTagline] = useState('');
  const [searchRegion, setSearchRegion] = useState('na1');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchName.trim() && searchTagline.trim() && searchRegion.trim()) {
      // Save to recent searches
      const updatedSearches = [searchName, ...recentSearches.filter(name => name !== searchName)].slice(0, 10);
      setRecentSearches(updatedSearches);
      localStorage.setItem('lol-recent-searches', JSON.stringify(updatedSearches));
      
      // Navigate to the dynamic route
      router.push(`/lol/${searchRegion}/${encodeURIComponent(searchName)}/${encodeURIComponent(searchTagline)}`);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">League of Legends Stats</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Search for summoner statistics and match history</p>
      </div>

      <div className="w-full max-w-2xl">
        <form onSubmit={handleSearch} className="flex gap-2 flex-wrap justify-center">
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
      </div>
    </main>
  );
}
