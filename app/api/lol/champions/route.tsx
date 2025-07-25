import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

// Riot Data Dragon API endpoints
const DATA_DRAGON_BASE = 'https://ddragon.leagueoflegends.com';

async function getLatestVersion() {
  const response = await fetch(`${DATA_DRAGON_BASE}/api/versions.json`);
  const versions = await response.json();
  return versions[0]; // Latest version
}

async function downloadImage(url: string, filename: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const publicDir = path.join(process.cwd(), 'public', 'champions');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    const filePath = path.join(publicDir, filename);
    fs.writeFileSync(filePath, new Uint8Array(buffer));
    
    return `/champions/${filename}`;
  } catch (error) {
    console.error(`Error downloading image ${url}:`, error);
    return '';
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceUpdate = searchParams.get('forceUpdate') === 'true';
    
    // Check if we already have champions in the database
    const existingChampions = await prisma.champion.count();
    if (existingChampions > 0 && !forceUpdate) {
      const champions = await prisma.champion.findMany({
        orderBy: { name: 'asc' }
      });
      return NextResponse.json({ 
        success: true, 
        champions,
        message: 'Champions loaded from database'
      });
    }
    
    // Get the latest Data Dragon version
    const version = await getLatestVersion();
    console.log(`Using Data Dragon version: ${version}`);
    
    // Fetch champion data
    const championsResponse = await fetch(
      `${DATA_DRAGON_BASE}/cdn/${version}/data/en_US/champion.json`
    );
    
    if (!championsResponse.ok) {
      throw new Error('Failed to fetch champion data from Data Dragon');
    }
    
    const championsData = await championsResponse.json();
    const champions = Object.values(championsData.data) as any[];
    
    console.log(`Found ${champions.length} champions to process`);
    
    // Process champions in batches to avoid overwhelming the API
    const batchSize = 10;
    const processedChampions = [];
    
    for (let i = 0; i < champions.length; i += batchSize) {
      const batch = champions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (champion: any) => {
        try {
          // Download champion thumbnail
          const thumbnailUrl = `${DATA_DRAGON_BASE}/cdn/${version}/img/champion/${champion.image.full}`;
          const thumbnailFilename = `${champion.key.toLowerCase()}.png`;
          const localThumbnailPath = await downloadImage(thumbnailUrl, thumbnailFilename);
          
          // Download champion splash art (optional)
          const splashUrl = `${DATA_DRAGON_BASE}/cdn/img/champion/splash/${champion.key}_0.jpg`;
          const splashFilename = `${champion.key.toLowerCase()}_splash.jpg`;
          const localSplashPath = await downloadImage(splashUrl, splashFilename);
          
          // Upsert champion data
          const championData = await prisma.champion.upsert({
            where: { id: parseInt(champion.key) },
            update: {
              name: champion.name,
              key: champion.id,
              title: champion.title,
              thumbnailUrl: localThumbnailPath,
              splashUrl: localSplashPath,
              version: version,
            },
            create: {
              id: parseInt(champion.key),
              name: champion.name,
              key: champion.id,
              title: champion.title,
              thumbnailUrl: localThumbnailPath,
              splashUrl: localSplashPath,
              version: version,
            },
          });
          
          console.log(`Processed champion: ${champion.name}`);
          return championData;
        } catch (error) {
          console.error(`Error processing champion ${champion.name}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      processedChampions.push(...batchResults.filter(Boolean));
      
      // Small delay between batches to be respectful to the API
      if (i + batchSize < champions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Successfully processed ${processedChampions.length} champions`);
    
    return NextResponse.json({
      success: true,
      champions: processedChampions,
      message: `Successfully updated ${processedChampions.length} champions`,
      version: version
    });
    
  } catch (error) {
    console.error('Error in champions API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch or update champion data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { championId } = body;
    
    if (!championId) {
      return NextResponse.json(
        { success: false, error: 'Champion ID is required' },
        { status: 400 }
      );
    }
    
    const champion = await prisma.champion.findUnique({
      where: { id: championId }
    });
    
    if (!champion) {
      return NextResponse.json(
        { success: false, error: 'Champion not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      champion
    });
    
  } catch (error) {
    console.error('Error in champions POST API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch champion data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}