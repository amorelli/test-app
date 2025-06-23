export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const riotIdGameName = searchParams.get('riotIdGameName');
  const tagline = searchParams.get('tagline');
  const region = searchParams.get('region');
  const apiKey = process.env.API_KEY;

  console.log('searchParams', searchParams);

  console.log({riotIdGameName, tagline, region});

  if (!riotIdGameName || !tagline || !region) {
    return Response.json({ error: 'Summoner name and tagline and region are required' }, { status: 400 });
  }

  try {
    // First get account info using tagline
    const accountResponse = await fetch(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${riotIdGameName}/${tagline}?api_key=${apiKey}`
    );
    const accountData = await accountResponse.json();

    console.log('accountData', accountData);
    // Then get detailed summoner info using the PUUID
    const summonerResponse = await fetch(
      `https://${getRegion(region)}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountData.puuid}?api_key=${apiKey}`
    );
    const summonerData = await summonerResponse.json();
    console.log('summonerData', summonerData);

    return Response.json({ 
      account: accountData,
      summoner: summonerData 
    });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch account data' }, { status: 500 });
  }
}

// Helper function to map tagline to region
function getRegion(region: string): string {
  const regionMap: { [key: string]: string } = {
    'NA1': 'na1',
    'EUW1': 'euw1',
    'EUN1': 'eun1',
    'KR': 'kr',
    // Add more mappings as needed
  };
  return regionMap[region] || 'na1'; // Default to NA1 if unknown
}