import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { summonerId: string } }
) {
  try {
    const summonerId = params.summonerId

    // Get basic stats
    const stats = await prisma.matchParticipant.aggregate({
      where: { summonerId },
      _avg: {
        kills: true,
        deaths: true,
        assists: true,
        totalDamageDealtToChampions: true,
        goldEarned: true,
        visionScore: true
      },
      _count: {
        id: true
      }
    })

    // Get win rate
    const winStats = await prisma.matchParticipant.groupBy({
      by: ['win'],
      where: { summonerId },
      _count: {
        id: true
      }
    })

    const totalGames = stats._count.id
    const wins = winStats.find((stat: any) => stat.win)?._count.id || 0
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0

    // Get champion performance
    const championStats = await prisma.matchParticipant.groupBy({
      by: ['championName'],
      where: { summonerId },
      _count: {
        id: true
      },
      _avg: {
        kills: true,
        deaths: true,
        assists: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    })

    return NextResponse.json({
      totalGames,
      winRate: Math.round(winRate * 100) / 100,
      averageStats: {
        kills: Math.round((stats._avg.kills || 0) * 100) / 100,
        deaths: Math.round((stats._avg.deaths || 0) * 100) / 100,
        assists: Math.round((stats._avg.assists || 0) * 100) / 100,
        kda: stats._avg.deaths ? 
          Math.round(((stats._avg.kills || 0) + (stats._avg.assists || 0)) / stats._avg.deaths * 100) / 100 : 
          'Perfect',
        damage: Math.round(stats._avg.totalDamageDealtToChampions || 0),
        gold: Math.round(stats._avg.goldEarned || 0),
        visionScore: Math.round((stats._avg.visionScore || 0) * 100) / 100
      },
      topChampions: championStats.map((champ: any) => ({
        name: champ.championName,
        games: champ._count.id,
        avgKills: Math.round((champ._avg.kills || 0) * 100) / 100,
        avgDeaths: Math.round((champ._avg.deaths || 0) * 100) / 100,
        avgAssists: Math.round((champ._avg.assists || 0) * 100) / 100
      }))
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}