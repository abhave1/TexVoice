# Testing Guide for Tex Intel API

## Test Suite Overview

The Tex Intel API uses **Vitest** as its testing framework. All tests are located in the `/tests` directory.

## Test Statistics

- **Total Tests**: 22
- **Test Files**: 3
- **Coverage**: All major endpoints and edge cases

## Running Tests

### Run all tests once
```bash
npm test
```

### Watch mode (re-runs on file changes)
```bash
npm run test:watch
```

### UI mode (interactive browser interface)
```bash
npm run test:ui
```

### Coverage report
```bash
npm run test:coverage
```

## Test Files

### 1. `tests/app.test.ts` - Health Check Tests
**Purpose**: Verify the root endpoint functionality

**Tests** (2):
- ✓ Should return operational status
- ✓ Should return valid timestamp

**Example Request**:
```bash
curl http://localhost:3000/
```

**Expected Response**:
```json
{
  "status": "Tex Intel System Operational",
  "timestamp": "2025-12-30T00:10:54.461Z",
  "endpoints": {
    "inbound": "/inbound",
    "tools": "/tools"
  }
}
```

---

### 2. `tests/inbound.test.ts` - Customer Recognition Tests
**Purpose**: Verify inbound call handling and customer recognition

**Tests** (7):
- ✓ Should recognize Abhave (+14805551234) and return personalized greeting
- ✓ Should recognize Bob Builder (+15125559999)
- ✓ Should recognize Sarah Martinez (+14695558888)
- ✓ Should return generic greeting for unknown number
- ✓ Should handle different unknown numbers
- ✓ Should handle missing phone number gracefully
- ✓ Should always return Groq model configuration

**Example Request - Known Customer**:
```bash
curl -X POST http://localhost:3000/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "call": {
        "customer": {
          "number": "+14805551234"
        }
      }
    }
  }'
```

**Expected Response**:
```json
{
  "assistant": {
    "model": {
      "provider": "groq",
      "model": "llama-3.1-8b-instant",
      "messages": [{
        "role": "system",
        "content": "...CONTEXT: You are speaking to Abhave from Tex Intel HQ..."
      }]
    },
    "firstMessage": "Hi Abhave, welcome back to Tex Intel. Are you calling about the Cat 336 Excavator or something else?"
  }
}
```

**Example Request - Unknown Customer**:
```bash
curl -X POST http://localhost:3000/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "call": {
        "customer": {
          "number": "+19999999999"
        }
      }
    }
  }'
```

**Expected Response**:
```json
{
  "assistant": {
    "model": {
      "provider": "groq",
      "model": "llama-3.1-8b-instant",
      "messages": [{
        "role": "system",
        "content": "You are 'Tex', the AI receptionist..."
      }]
    },
    "firstMessage": "Thanks for calling Tex Intel. How can I help you?"
  }
}
```

---

### 3. `tests/tools.test.ts` - Inventory Tool Tests
**Purpose**: Verify the check_inventory tool functionality

**Tests** (13):
- ✓ Should return excavator inventory
- ✓ Should find excavators with different casing (EXCAVATOR)
- ✓ Should find specific excavator model (336)
- ✓ Should return skid steer inventory
- ✓ Should return dozer inventory including unavailable
- ✓ Should find loaders
- ✓ Should find cranes
- ✓ Should find dump trucks
- ✓ Should return no results message for non-existent equipment
- ✓ Should handle empty query gracefully
- ✓ Should handle missing toolCalls
- ✓ Should handle unknown function name
- ✓ Should preserve toolCallId in response

**Example Request - Search Excavators**:
```bash
curl -X POST http://localhost:3000/tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "toolCalls": [{
        "id": "test-123",
        "type": "function",
        "function": {
          "name": "check_inventory",
          "arguments": {
            "query": "excavator"
          }
        }
      }]
    }
  }'
```

**Expected Response**:
```json
{
  "results": [{
    "toolCallId": "test-123",
    "result": "We have the following available: Cat 336 (2 available at $1200/day), Cat 320 (3 available at $950/day)"
  }]
}
```

**Example Request - Search Skid Steers**:
```bash
curl -X POST http://localhost:3000/tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "toolCalls": [{
        "id": "test-456",
        "type": "function",
        "function": {
          "name": "check_inventory",
          "arguments": {
            "query": "skid steer"
          }
        }
      }]
    }
  }'
```

**Expected Response**:
```json
{
  "results": [{
    "toolCallId": "test-456",
    "result": "We have the following available: Bobcat T76 (5 available at $350/day), Bobcat S650 (4 available at $300/day)"
  }]
}
```

**Example Request - No Results**:
```bash
curl -X POST http://localhost:3000/tools \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "toolCalls": [{
        "id": "test-789",
        "type": "function",
        "function": {
          "name": "check_inventory",
          "arguments": {
            "query": "helicopter"
          }
        }
      }]
    }
  }'
```

**Expected Response**:
```json
{
  "results": [{
    "toolCallId": "test-789",
    "result": "I checked the lot, but I don't see any helicopter available right now."
  }]
}
```

---

## Test Data

### Known Customers in Database
| Phone Number | Name | Company | Last Machine | Status |
|--------------|------|---------|--------------|--------|
| +14805551234 | Abhave | Tex Intel HQ | Cat 336 Excavator | VIP |
| +15125559999 | Bob Builder | Austin Construction | Skid Steer | New |
| +14695558888 | Sarah Martinez | Dallas Demolition Co | Cat D6 Dozer | VIP |
| +17135557777 | Mike Johnson | Houston Heavy Haul | Dump Truck | New |

### Available Inventory
| Model | Category | Available | Price/Day |
|-------|----------|-----------|-----------|
| Cat 336 | Excavator | 2 | $1200 |
| Cat 320 | Excavator | 3 | $950 |
| Cat D6 | Dozer | 0 | $900 |
| Cat D8 | Dozer | 1 | $1400 |
| Bobcat T76 | Skid Steer | 5 | $350 |
| Bobcat S650 | Skid Steer | 4 | $300 |
| JCB 3CX | Backhoe | 2 | $500 |
| Cat 950M | Loader | 2 | $850 |
| Volvo A40G | Dump Truck | 3 | $1100 |
| Manitowoc 18000 | Crane | 1 | $2500 |

---

## Adding New Tests

### Test File Structure
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
// Import your route

describe('Feature Name', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    // Register plugins and routes
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should do something', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/endpoint',
      payload: { /* your payload */ }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.someField).toBe('expected value');
  });
});
```

---

## Continuous Integration

To run tests in CI/CD pipelines:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

---

## Coverage

To view test coverage:

```bash
npm run test:coverage
```

This generates:
- Terminal output (text report)
- HTML report in `coverage/` directory
- JSON report for CI tools

Open `coverage/index.html` in your browser to see detailed coverage.

---

## Troubleshooting

### Tests fail with "Address already in use"
Make sure no other instance of the server is running on port 3000.

### Tests timeout
Increase timeout in vitest.config.ts:
```typescript
test: {
  testTimeout: 10000 // 10 seconds
}
```

### Mock data not reflecting in tests
The tests use the actual mock data from `src/db/mock.ts`. Update that file to change test data.

---

## Best Practices

1. **Run tests before committing**: `npm test`
2. **Write tests for new features**: Follow existing patterns
3. **Test edge cases**: Empty inputs, missing fields, invalid data
4. **Keep tests isolated**: Each test should be independent
5. **Use descriptive names**: Test names should explain what they verify
6. **Check coverage**: Aim for >80% coverage on critical paths
