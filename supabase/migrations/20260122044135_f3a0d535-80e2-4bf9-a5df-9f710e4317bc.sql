-- Create table to track blocked users
CREATE TABLE public.blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    blocked_by UUID NOT NULL,
    reason TEXT,
    unblocked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blocked users
CREATE POLICY "Admins can manage blocked users"
ON public.blocked_users
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_blocked_users_user_id ON public.blocked_users(user_id);

-- Function to check if user is blocked
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blocked_users
    WHERE user_id = _user_id
      AND unblocked_at IS NULL
  )
$$;