export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const summonerName = searchParams.get('summonerName');
  const region = searchParams.get('region');
  const apiKey = process.env.API_KEY;

  if (!summonerName || !region) {
    return Response.json({ error: 'Summoner name and region are required' }, { status: 400 });
  }

  try {
    // First get account info
    const accountResponse = await fetch(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${summonerName}/${region}?api_key=${apiKey}`
    );
    const accountData = await accountResponse.json();

    // Then get detailed summoner info using the PUUID
    const summonerResponse = await fetch(
      `https://${region.toLowerCase()}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountData.puuid}?api_key=${apiKey}`
    );
    const summonerData = await summonerResponse.json();

    return Response.json({ 
      account: accountData,
      summoner: summonerData 
    });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch account data' }, { status: 500 });
  }
}