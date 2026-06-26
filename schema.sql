-- Database Schema for Ludo Web App
-- Assuming PostgreSQL with InsForge (Supabase-like)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (Using internal auth if necessary, or just a profile table)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(6) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
    state JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Room Players Table
CREATE TABLE IF NOT EXISTS public.room_players (
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    color VARCHAR(10) CHECK (color IN ('emerald', 'blue', 'red', 'amber')),
    is_host BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (room_id, user_id),
    UNIQUE (room_id, color)
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and setup policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- For this prototype, we'll allow anonymous access with simple policies.
-- In a production environment with InsForge Auth, policies would be restricted using auth.uid().

CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.users FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Enable insert for all rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all rooms" ON public.rooms FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all room players" ON public.room_players FOR SELECT USING (true);
CREATE POLICY "Enable insert for all room players" ON public.room_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable delete for all room players" ON public.room_players FOR DELETE USING (true);

CREATE POLICY "Enable read access for all messages" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Enable insert for all messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
