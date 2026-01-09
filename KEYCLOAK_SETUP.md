# Keycloak Integration Setup Guide

This guide will walk you through setting up Keycloak for authentication with social login support in RealChat.

## Overview

Keycloak has been integrated into RealChat to provide:
- **Enterprise-grade authentication** with OAuth2/OIDC
- **Social login** support (Google, GitHub, Facebook, etc.)
- **Centralized user management** with admin console
- **Token management** with automatic refresh
- **Role-based access control** (RBAC)

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database running
- Backend and frontend dependencies installed

## Step 1: Start Keycloak Service

Start the Keycloak container via Docker Compose:

```bash
cd /home/rayen/real-chat
docker-compose up keycloak -d
```

Wait for Keycloak to be healthy (~30-60 seconds). Check logs:

```bash
docker-compose logs -f keycloak
```

Look for: `Keycloak 24.x.x started`

## Step 2: Access Keycloak Admin Console

1. Open your browser and go to: **http://localhost:8080**
2. Click **Administration Console**
3. Login with admin credentials:
   - Username: `admin`
   - Password: `admin123` (or your `KEYCLOAK_ADMIN_PASSWORD` from .env)

⚠️ **Important**: Change the admin password in production!

## Step 3: Create Realm

1. Click the dropdown in the top-left corner (says "Master")
2. Click **Create realm**
3. Enter:
   - Name: `realchat`
   - Click **Create**

## Step 4: Create Frontend Client (Public)

1. Go to **Clients** → **Create client**
2. Enter:
   - Client type: `OpenID Connect`
   - Client ID: `realchat-frontend`
   - Click **Next**
3. **Client authentication**:
   - Disabled (this is a public client for the frontend)
   - Click **Next**
4. **Login settings**:
   - Valid redirect URIs:
     ```
     http://localhost:3000/*
     http://localhost:3001/*
     ```
   - Valid post logout redirect URIs:
     ```
     http://localhost:3000/*
     http://localhost:3001/*
     ```
   - Web origins:
     ```
     http://localhost:3000
     http://localhost:3001
     ```
   - Click **Save**

## Step 5: Create Backend Client (Confidential)

1. Go to **Clients** → **Create client**
2. Enter:
   - Client type: `OpenID Connect`
   - Client ID: `realchat-backend`
   - Click **Next**
3. **Client authentication**:
   - ✅ Enabled (this is a confidential client for the backend)
   - Client authentication: `Client secret`
   - Click **Next**
4. **Login settings**:
   - Valid redirect URIs:
     ```
     http://localhost:3001/api/auth/keycloak/callback
     ```
   - Valid post logout redirect URIs:
     ```
     http://localhost:3001/*
     ```
   - Web origins:
     ```
     http://localhost:3001
     ```
   - Click **Save**

5. **Copy the client secret**:
   - Go to the **Credentials** tab
   - Copy the **Client secret** value
   - Add it to your `.env` file:
     ```env
     KEYCLOAK_CLIENT_SECRET=your-copied-secret-here
     ```

## Step 6: Enable Social Login (Optional)

### Google Login

1. Go to **Realm settings** → **Identity providers**
2. Click **Add provider** → **Google**
3. Enter your Google OAuth credentials:
   - Client ID: From [Google Cloud Console](https://console.cloud.google.com/)
   - Client secret: From Google Cloud Console
4. Click **Add**

To get Google credentials:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to **Credentials** → **Create credentials** → **OAuth client ID**
5. Authorized redirect URI: `http://localhost:8080/realms/realchat/broker/google/endpoint`

### GitHub Login

1. Go to **Realm settings** → **Identity providers**
2. Click **Add provider** → **GitHub**
3. Enter your GitHub OAuth credentials:
   - Client ID: From [GitHub Developer Settings](https://github.com/settings/developers)
   - Client secret: From GitHub Developer Settings
4. Click **Add**

To get GitHub credentials:
1. Go to GitHub → **Settings** → **Developer settings** → **OAuth Apps**
2. Click **New OAuth App**
3. Authorization callback URL: `http://localhost:8080/realms/realchat/broker/github/endpoint`

## Step 7: Run Database Migration

Add Keycloak fields to the users table:

```bash
cd /home/rayen/real-chat/backend
npx tsx migrations/add_keycloak_fields.ts
```

Expected output:
```
🔄 Adding Keycloak fields to users table...
  Adding keycloak_id column...
  Making email nullable...
  Making password_hash nullable...
  Adding email_verified column...
  Adding first_name column...
  Adding last_name column...
  Creating index on keycloak_id...
✅ Keycloak fields added successfully!
```

## Step 8: Update Environment Variables

Ensure your `.env` file in the project root contains:

```env
# Database
DB_PASSWORD=your-secure-password

# Keycloak Admin
KEYCLOAK_ADMIN_PASSWORD=admin123

# Keycloak Client Secret (from Step 5)
KEYCLOAK_CLIENT_SECRET=your-copied-client-secret

# JWT (optional - Keycloak handles this now)
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

## Step 9: Start Backend and Frontend

### Backend

```bash
cd /home/rayen/real-chat/backend
npm run dev
```

Backend will start on `http://localhost:3001`

### Frontend

```bash
cd /home/rayen/real-chat/frontend
npm run dev
```

Frontend will start on `http://localhost:3000`

## Step 10: Test Authentication Flow

### Initial Login

1. Open browser to `http://localhost:3000`
2. You should be automatically redirected to Keycloak login
3. Click **Register** to create a new user, or login with existing credentials
4. Or use social login (Google/GitHub) if configured

### After Login

1. You'll be redirected back to the app
2. The user is automatically created in your database via Keycloak callback
3. Check the backend logs for user creation

### Token Management

- **Access tokens** expire in 15 minutes (configurable in Keycloak)
- **Refresh tokens** expire in 7 days (configurable in Keycloak)
- Tokens are automatically refreshed by the frontend
- No manual intervention needed

## Architecture Overview

### Backend Flow

```
1. Frontend redirects to Keycloak for login
2. User authenticates with Keycloak
3. Keycloak redirects to: /api/auth/keycloak/callback?code=...
4. Backend exchanges code for access token
5. Backend fetches user info from Keycloak
6. Backend creates/updates user in database
7. Backend returns tokens to frontend
8. Frontend stores tokens and uses for API calls
```

### Frontend Flow

```
1. App initializes → Keycloak checks authentication
2. If not authenticated → Redirect to Keycloak login
3. If authenticated → Load user info and tokens
4. All API calls include: Authorization: Bearer <token>
5. Token expires → Auto-refresh with Keycloak
6. Logout → Clear tokens + Keycloak logout
```

### Protected Routes

All protected routes now use the `ProtectedRoute` component:

```tsx
import ProtectedRoute from '@/components/ProtectedRoute';

export default function MyPage() {
  return (
    <ProtectedRoute>
      <MyPageContent />
    </ProtectedRoute>
  );
}
```

### API Authentication

Backend validates Keycloak tokens using `keycloakMiddleware`:

```typescript
import { keycloakMiddleware } from '@/keycloak/config.js';

fastify.register(() => fastify.addHook('onRequest', keycloakMiddleware));
```

## User Management

### View Users

1. Go to **Users** → **View all users**
2. See all users who have logged in

### Manage Users

- Click on a user to:
  - View attributes
  - Assign roles
  - Reset credentials
  - Impersonate user
  - View sessions

### Roles

1. Go to **Realm roles** → **Create role**
2. Create roles like: `admin`, `moderator`, `user`
3. Assign roles to users in **Users** → **Role mapping**

## Testing

### Test Social Login

1. Configure Google or GitHub identity provider
2. Logout from the app
3. Click login
4. Click "Google" or "GitHub" button
5. Complete OAuth flow
6. User created in database with social login info

### Test Token Refresh

1. Login to the app
2. Open browser DevTools → **Application** → **Local Storage**
3. Note the token (you can decode it at jwt.io)
4. Wait 15 minutes (or change token lifespan in Keycloak)
5. Make an API call
6. Check that token was automatically refreshed

### Test Logout

1. Login to the app
2. Logout
3. Check that local storage is cleared
4. Check that Keycloak session is terminated

## Production Configuration

### Keycloak Production Settings

1. **Enable HTTPS**:
   - Set `KC_HTTP_ENABLED=false` in docker-compose.yml
   - Configure SSL certificate

2. **Change admin password**:
   - Use a strong password for `KEYCLOAK_ADMIN_PASSWORD`

3. **Configure email**:
   - Go to **Realm settings** → **Email**
   - Setup SMTP for password reset emails

4. **Token settings**:
   - Go to **Realm settings** → **Tokens**
   - Adjust access token lifespan (default: 5 minutes)
   - Adjust refresh token max reuse (default: 0)

5. **Security**:
   - Enable brute force protection
   - Configure password policies
   - Enable 2FA for admin console

### Environment Variables

Production `.env`:

```env
# Production Database
DB_PASSWORD=very-secure-random-password

# Keycloak Production
KEYCLOAK_ADMIN_PASSWORD=very-secure-admin-password
KEYCLOAK_CLIENT_SECRET=production-client-secret

# Keycloak URL (use HTTPS)
KEYCLOAK_URL=https://keycloak.yourdomain.com

# Frontend URLs
CORS_ORIGIN=https://yourdomain.com
```

## Troubleshooting

### Issue: Keycloak won't start

**Solution**:
```bash
docker-compose logs keycloak
# Check if PostgreSQL is running
docker-compose ps
# Restart Keycloak
docker-compose restart keycloak
```

### Issue: "Invalid client secret" error

**Solution**:
1. Go to Keycloak Admin → Clients → realchat-backend → Credentials
2. Copy the client secret
3. Update your `.env` file
4. Restart backend

### Issue: CORS errors

**Solution**:
1. Go to Clients → realchat-frontend
2. Verify **Web origins** includes your frontend URL
3. Verify **Valid redirect URIs** includes your URL with `/*`

### Issue: User not created in database

**Solution**:
1. Check backend logs for errors
2. Verify database migration ran successfully
3. Check Keycloak is returning user info
4. Verify `KEYCLOAK_CLIENT_SECRET` is correct

### Issue: Token refresh not working

**Solution**:
1. Check browser console for errors
2. Verify Keycloak is accessible
3. Check that refresh token is valid (not expired)
4. Verify client secret is correct

## Migration from Custom JWT to Keycloak

Existing users with password-based auth:

1. **Users table now has nullable fields**:
   - `email` - nullable (Keycloak users have email)
   - `password_hash` - nullable (Keycloak users don't have password hash)
   - `keycloak_id` - nullable (null for old JWT users)

2. **Dual authentication support**:
   - Old JWT users can still login with username/password
   - New Keycloak users login via Keycloak

3. **Migrate existing users** (optional):
   ```sql
   -- Link existing users to Keycloak after they login with Keycloak
   UPDATE users
   SET keycloak_id = 'keycloak-user-id'
   WHERE email = 'user@example.com';
   ```

## Next Steps

- [ ] Configure production Keycloak with HTTPS
- [ ] Setup email provider for password reset
- [ ] Configure additional social login providers
- [ ] Setup Keycloak clustering for high availability
- [ ] Configure user federation (LDAP, Active Directory)
- [ ] Setup monitoring and alerting

## Resources

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [Keycloak Admin Console](http://localhost:8080)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [OpenID Connect Specification](https://openid.net/connect/)

## Support

For issues or questions:
1. Check Keycloak logs: `docker-compose logs -f keycloak`
2. Check backend logs for authentication errors
3. Verify Keycloak configuration in admin console
4. Review this guide's troubleshooting section
