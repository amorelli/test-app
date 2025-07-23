# League of Legends Analytics - Database Implementation

This implementation adds PostgreSQL/SQLite database support with Prisma ORM to
store and cache League of Legends match data, providing better performance and
analytics capabilities.

## 🚀 What's Been Implemented

### Database Schema

-   **Summoners**: Store player information (PUUID, Riot ID, region, level,
    etc.)
-   **Matches**: Store match metadata (game mode, duration, creation time, etc.)
-   **Match Participants**: Store detailed player performance in each match
-   **Match Teams**: Store team-level statistics (objectives, wins/losses)

### API Enhancements

-   **Account API** (`/api/lol/account`): Now caches summoner data for 24 hours
-   **Matches API** (`/api/lol/matches`): Stores match data and serves cached
    results
-   **Stats API** (`/api/lol/stats/[summonerId]`): New endpoint for player
    analytics

### Key Features

-   **Data Caching**: Reduces API calls to Riot Games API
-   **Performance**: Faster response times for repeated requests
-   **Analytics**: Player statistics, win rates, champion performance
-   **Data Persistence**: Match history is stored permanently

## 📁 File Structure

```
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   ├── migrations/            # Database migration files
│   └── dev.db                 # SQLite database file (development)
├── lib/
│   └── prisma.ts             # Prisma client configuration
├── app/api/lol/
│   ├── account/route.tsx     # Enhanced account endpoint
│   ├── matches/route.tsx     # Enhanced matches endpoint
│   └── stats/[summonerId]/route.tsx  # New analytics endpoint
├── setup-database.sql        # PostgreSQL setup script
├── DATABASE_SETUP.md         # Database setup instructions
└── README_DATABASE_IMPLEMENTATION.md  # This file
```

## 🛠️ Setup Instructions

### Quick Start (SQLite - Development)

The project is currently configured for SQLite for easy development:

1. **Database is already set up** - The migration has been run and `dev.db`
   exists
2. **Start the development server**:
    ```bash
    npm run dev
    ```
3. **Test the endpoints** (see examples below)

### Production Setup (PostgreSQL)

For production, follow the instructions in `DATABASE_SETUP.md` to set up
PostgreSQL.

## 🔧 API Usage Examples

### 1. Get Account Information

```bash
GET /api/lol/account?riotIdGameName=YourName&tagline=NA1&region=NA1
```

**Response:**

```json
{
    "summoner": {
        "id": "clm1234567890",
        "puuid": "abc123...",
        "riotIdGameName": "YourName",
        "tagline": "NA1",
        "region": "NA1",
        "summonerLevel": 150,
        "profileIconId": 1234,
        "lastUpdated": "2025-01-23T02:24:00.000Z",
        "createdAt": "2025-01-23T02:24:00.000Z"
    },
    "account": {
        "puuid": "abc123...",
        "gameName": "YourName",
        "tagLine": "NA1"
    }
}
```

### 2. Get Match History

```bash
GET /api/lol/matches?puuid=YOUR_PUUID&region=na1
```

**Response:** Array of match objects with participant and team data

### 3. Get Player Statistics

```bash
GET /api/lol/stats/SUMMONER_ID
```

**Response:**

```json
{
    "totalGames": 25,
    "winRate": 64.0,
    "averageStats": {
        "kills": 8.5,
        "deaths": 5.2,
        "assists": 12.3,
        "kda": 4.0,
        "damage": 25000,
        "gold": 12500,
        "visionScore": 18.5
    },
    "topChampions": [
        {
            "name": "Jinx",
            "games": 8,
            "avgKills": 9.2,
            "avgDeaths": 4.8,
            "avgAssists": 11.5
        }
    ]
}
```

## 🎯 Key Benefits

### Performance Improvements

-   **Reduced API Calls**: Data is cached, reducing load on Riot API
-   **Faster Response Times**: Database queries are faster than external API
    calls
-   **Rate Limit Protection**: Less likely to hit Riot API rate limits

### Analytics Capabilities

-   **Player Statistics**: KDA, win rate, damage, gold, vision score
-   **Champion Performance**: Most played champions with statistics
-   **Historical Data**: All match data is preserved for analysis
-   **Aggregated Insights**: Database enables complex queries and analytics

### Data Management

-   **Automatic Updates**: Summoner data refreshes every 24 hours
-   **Match Deduplication**: Prevents storing duplicate match data
-   **Relationship Integrity**: Foreign key constraints ensure data consistency
-   **Scalable Design**: Schema supports additional features and data types

## 🔍 Database Schema Details

### Summoners Table

-   Stores player account information
-   Unique constraints on PUUID and Riot ID + tagline
-   Tracks last update time for cache invalidation

### Matches Table

-   Stores match metadata using Riot match ID as primary key
-   Includes game mode, duration, creation time, version, queue ID

### Match Participants Table

-   Links summoners to matches with detailed performance data
-   Stores kills, deaths, assists, damage, gold, vision score, CC time
-   Unique constraint prevents duplicate participant records

### Match Teams Table

-   Stores team-level statistics for each match
-   Tracks objectives (baron, dragon, tower, inhibitor kills)
-   Links to matches with team ID and win/loss status

## 🚀 Future Enhancements

The database structure supports easy addition of:

-   **Items and Builds**: Track item purchases and build paths
-   **Runes and Summoner Spells**: Store rune configurations
-   **Timeline Data**: Detailed match timeline events
-   **Ranked Information**: LP, tier, division tracking
-   **Champion Mastery**: Champion mastery scores and progression
-   **Custom Analytics**: Win rate by champion, role, time of day, etc.

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**: Ensure database is running and connection
   string is correct
2. **Migration Errors**: Check database permissions and schema conflicts
3. **API Errors**: Verify Riot API key is valid and not rate limited

### Development Tools

-   **Prisma Studio**: `npx prisma studio` - Visual database browser
-   **Reset Database**: `npx prisma migrate reset` - Reset and re-run migrations
-   **Generate Client**: `npx prisma generate` - Regenerate Prisma client after
    schema changes

## 📊 Monitoring

The implementation includes error logging and can be extended with:

-   Database query performance monitoring
-   API response time tracking
-   Cache hit/miss ratios
-   Data freshness metrics

---

The database implementation provides a solid foundation for a comprehensive
League of Legends analytics platform with room for extensive future
enhancements.
