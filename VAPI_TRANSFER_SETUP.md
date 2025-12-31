# Setting Up Transfer Tools in Vapi Dashboard

**IMPORTANT**: Transfer tools (call forwarding) cannot be created via the Vapi API. You MUST create them in the Vapi Dashboard UI.

## Step-by-Step Guide

### Step 1: Go to Vapi Dashboard
1. Visit https://dashboard.vapi.ai
2. Log in with your account

### Step 2: Navigate to Tools
1. Click on **"Tools"** in the left sidebar
2. Click **"Create Tool"** button

### Step 3: Create Sales Transfer Tool

**Tool Type:** Select **"Transfer Call"**

**Configuration:**
```
Name: transfer_to_sales
Description: Transfer the call to Sales Manager when customer wants to buy, rent, get a quote, or needs pricing negotiation.
Destination Type: Phone Number
Phone Number: +1234567890  (← Replace with your Sales Manager's number)
Transfer Message: "Transferring you to our Sales Manager now..."
```

### Step 4: Create Service Transfer Tool

Click **"Create Tool"** again

**Tool Type:** Select **"Transfer Call"**

**Configuration:**
```
Name: transfer_to_service
Description: Transfer the call to Service Department when customer needs repairs, maintenance, or has a broken machine.
Destination Type: Phone Number
Phone Number: +1234567890  (← Replace with your Service Desk number)
Transfer Message: "Connecting you to our Service Desk right now..."
```

### Step 5: Verify Tools Are Created
1. Go to **"Tools"** in sidebar
2. You should see both tools listed:
   - `transfer_to_sales`
   - `transfer_to_service`

### Step 6: Test the Transfer
1. Make a test call to your Vapi phone number
2. Say: "I want to buy a dozer"
3. The agent should say "Perfect! Let me connect you with a Sales Manager" and transfer the call

## Environment Variables (Optional)

If you want to store phone numbers in .env:

```bash
# Add to your .env file
SALES_PHONE_NUMBER=+1234567890
SERVICE_PHONE_NUMBER=+0987654321
```

## How It Works

When the AI detects high intent (user wants to buy/rent/repair), it:
1. Calls the `transfer_to_sales` or `transfer_to_service` tool
2. Vapi receives the tool call
3. Vapi stops the AI audio
4. Vapi initiates a call bridge to the configured phone number
5. User is connected to Sales/Service team

## Troubleshooting

**Tool not working?**
- Make sure tool names are EXACTLY: `transfer_to_sales` and `transfer_to_service`
- Check phone numbers are in E.164 format: `+1234567890`
- Verify the tools appear in your Tools list

**AI not calling the tool?**
- Check the system prompt includes the delegation rules
- Run `npm run vapi:sync` to update your configuration
- Make sure you're using clear trigger phrases like "I want to buy" or "I need repair"
