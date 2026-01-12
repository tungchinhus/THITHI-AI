# Telegram Mini App Authentication Setup Guide

This guide explains how to set up and use the secure authentication system for Telegram Mini App using Firebase.

## Overview

The system implements a **whitelisting-based authentication** for internal employees (approx 30 users) using:

- **Firebase Cloud Functions** (Node.js) - Backend authentication
- **Firestore Database** - Employee whitelist storage
- **Firebase Authentication** - Custom token authentication
- **Telegram Mini App** - Frontend interface

## Architecture

### Flow 1: Onboarding (Telegram Bot)
1. User chats with Telegram Bot
2. User shares Contact (Phone Number) via button
3. Bot calls `telegramOnboarding` endpoint
4. System verifies phone against `employees` collection
5. Links `telegramId` to employee record

### Flow 2: Login (Mini App)
1. User opens Mini App
2. Frontend sends `initData` to `telegramLogin` endpoint
3. Backend verifies Telegram signature & whitelist
4. Returns Firebase Custom Token
5. Frontend signs in with custom token

## Prerequisites

1. **Firebase Project** with:
   - Cloud Functions enabled
   - Firestore Database enabled
   - Authentication enabled
   - Secret Manager enabled (for bot token)

2. **Telegram Bot** created via [@BotFather](https://t.me/botfather)
   - Get Bot Token
   - Create Mini App (set web app URL)

3. **Firestore Collection**: `employees`
   - Documents with schema:
     ```json
     {
       "phoneNumber": "0901234567",  // normalized, no +84
       "fullName": "Nguyen Van A",
       "role": "driver",  // or "admin"
       "telegramId": "123456789",  // string, initially null
       "isLinked": false,
       "isActive": true
     }
     ```

## Setup Steps

### 1. Configure Firebase Secrets

Set the Telegram Bot Token as a secret:

```bash
cd functions
echo "YOUR_BOT_TOKEN" | firebase functions:secrets:set TELEGRAM_BOT_TOKEN
```

**Important**: Replace `YOUR_BOT_TOKEN` with your actual bot token from BotFather.

### 2. Deploy Cloud Functions

```bash
cd functions
firebase deploy --only functions:telegramOnboarding,functions:telegramLogin
```

### 3. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 4. Create Employees Collection

1. Go to Firebase Console → Firestore Database
2. Create collection: `employees`
3. Add documents for each employee:

   **Example Document:**
   - Document ID: `emp_001` (or auto-generated)
   - Fields:
     - `phoneNumber` (string): `"0901234567"`
     - `fullName` (string): `"Nguyen Van A"`
     - `role` (string): `"driver"` or `"admin"`
     - `telegramId` (string): `null` (will be set during onboarding)
     - `isLinked` (boolean): `false`
     - `isActive` (boolean): `true`

### 5. Configure Telegram Bot

1. Open [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newapp` or edit existing bot
3. Select your bot
4. Set Mini App URL: `https://your-domain.com` (your deployed app URL)
5. Save

### 6. Update Frontend Environment

Update `src/environments/environment.ts`:

```typescript
export const environment = {
  // ... existing config
  firebaseFunctionUrl: "https://your-function-url.cloudfunctions.net",
  // Telegram function URLs are derived from firebaseFunctionUrl
};
```

### 7. Build and Deploy Frontend

```bash
npm run build
firebase deploy --only hosting
```

## Usage

### For End Users (Telegram Mini App)

1. **First Time (Onboarding)**:
   - Open Telegram Bot
   - Click button to share contact
   - Bot verifies phone number
   - Account is linked

2. **Using Mini App**:
   - Open Mini App from bot
   - Authentication happens automatically
   - User is signed in to Firebase
   - Can use all app features

### For Administrators

#### Add New Employee

1. Go to Firebase Console → Firestore
2. Add new document to `employees` collection:
   ```json
   {
     "phoneNumber": "0901234567",
     "fullName": "New Employee",
     "role": "employee",
     "telegramId": null,
     "isLinked": false,
     "isActive": true
   }
   ```

#### Link Employee Manually (Optional)

You can also link employees manually by updating the document:
- Set `telegramId`: `"123456789"`
- Set `isLinked`: `true`
- Set `linkedAt`: Current timestamp

#### Deactivate Employee

Set `isActive`: `false` in employee document.

## API Endpoints

### 1. Onboarding Endpoint

**URL**: `https://your-function-url/telegramOnboarding`

**Method**: `POST`

**Request Body**:
```json
{
  "phoneNumber": "0901234567",
  "telegramId": "123456789"
}
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Phone number linked successfully",
  "employee": {
    "id": "emp_001",
    "phoneNumber": "0901234567",
    "fullName": "Nguyen Van A",
    "role": "driver",
    "telegramId": "123456789",
    "isLinked": true
  }
}
```

**Response** (Error):
```json
{
  "error": "Not Found",
  "message": "Employee not found with this phone number or not active"
}
```

### 2. Login Endpoint

**URL**: `https://your-function-url/telegramLogin`

**Method**: `POST`

**Request Body**:
```json
{
  "initData": "query_id=...&user=...&auth_date=...&hash=..."
}
```

**Response** (Success):
```json
{
  "success": true,
  "customToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "employee": {
    "id": "emp_001",
    "phoneNumber": "0901234567",
    "fullName": "Nguyen Van A",
    "role": "driver",
    "telegramId": "123456789"
  }
}
```

**Response** (Error):
```json
{
  "error": "Forbidden",
  "message": "Telegram account not linked to any employee or employee not active"
}
```

## Security Features

1. **Telegram Signature Verification**: All `initData` is verified using HMAC-SHA-256
2. **Whitelisting**: Only employees in Firestore can access
3. **Phone Number Normalization**: Consistent format (no +84, spaces)
4. **Custom Claims**: Employee ID and role stored in Firebase token
5. **Firestore Rules**: Read-only access for employees collection

## Troubleshooting

### Error: "TELEGRAM_BOT_TOKEN secret not configured"

**Solution**: Set the secret:
```bash
echo "YOUR_BOT_TOKEN" | firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase deploy --only functions
```

### Error: "Employee not found with this phone number"

**Solution**: 
1. Check phone number format in Firestore (should be normalized: `0901234567`)
2. Ensure `isActive` is `true`
3. Verify phone number matches exactly (case-sensitive)

### Error: "Telegram account not linked"

**Solution**:
1. Complete onboarding first (share contact with bot)
2. Check `isLinked` is `true` in Firestore
3. Verify `telegramId` matches Telegram user ID

### Error: "Invalid Telegram initData"

**Solution**:
1. Ensure Mini App is opened from Telegram (not direct browser)
2. Check bot token is correct
3. Verify `initData` is not expired (24 hours max)

## Testing

### Test Onboarding (via Bot)

1. Create test employee in Firestore
2. Use Telegram Bot to share contact
3. Bot should call onboarding endpoint
4. Check Firestore: `isLinked` should be `true`

### Test Login (via Mini App)

1. Ensure employee is linked (`isLinked: true`)
2. Open Mini App from Telegram
3. Check browser console for authentication logs
4. Verify Firebase user is created/authenticated

## Notes

- Phone numbers are normalized: `+84901234567` → `0901234567`
- Telegram user IDs are stored as strings
- Firebase UIDs format: `telegram_{telegramId}`
- Custom claims include: `telegramId`, `employeeId`, `role`
- `initData` expires after 24 hours (handled automatically)

## Support

For issues or questions:
1. Check Firebase Functions logs: `firebase functions:log`
2. Check browser console for frontend errors
3. Verify Firestore rules are deployed
4. Ensure all secrets are set correctly
