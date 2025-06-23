export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const puuid = searchParams.get('puuid');
  const region = searchParams.get('region');
  const apiKey = process.env.API_KEY;

  if (!puuid || !region) {
    return Response.json({ error: 'PUUID and region are required' }, { status: 400 });
  }

  const routingValue = getRoutingValue(region.toLowerCase());

  try {
    // Get last 10 match IDs
    const matchIdsResponse = await fetch(
      `https://${routingValue}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10&api_key=${apiKey}`
    );
    const matchIds = await matchIdsResponse.json();

    if (!matchIds.length) {
      return Response.json({ matches: [] });
    }

    // Fetch details for all matches in parallel
    const matchDetailsPromises = matchIds.map(matchId => 
      fetch(`https://${routingValue}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${apiKey}`)
        .then(res => res.json())
    );

    const matchDetails = await Promise.all(matchDetailsPromises);
    return Response.json({ matches: matchDetails });

  } catch (error) {
    console.error('Error fetching matches:', error);
    return Response.json({ error: 'Failed to fetch match history' }, { status: 500 });
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
  };
  
  return routingMap[region] || 'americas';
}