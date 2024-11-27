export async function GET() {
  const apiKey = process.env.API_KEY;
  const myPuuid = process.env.MY_PUUID;

  const response = await fetch(`https://na1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${myPuuid}?api_key=${apiKey}`, {
    headers: {
    },
  });

  const data = await response.json()

 
  return Response.json({ data })
}