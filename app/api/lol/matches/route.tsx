import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const puuid = searchParams.get('puuid')
  const region = searchParams.get('region')
  const apiKey = process.env.API_KEY

  if (!puuid || !region) {
    return NextResponse.json({ error: 'PUUID and region are required' }, { status: 400 })
  }

  try {
    // First, get summoner from database
    const summoner = await prisma.summoner.findUnique({
      where: { puuid }
    })

    if (!summoner) {
      return NextResponse.json({ error: 'Summoner not found' }, { status: 404 })
    }

    // Check if we have recent match data - get matches where this summoner participated
    const recentMatchParticipants = await prisma.matchParticipant.findMany({
      where: { summonerId: summoner.id },
      select: { matchId: true },
      orderBy: {
        match: {
          gameCreation: 'desc'
        }
      },
      take: 10
    })

    if (recentMatchParticipants.length > 0) {
      // Get full match data with all participants
      const recentMatches = await prisma.match.findMany({
        where: {
          id: {
            in: recentMatchParticipants.map((p: any) => p.matchId)
          }
        },
        include: {
          participants: {
            include: {
              summoner: true
            }
          },
          teams: true
        },
        orderBy: {
          gameCreation: 'desc'
        }
      })

      // If we have recent data (less than 1 hour old), return it
      const hasRecentData = recentMatches.length > 0 &&
        (Date.now() - recentMatches[0].createdAt.getTime()) < 60 * 60 * 1000

      if (hasRecentData) {
        const formattedMatches = recentMatches.map(formatSingleMatchForFrontend)
        return NextResponse.json({ matches: formattedMatches })
      }
    }

    // Otherwise, fetch new data from API
    const routingValue = getRoutingValue(region.toLowerCase())
    
    const matchIdsResponse = await fetch(
      `https://${routingValue}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${apiKey}`
    )
    const matchIds = await matchIdsResponse.json()

    if (!matchIds.length) {
      return NextResponse.json({ matches: [] })
    }

    // Fetch and store match details
    const matchDetailsPromises = matchIds.map(async (matchId: string) => {
      // Check if match already exists
      const existingMatch = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          participants: {
            include: {
              summoner: true
            }
          },
          teams: true
        }
      })

      if (existingMatch) {
        return existingMatch
      }

      // Fetch from API and store
      const response = await fetch(
        `https://${routingValue}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${apiKey}`
      )
      const matchData = await response.json()

      return await storeMatchData(matchData)
    })

    const matches = await Promise.all(matchDetailsPromises)
    const formattedMatches = matches.map(formatSingleMatchForFrontend)

    return NextResponse.json({ matches: formattedMatches })
  } catch (error) {
    console.error('Error fetching matches:', error)
    return NextResponse.json({ error: 'Failed to fetch match history' }, { status: 500 })
  }
}

async function storeMatchData(matchData: any) {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create match with upsert to handle duplicates
    const match = await tx.match.upsert({
      where: { id: matchData.metadata.matchId },
      update: {
        gameMode: matchData.info.gameMode,
        gameCreation: new Date(matchData.info.gameCreation),
        gameDuration: matchData.info.gameDuration,
        gameVersion: matchData.info.gameVersion,
        queueId: matchData.info.queueId
      },
      create: {
        id: matchData.metadata.matchId,
        gameMode: matchData.info.gameMode,
        gameCreation: new Date(matchData.info.gameCreation),
        gameDuration: matchData.info.gameDuration,
        gameVersion: matchData.info.gameVersion,
        queueId: matchData.info.queueId
      }
    })

    // Create participants
    for (const participant of matchData.info.participants) {
      // Ensure summoner exists
      let summoner = await tx.summoner.findUnique({
        where: { puuid: participant.puuid }
      })

      if (!summoner) {
        summoner = await tx.summoner.create({
          data: {
            puuid: participant.puuid,
            riotIdGameName: participant.riotIdGameName || 'Unknown',
            tagline: participant.riotIdTagline || 'Unknown',
            region: 'Unknown',
            summonerLevel: 1,
            profileIconId: 0
          }
        })
      }

      // Use upsert for participants to handle duplicates
      await tx.matchParticipant.upsert({
        where: {
          matchId_summonerId: {
            matchId: match.id,
            summonerId: summoner.id
          }
        },
        update: {
          championId: participant.championId,
          championName: participant.championName,
          teamId: participant.teamId,
          win: participant.win,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
          totalDamageTaken: participant.totalDamageTaken,
          totalHeal: participant.totalHeal,
          goldEarned: participant.goldEarned,
          totalMinionsKilled: participant.totalMinionsKilled,
          neutralMinionsKilled: participant.neutralMinionsKilled,
          visionScore: participant.visionScore,
          timeCCingOthers: participant.timeCCingOthers,
          totalTimeCCDealt: participant.totalTimeCCDealt
        },
        create: {
          matchId: match.id,
          summonerId: summoner.id,
          championId: participant.championId,
          championName: participant.championName,
          teamId: participant.teamId,
          win: participant.win,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
          totalDamageTaken: participant.totalDamageTaken,
          totalHeal: participant.totalHeal,
          goldEarned: participant.goldEarned,
          totalMinionsKilled: participant.totalMinionsKilled,
          neutralMinionsKilled: participant.neutralMinionsKilled,
          visionScore: participant.visionScore,
          timeCCingOthers: participant.timeCCingOthers,
          totalTimeCCDealt: participant.totalTimeCCDealt
        }
      })
    }

    // Create teams
    for (const team of matchData.info.teams) {
      // Use upsert for teams to handle duplicates
      await tx.matchTeam.upsert({
        where: {
          matchId_teamId: {
            matchId: match.id,
            teamId: team.teamId
          }
        },
        update: {
          win: team.win,
          baronKills: team.objectives.baron.kills,
          dragonKills: team.objectives.dragon.kills,
          towerKills: team.objectives.tower.kills,
          inhibitorKills: team.objectives.inhibitor.kills
        },
        create: {
          matchId: match.id,
          teamId: team.teamId,
          win: team.win,
          baronKills: team.objectives.baron.kills,
          dragonKills: team.objectives.dragon.kills,
          towerKills: team.objectives.tower.kills,
          inhibitorKills: team.objectives.inhibitor.kills
        }
      })
    }

    return await tx.match.findUnique({
      where: { id: match.id },
      include: {
        participants: {
          include: {
            summoner: true
          }
        },
        teams: true
      }
    })
  })
}

function formatMatchesForFrontend(matchParticipants: any[]) {
  // Group by match and format for frontend
  const matchesMap = new Map()
  
  matchParticipants.forEach(participant => {
    const matchId = participant.match.id
    if (!matchesMap.has(matchId)) {
      matchesMap.set(matchId, {
        metadata: { matchId },
        info: {
          gameCreation: participant.match.gameCreation.getTime(),
          gameDuration: participant.match.gameDuration,
          gameMode: participant.match.gameMode,
          gameType: 'MATCHED_GAME', // Add missing gameType property
          gameId: matchId, // Add missing gameId property
          participants: [],
          teams: participant.match.teams.map((team: any) => ({
            teamId: team.teamId,
            win: team.win,
            objectives: {
              baron: { kills: team.baronKills },
              dragon: { kills: team.dragonKills },
              tower: { kills: team.towerKills },
              inhibitor: { kills: team.inhibitorKills },
              champion: { kills: 0 } // Add missing champion kills
            }
          }))
        }
      })
    }
    
    const match = matchesMap.get(matchId)
    // Check if summoner exists before accessing its properties
    if (participant.summoner) {
      match.info.participants.push({
        puuid: participant.summoner.puuid,
        riotIdGameName: participant.summoner.riotIdGameName,
        championId: participant.championId,
        championName: participant.championName,
        teamId: participant.teamId,
        win: participant.win,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
        totalDamageTaken: participant.totalDamageTaken,
        totalHeal: participant.totalHeal,
        timeCCingOthers: participant.timeCCingOthers,
        totalTimeCCDealt: participant.totalTimeCCDealt
      })
    }
  })
  
  return Array.from(matchesMap.values())
}

function formatSingleMatchForFrontend(match: any) {
  return {
    metadata: { matchId: match.id },
    info: {
      gameCreation: match.gameCreation.getTime(),
      gameDuration: match.gameDuration,
      gameMode: match.gameMode,
      gameType: 'MATCHED_GAME', // Add missing gameType property
      gameId: match.id, // Add missing gameId property
      participants: match.participants.filter((p: any) => p.summoner).map((p: any) => ({
        puuid: p.summoner.puuid,
        riotIdGameName: p.summoner.riotIdGameName,
        championId: p.championId,
        championName: p.championName,
        teamId: p.teamId,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        totalDamageDealtToChampions: p.totalDamageDealtToChampions,
        totalDamageTaken: p.totalDamageTaken,
        totalHeal: p.totalHeal,
        timeCCingOthers: p.timeCCingOthers,
        totalTimeCCDealt: p.totalTimeCCDealt
      })),
      teams: match.teams.map((team: any) => ({
        teamId: team.teamId,
        win: team.win,
        objectives: {
          baron: { kills: team.baronKills },
          dragon: { kills: team.dragonKills },
          tower: { kills: team.towerKills },
          inhibitor: { kills: team.inhibitorKills },
          champion: { kills: 0 } // Add missing champion kills
        }
      }))
    }
  }
}

function getRoutingValue(region: string): string {
  const routingMap: { [key: string]: string } = {
    na1: 'americas',
    br1: 'americas',
    la1: 'americas',
    la2: 'americas',
    euw1: 'europe',
    eun1: 'europe',
    tr1: 'europe',
    ru: 'europe',
    kr: 'asia',
    jp1: 'asia'
  }
  
  return routingMap[region] || 'americas'
}