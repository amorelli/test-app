import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const riotIdGameName = searchParams.get('riotIdGameName')
  const tagline = searchParams.get('tagline')
  const region = searchParams.get('region')
  const apiKey = process.env.API_KEY

  console.log('searchParams', searchParams)
  console.log({riotIdGameName, tagline, region})

  if (!riotIdGameName || !tagline || !region) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  try {
    // Check if summoner exists in database
    let summoner = await prisma.summoner.findUnique({
      where: {
        riotIdGameName_tagline: {
          riotIdGameName,
          tagline
        }
      }
    })

    // If not in database or data is old, fetch from API
    const shouldRefresh = !summoner || 
      (Date.now() - summoner.lastUpdated.getTime()) > 24 * 60 * 60 * 1000 // 24 hours

    if (shouldRefresh) {
      // Fetch from Riot API
      const accountResponse = await fetch(
        `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${riotIdGameName}/${tagline}?api_key=${apiKey}`
      )
      const accountData = await accountResponse.json()

      console.log('accountData', accountData)

      const summonerResponse = await fetch(
        `https://${getRegion(region)}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountData.puuid}?api_key=${apiKey}`
      )
      const summonerData = await summonerResponse.json()
      console.log('summonerData', summonerData)

      // Upsert summoner data
      summoner = await prisma.summoner.upsert({
        where: {
          puuid: accountData.puuid
        },
        update: {
          riotIdGameName: accountData.gameName,
          tagline: accountData.tagLine,
          region,
          summonerLevel: summonerData.summonerLevel,
          profileIconId: summonerData.profileIconId,
          lastUpdated: new Date()
        },
        create: {
          puuid: accountData.puuid,
          riotIdGameName: accountData.gameName,
          tagline: accountData.tagLine,
          region,
          summonerLevel: summonerData.summonerLevel,
          profileIconId: summonerData.profileIconId
        }
      })
    }

    return NextResponse.json({ 
      summoner,
      account: {
        puuid: summoner.puuid,
        gameName: summoner.riotIdGameName,
        tagLine: summoner.tagline
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch account data' }, { status: 500 })
  }
}

function getRegion(region: string): string {
  const regionMap: { [key: string]: string } = {
    'NA1': 'na1',
    'EUW1': 'euw1',
    'EUN1': 'eun1',
    'KR': 'kr',
  }
  return regionMap[region] || 'na1'
}