# Tex Intel API

Voice AI integration API for Tex Intel heavy equipment rental business, powered by Vapi.

## Features

- 🎯 **Customer Recognition** - Personalized greetings for known customers
- 📦 **Inventory Checking** - Real-time equipment availability via voice
- 🔧 **Config as Code** - Manage Vapi tools and assistants in version control
- 📊 **Analytics** - Access call logs and billing programmatically
- 🧪 **Fully Tested** - 22 tests covering all functionality
- 🏗️ **Clean Architecture** - Services, Controllers, Routes pattern

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and set:
# VAPI_API_KEY=sk_live_your_key_here
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Expose with ngrok (for Vapi webhook testing)
```bash
# Terminal 2
npm run tunnel
# Copy the https URL
```

### 5. Configure Vapi
1. Go to https://dashboard.vapi.ai
2. Set **Server URL**: `https://your-ngrok-url.ngrok-free.app/inbound`
3. Or sync tools: `npm run vapi:sync`

## Project Structure

```
src/
├── controllers/         # Request/response handling
│   ├── inbound.controller.ts
│   └── tools.controller.ts
├── services/            # Business logic (reusable)
│   ├── customer.service.ts
│   ├── inventory.service.ts
│   └── vapi-client.service.ts
├── routes/              # HTTP routing (thin layer)
│   ├── inbound.ts
│   ├── tools.ts
│   └── admin.ts
├── db/                  # Data access
│   └── mock.ts
├── config/              # Configuration
│   └── vapi-config.ts
├── types/               # TypeScript definitions
│   └── vapi.types.ts
└── app.ts               # Application entry point

tests/                   # Test suites
scripts/                 # CLI utilities
```

## Architecture

### Hybrid Multi-Layer Pattern

**Routes** → **Controllers** → **Services** → **Data**

- **Routes**: Thin routing layer (just HTTP)
- **Controllers**: Request/response handling
- **Services**: Business logic (testable, reusable)
- **Data**: Database access (currently mock)

### Why This Structure?

✅ **Testable** - Services can be tested without HTTP
✅ **Reusable** - Logic can be called from anywhere
✅ **Scalable** - Clear separation of concerns
✅ **Maintainable** - Easy to find and modify code

## API Endpoints

### Public Endpoints (Vapi Webhooks)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/inbound` | POST | Handle incoming calls |
| `/tools` | POST | Execute tool functions |

### Admin Endpoints (Your Use)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/calls` | GET | Fetch call logs |
| `/admin/calls/:id` | GET | Get specific call |
| `/admin/billing` | GET | Get cost data |
| `/admin/tools` | GET | List tools |
| `/admin/tools/sync` | POST | Sync config to Vapi |
| `/admin/assistants` | GET | List assistants |
| `/admin/health` | GET | Check Vapi connection |

See [VAPI_GUIDE.md](./VAPI_GUIDE.md) for detailed API documentation.

## NPM Scripts

### Development
```bash
npm run dev          # Start with hot reload
npm run build        # Compile TypeScript
npm run start        # Run production build
npm run clean        # Remove dist folder
```

### Testing
```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:ui      # Interactive UI
npm run test:coverage # Generate coverage report
```

### Vapi Integration
```bash
npm run vapi:sync    # Sync tools to Vapi
npm run vapi:calls   # Fetch last 10 calls
npm run vapi:calls:20 # Fetch last 20 calls
```

### Utilities
```bash
npm run tunnel       # Start ngrok tunnel
```

## Configuration

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Vapi API
VAPI_API_KEY=sk_live_your_key_here

# Optional
SERVER_URL=https://your-production-url.com
```

### Vapi Tools (Code)

Edit `src/config/vapi-config.ts`:

```typescript
export const VAPI_TOOLS: VapiTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_inventory',
      description: 'Check equipment availability',
      parameters: { ... }
    },
    server: {
      url: `${getServerUrl()}/tools`
    }
  }
];
```

Then sync: `npm run vapi:sync`

## Testing

Run the test suite:

```bash
npm test
```

Output:
```
✓ tests/app.test.ts (2 tests)
✓ tests/inbound.test.ts (7 tests)
✓ tests/tools.test.ts (13 tests)

Test Files  3 passed (3)
Tests       22 passed (22)
```

See [TESTING.md](./TESTING.md) for detailed testing documentation.

## Deployment

### Railway (Recommended)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Get URL
railway domain
```

### Docker

```bash
# Build
docker build -t tex-api .

# Run
docker run -p 3000:3000 --env-file .env tex-api
```

### Vercel/Other Serverless

See plan file for serverless considerations (latency important for voice!).

## Development Workflow

### Adding a New Tool

1. **Define tool** in `src/config/vapi-config.ts`:
```typescript
export const VAPI_TOOLS: VapiTool[] = [
  // ... existing tools
  {
    type: 'function',
    function: {
      name: 'book_rental',
      description: 'Book equipment rental',
      parameters: {
        type: 'object',
        properties: {
          equipmentId: { type: 'string', description: '...' },
          startDate: { type: 'string', description: '...' }
        },
        required: ['equipmentId', 'startDate']
      }
    },
    server: { url: `${getServerUrl()}/tools` }
  }
];
```

2. **Handle in controller** (`src/controllers/tools.controller.ts`):
```typescript
if (functionName === 'book_rental') {
  result = handleBookRental(args);
}
```

3. **Sync to Vapi**:
```bash
npm run vapi:sync
```

4. **Test**:
```bash
npm test
```

Done! No dashboard needed.

### Adding a New Service

1. Create `src/services/my-service.service.ts`
2. Export service class and singleton
3. Use in controllers
4. Write tests

## Monitoring & Analytics

### View Call Logs

```bash
# CLI
npm run vapi:calls

# API
curl http://localhost:3000/admin/calls
```

### Track Costs

```bash
# Get billing data
curl http://localhost:3000/admin/billing

# Filter by date
curl "http://localhost:3000/admin/billing?startDate=2025-12-01&endDate=2025-12-31"
```

### Custom Dashboards

Use the admin API to build custom dashboards:
- `/admin/calls` - Call history
- `/admin/billing` - Cost tracking
- `/admin/tools` - Tool usage stats

## Troubleshooting

### Server won't start
- Check `.env` exists with valid `VAPI_API_KEY`
- Ensure port 3000 is not in use
- Run `npm install` first

### Tests failing
- Run `npm run clean && npm run build`
- Check mock data in `src/db/mock.ts`

### Vapi integration not working
- Verify `VAPI_API_KEY` is set correctly
- Check ngrok is running: `npm run tunnel`
- Test connection: `curl http://localhost:3000/admin/health`

### Customer not recognized
- Phone numbers must be E.164 format: `+1XXXXXXXXXX`
- Check customer exists in `src/db/mock.ts`
- View server logs for recognition messages

## Documentation

- [VAPI_GUIDE.md](./VAPI_GUIDE.md) - Complete Vapi integration guide
- [TESTING.md](./TESTING.md) - Testing documentation with examples

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Framework**: Fastify 5.x
- **Language**: TypeScript (strict mode)
- **Testing**: Vitest
- **Voice AI**: Vapi + Groq (llama-3.1-8b-instant)
- **Deployment**: Docker + Railway

## License

ISC

## Support

For issues or questions:
- Check existing documentation
- Review test files for examples
- Consult Vapi docs: https://docs.vapi.ai
