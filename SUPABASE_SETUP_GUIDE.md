# Supabase Setup Guide

This project has been configured to use **Supabase** for authentication and database management.

## ✅ What Has Been Done

1. **Dependencies Updated**
   - Backend: Added `@supabase/supabase-js` (removed `pg` dependency)
   - Frontend: Added `@supabase/supabase-js`
   - All dependencies installed

2. **Environment Configuration**
   - Backend `.env` updated with Supabase placeholders
   - Frontend `.env.local` created with Supabase placeholders

3. **Code Refactored**
   - `auth.js` - Updated to use Supabase Auth
   - `authMiddleware.js` - Updated to verify Supabase tokens
   - `db.js` - Updated to use Supabase client
   - `supabaseClient.js` - Created for backend
   - `src/supabaseClient.js` - Created for frontend

## 🔧 Next Steps to Complete Setup

### 1. Create a Supabase Project
- Go to [supabase.com](https://supabase.com)
- Create a new project
- Note your **Project URL** and **API Keys**

### 2. Get Your Supabase Credentials
From your Supabase dashboard:
- `Project URL` → Your `SUPABASE_URL`
- `anon` key → Your `SUPABASE_ANON_KEY`
- `service_role` key → Your `SUPABASE_SERVICE_ROLE_KEY`

### 3. Update Environment Variables

#### Backend (.env file at d:\CapProject\Backend\.env)
```env
PORT=5000

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-actual-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key

# JWT Configuration (optional)
JWT_SECRET=mysecretkey
```

#### Frontend (.env.local file at d:\CapProject\Frontend\SignUp\.env.local)
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key
```

### 4. Create Database Tables in Supabase

Run the following SQL in Supabase SQL Editor:

```sql
-- Create users table
CREATE TABLE public.users (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own data
CREATE POLICY "Users can view their own data" 
  ON public.users 
  FOR SELECT 
  USING (auth.uid() = id);

-- Create policy for users to update their own data
CREATE POLICY "Users can update their own data" 
  ON public.users 
  FOR UPDATE 
  USING (auth.uid() = id);
```

### 5. Create Campaign/Dashboard Tables (Optional)

If you need to store campaigns or dashboard data:

```sql
CREATE TABLE public.campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  category TEXT,
  audience TEXT,
  platform TEXT,
  ad_copy TEXT,
  headline TEXT,
  cta TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaigns" 
  ON public.campaigns 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create campaigns" 
  ON public.campaigns 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
```

### 6. Update Frontend Components

Update your `Signup.jsx` and `Login.jsx` to use Supabase:

```jsx
import { supabase } from '../supabaseClient';

// Example: Register
const handleRegister = async (fullName, email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  
  if (error) console.error(error);
  else console.log('Registration successful');
};

// Example: Login
const handleLogin = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) console.error(error);
  else {
    localStorage.setItem('token', data.session.access_token);
  }
};

// Example: Logout
const handleLogout = async () => {
  await supabase.auth.signOut();
  localStorage.removeItem('token');
};
```

### 7. Verify Backend Routes

The backend routes have been updated:
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login and get token
- `GET /api/dashboard` - Protected route (requires auth)
- `POST /api/campaign/generate` - Generate ad campaign

## 🧪 Testing

### Test Backend
```bash
cd d:\CapProject\Backend
npm start
```

### Test Frontend
```bash
cd d:\CapProject\Frontend\SignUp
npm run dev
```

## 📝 API Endpoints

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"John Doe","email":"john@example.com","password":"password123"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

### Protected Route (Dashboard)
```bash
curl -X GET http://localhost:5000/api/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🔐 Security Notes

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Use service role key only on backend** - Frontend uses `anon` key
3. **Enable RLS (Row Level Security)** - Protects user data
4. **Supabase handles password hashing** - No need for bcrypt in auth

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

## ⚠️ Troubleshooting

**"SUPABASE_URL is not defined"**
- Check your `.env` file has correct values
- Restart your server after updating `.env`

**"Invalid token"**
- Ensure token is being sent in `Authorization: Bearer <token>` format
- Check token hasn't expired

**"User not found"**
- Make sure user table is created with correct schema
- Verify RLS policies are set correctly
