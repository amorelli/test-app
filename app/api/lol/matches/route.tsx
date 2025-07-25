import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const puuid = searchParams.get('puuid')
  const region = searchParams.get('region')
  const apiKey = process.env.API_KEY

  console.log('🔍 [MATCHES API] Request received:', { puuid, region, hasApiKey: !!apiKey })

  if (!puuid || !region) {
    console.log('❌ [MATCHES API] Missing required parameters')
    return NextResponse.json({ error: 'PUUID and region are required' }, { status: 400 })
  }

  if (!apiKey) {
    console.log('❌ [MATCHES API] Missing API_KEY environment variable')
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  try {
    console.log('🔍 [MATCHES API] Starting database lookup for summoner')
    // First, get summoner from database
    const summoner = await prisma.summoner.findUnique({
      where: { puuid }
    })

    console.log('🔍 [MATCHES API] Summoner lookup result:', { found: !!summoner, summonerId: summoner?.id })

    if (!summoner) {
      console.log('❌ [MATCHES API] Summoner not found in database')
      return NextResponse.json({ error: 'Summoner not found. Please search for the summoner first to add them to the database.' }, { status: 404 })
    }

    // Check if we have recent match data - get matches where this summoner participated
    console.log('🔍 [MATCHES API] Checking for recent match data')
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

    console.log('🔍 [MATCHES API] Recent match participants found:', recentMatchParticipants.length)

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
    console.log('🔍 [MATCHES API] Fetching new data from Riot API')
    const routingValue = getRoutingValue(region.toLowerCase())
    console.log('🔍 [MATCHES API] Using routing value:', routingValue)
    
    const matchIdsUrl = `https://${routingValue}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${apiKey}`
    console.log('🔍 [MATCHES API] Fetching match IDs from:', matchIdsUrl.replace(apiKey, '[API_KEY_HIDDEN]'))
    
    const matchIdsResponse = await fetch(matchIdsUrl)
    console.log('🔍 [MATCHES API] Match IDs response status:', matchIdsResponse.status)
    
    if (!matchIdsResponse.ok) {
      const errorText = await matchIdsResponse.text()
      console.log('❌ [MATCHES API] Match IDs fetch failed:', { status: matchIdsResponse.status, error: errorText })
      return NextResponse.json({
        error: `Failed to fetch match IDs from Riot API: ${matchIdsResponse.status} - ${errorText}`
      }, { status: 500 })
    }
    
    const matchIds = await matchIdsResponse.json()
    console.log('🔍 [MATCHES API] Match IDs received:', matchIds.length)

    if (!matchIds.length) {
      console.log('🔍 [MATCHES API] No match IDs found, returning empty array')
      return NextResponse.json({ matches: [] })
    }

    // Fetch and store match details
    console.log('🔍 [MATCHES API] Processing match details for', matchIds.length, 'matches')
    const matchDetailsPromises = matchIds.map(async (matchId: string, index: number) => {
      console.log(`🔍 [MATCHES API] Processing match ${index + 1}/${matchIds.length}: ${matchId}`)
      
      try {
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
          console.log(`✅ [MATCHES API] Match ${matchId} found in database`)
          return existingMatch
        }

        // Fetch from API and store
        console.log(`🔍 [MATCHES API] Fetching match ${matchId} from Riot API`)
        const matchUrl = `https://${routingValue}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${apiKey}`
        const response = await fetch(matchUrl)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.log(`❌ [MATCHES API] Failed to fetch match ${matchId}:`, { status: response.status, error: errorText })
          
          // Handle rate limiting gracefully
          if (response.status === 429) {
            console.log(`⏳ [MATCHES API] Rate limited, skipping match ${matchId}`)
            return null // Skip this match instead of failing entirely
          }
          
          throw new Error(`Failed to fetch match ${matchId}: ${response.status} - ${errorText}`)
        }
        
        const matchData = await response.json()
        console.log(`🔍 [MATCHES API] Storing match ${matchId} in database`)

        return await storeMatchData(matchData)
      } catch (error) {
        console.log(`❌ [MATCHES API] Error processing match ${matchId}:`, error)
        // Return null for failed matches instead of crashing the entire request
        return null
      }
    })

    console.log('🔍 [MATCHES API] Waiting for all match details to complete')
    const matches = await Promise.all(matchDetailsPromises)
    
    // Filter out null values from failed matches
    const validMatches = matches.filter(match => match !== null)
    console.log('🔍 [MATCHES API] Valid matches retrieved:', validMatches.length, 'out of', matches.length)
    
    console.log('🔍 [MATCHES API] Formatting matches for frontend')
    const formattedMatches = validMatches.map(formatSingleMatchForFrontend)

    console.log('✅ [MATCHES API] Successfully returning', formattedMatches.length, 'matches')
    return NextResponse.json({ matches: formattedMatches })
  } catch (error) {
    console.error('❌ [MATCHES API] Error fetching matches:', error)
    console.error('❌ [MATCHES API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({
      error: 'Failed to fetch match history',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

async function storeMatchData(matchData: any) {
  console.log('🔍 [STORE MATCH] Starting database transaction for match:', matchData.metadata.matchId)
  
  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      console.log('🔍 [STORE MATCH] Creating/updating match record')
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
      console.log('🔍 [STORE MATCH] Processing', matchData.info.participants.length, 'participants')
      for (const participant of matchData.info.participants) {
        console.log('🔍 [STORE MATCH] Processing participant:', participant.riotIdGameName, participant.puuid)
        
        // Ensure summoner exists
        let summoner = await tx.summoner.findUnique({
          where: { puuid: participant.puuid }
        })

        if (!summoner) {
          console.log('🔍 [STORE MATCH] Creating new summoner:', participant.riotIdGameName)
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
      console.log('🔍 [STORE MATCH] Processing', matchData.info.teams.length, 'teams')
      for (const team of matchData.info.teams) {
        console.log('🔍 [STORE MATCH] Processing team:', team.teamId, 'win:', team.win)
        
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

      console.log('🔍 [STORE MATCH] Retrieving complete match data')
      const completeMatch = await tx.match.findUnique({
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
      
      console.log('✅ [STORE MATCH] Transaction completed successfully for match:', match.id)
      return completeMatch
    })
  } catch (error) {
    console.error('❌ [STORE MATCH] Database transaction failed:', error)
    throw error
  }
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