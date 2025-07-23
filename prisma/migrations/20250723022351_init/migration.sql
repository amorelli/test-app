-- CreateTable
CREATE TABLE "summoners" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "puuid" TEXT NOT NULL,
    "riotIdGameName" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "summonerLevel" INTEGER NOT NULL,
    "profileIconId" INTEGER NOT NULL,
    "lastUpdated" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameMode" TEXT NOT NULL,
    "gameCreation" DATETIME NOT NULL,
    "gameDuration" INTEGER NOT NULL,
    "gameVersion" TEXT,
    "queueId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "match_participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "summonerId" TEXT NOT NULL,
    "championId" INTEGER NOT NULL,
    "championName" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "win" BOOLEAN NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "totalDamageDealtToChampions" INTEGER NOT NULL,
    "totalDamageTaken" INTEGER NOT NULL,
    "totalHeal" INTEGER NOT NULL,
    "goldEarned" INTEGER NOT NULL,
    "totalMinionsKilled" INTEGER NOT NULL,
    "neutralMinionsKilled" INTEGER NOT NULL,
    "visionScore" INTEGER,
    "timeCCingOthers" INTEGER,
    "totalTimeCCDealt" INTEGER,
    CONSTRAINT "match_participants_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "match_participants_summonerId_fkey" FOREIGN KEY ("summonerId") REFERENCES "summoners" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "match_teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "win" BOOLEAN NOT NULL,
    "baronKills" INTEGER NOT NULL,
    "dragonKills" INTEGER NOT NULL,
    "towerKills" INTEGER NOT NULL,
    "inhibitorKills" INTEGER NOT NULL,
    CONSTRAINT "match_teams_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "summoners_puuid_key" ON "summoners"("puuid");

-- CreateIndex
CREATE UNIQUE INDEX "summoners_riotIdGameName_tagline_key" ON "summoners"("riotIdGameName", "tagline");

-- CreateIndex
CREATE UNIQUE INDEX "match_participants_matchId_summonerId_key" ON "match_participants"("matchId", "summonerId");

-- CreateIndex
CREATE UNIQUE INDEX "match_teams_matchId_teamId_key" ON "match_teams"("matchId", "teamId");
