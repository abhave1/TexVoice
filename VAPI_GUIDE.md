# Vapi Integration Guide

Complete guide to using the Vapi API integration in Tex Intel API.

## Table of Contents
1. [Setup](#setup)
2. [Managing Tools](#managing-tools)
3. [Accessing Call Logs](#accessing-call-logs)
4. [Billing & Analytics](#billing--analytics)
5. [Admin API Endpoints](#admin-api-endpoints)
6. [Configuration as Code](#configuration-as-code)

---

## Setup

### 1. Get Your Vapi API Key
1. Go to https://dashboard.vapi.ai/api-keys
2. Create a **Secret Key** (or copy existing one)
3. Add to `.env`:

```bash
cp .env.example .env
# Edit .env and set:
VAPI_API_KEY=sk_live_your_actual_key_here
```

### 2. Verify Connection
```bash
npm run dev

# In another terminal:
curl http://localhost:3000/admin/health
```

Expected response:
```json
{
  "status": "ok",
  "vapiApiConnected": true,
  "timestamp": "2025-12-30T..."
}
```

---

## Managing Tools

### Define Tools in Code

Edit `src/config/vapi-config.ts`:

```typescript
export const VAPI_TOOLS: VapiTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_inventory',
      description: 'Check equipment availability',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Equipment type to search'
          }
        },
        required: ['query']
      }
    },
    server: {
      url: `${getServerUrl()}/tools`
    }
  }
  // Add more tools here
];
```

### Sync Tools to Vapi

```bash
# Sync all tools defined in vapi-config.ts to Vapi cloud
npm run vapi:sync
```

Output:
```
╔═══════════════════════════════════════════════╗
║      Vapi Configuration Sync Tool             ║
╚═══════════════════════════════════════════════╝

🔄 Syncing tools to Vapi...

📦 Processing tool: check_inventory
   + Creating new tool
   ✅ Created successfully (ID: tool_abc123)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Sync Summary:
   Total tools: 1
   Created: 1
   Updated: 0
   Errors: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Sync completed successfully!
```

### View Tools via API

```bash
# List all tools
curl http://localhost:3000/admin/tools

# Sync via API
curl -X POST http://localhost:3000/admin/tools/sync
```

---

## Accessing Call Logs

### CLI Scripts

```bash
# Get last 10 calls
npm run vapi:calls

# Get last 20 calls
npm run vapi:calls:20

# Or specify any number
tsx scripts/get-calls.ts 50
```

Output:
```
📞 Fetching last 10 calls...

Found 3 calls:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 Call ID: call_abc123
   Type: inboundPhoneCall
   Status: ended
   Date: 12/30/2025, 10:15:00 AM
   Duration: 120s
   Cost: $0.0450
   Phone: +14805551234
   Transcript: Hi Abhave, welcome back to Tex Intel...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total calls: 3
Total cost: $0.1350
```

### Via API

```bash
# List recent calls
curl http://localhost:3000/admin/calls?limit=10

# Get specific call
curl http://localhost:3000/admin/calls/call_abc123

# Get transcript only
curl http://localhost:3000/admin/calls/call_abc123/transcript
```

Response:
```json
{
  "results": [
    {
      "id": "call_abc123",
      "type": "inboundPhoneCall",
      "status": "ended",
      "phoneNumber": "+14805551234",
      "cost": 0.045,
      "transcript": "Full conversation transcript here...",
      "messages": [...],
      "costBreakdown": {
        "transport": 0.01,
        "stt": 0.005,
        "llm": 0.02,
        "tts": 0.01,
        "total": 0.045
      }
    }
  ],
  "count": 3
}
```

---

## Billing & Analytics

### Get Cost Data

```bash
# Get billing for all calls
curl http://localhost:3000/admin/billing

# Filter by date range
curl "http://localhost:3000/admin/billing?startDate=2025-12-01&endDate=2025-12-31"
```

Response:
```json
{
  "totalCost": 12.45,
  "callCount": 150,
  "calls": [
    {
      "id": "call_abc123",
      "createdAt": "2025-12-30T10:15:00Z",
      "duration": 120,
      "cost": 0.045,
      "costBreakdown": {
        "transport": 0.01,
        "stt": 0.005,
        "llm": 0.02,
        "tts": 0.01,
        "vapi": 0.005,
        "total": 0.045,
        "llmPromptTokens": 150,
        "llmCompletionTokens": 80,
        "ttsCharacters": 200
      }
    }
  ]
}
```

### Analytics Queries

```bash
# Get calls for specific date range
curl "http://localhost:3000/admin/calls?createdAtGt=2025-12-01T00:00:00Z&createdAtLt=2025-12-31T23:59:59Z"

# Get billing for December
curl "http://localhost:3000/admin/billing?startDate=2025-12-01&endDate=2025-12-31&limit=1000"
```

---

## Admin API Endpoints

### Call Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/calls` | GET | List calls with pagination |
| `/admin/calls/:callId` | GET | Get specific call details |
| `/admin/calls/:callId/transcript` | GET | Get call transcript |

**Query Parameters**:
- `limit` - Number of results (default: 50)
- `createdAtGt` - Created after date (ISO 8601)
- `createdAtLt` - Created before date (ISO 8601)

### Billing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/billing` | GET | Get cost data for calls |

**Query Parameters**:
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)
- `limit` - Number of calls to include

### Tools Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/tools` | GET | List all tools |
| `/admin/tools/sync` | POST | Sync local config to Vapi |

### Assistants

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/assistants` | GET | List all assistants |
| `/admin/assistants/:id` | PATCH | Update assistant config |

### Phone Numbers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/phone-numbers` | GET | List all phone numbers |

### Health Check

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/health` | GET | Check Vapi API connectivity |

---

## Configuration as Code

### Tool Definitions

All tools are defined in `src/config/vapi-config.ts`:

```typescript
export const VAPI_TOOLS: VapiTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_inventory',
      description: '...',
      parameters: { ... }
    },
    server: {
      url: `${getServerUrl()}/tools`
    }
  }
];
```

### Assistant Configurations

```typescript
export const VAPI_ASSISTANTS = {
  default: {
    name: 'Tex - Default Receptionist',
    model: {
      provider: 'groq',
      model: 'llama-3.1-8b-instant'
    },
    firstMessage: 'Thanks for calling...'
  },
  vip: {
    name: 'Tex - VIP Receptionist',
    // ... VIP-specific config
  }
};
```

### Workflow

1. **Edit config** in `src/config/vapi-config.ts`
2. **Sync to Vapi**: `npm run vapi:sync`
3. **Done!** No dashboard needed.

---

## Use Cases

### 1. Monitor Call Activity

```bash
# Check recent calls every hour
npm run vapi:calls > logs/calls-$(date +%Y%m%d-%H%M%S).txt
```

### 2. Calculate Monthly Costs

```bash
# Get December billing
curl "http://localhost:3000/admin/billing?startDate=2025-12-01&endDate=2025-12-31" \
  | jq '.totalCost'
```

### 3. Find Expensive Calls

```bash
# Find calls over $1
curl http://localhost:3000/admin/calls?limit=1000 \
  | jq '.results[] | select(.cost > 1.0)'
```

### 4. Track Tool Usage

```bash
# Get calls and check which tools were used
curl http://localhost:3000/admin/calls \
  | jq '.results[].messages[] | select(.role == "function")'
```

### 5. Deploy Updates Without Dashboard

```bash
# 1. Update tool in code
vim src/config/vapi-config.ts

# 2. Sync
npm run vapi:sync

# Done! Tool updated in Vapi
```

---

## Troubleshooting

### "VAPI_API_KEY not found"
- Make sure `.env` file exists
- Check that `VAPI_API_KEY=sk_live_...` is set
- Restart server after updating `.env`

### "Vapi API Error (401)"
- Invalid API key
- Get new key from https://dashboard.vapi.ai/api-keys

### "Vapi API Error (404)"
- Call/Tool/Assistant ID doesn't exist
- Check IDs in Vapi dashboard

### Sync fails
- Verify API key has write permissions
- Check tool schema is valid
- Look at error message in sync output

---

## Best Practices

1. **Version control your config** - `src/config/vapi-config.ts` is your source of truth
2. **Test locally first** - Use ngrok to test before deploying
3. **Monitor costs** - Run `npm run vapi:calls` regularly
4. **Backup call data** - Export important transcripts
5. **Use sync script** - Never manually update tools in dashboard

---

## Next Steps

- Add custom tools for your business logic
- Set up automated cost reporting
- Build a custom dashboard using the admin API
- Integrate call logs with your CRM

For more info: https://docs.vapi.ai
