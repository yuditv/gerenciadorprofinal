-- Create table for user permissions
CREATE TABLE public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    -- Feature permissions
    can_view_dashboard BOOLEAN DEFAULT true,
    can_view_clients BOOLEAN DEFAULT true,
    can_manage_clients BOOLEAN DEFAULT true,
    can_view_contacts BOOLEAN DEFAULT true,
    can_manage_contacts BOOLEAN DEFAULT true,
    can_view_whatsapp BOOLEAN DEFAULT true,
    can_manage_whatsapp BOOLEAN DEFAULT true,
    can_view_dispatches BOOLEAN DEFAULT true,
    can_send_dispatches BOOLEAN DEFAULT true,
    can_view_campaigns BOOLEAN DEFAULT true,
    can_manage_campaigns BOOLEAN DEFAULT true,
    can_view_warming BOOLEAN DEFAULT true,
    can_manage_warming BOOLEAN DEFAULT true,
    can_view_ai_agent BOOLEAN DEFAULT true,
    can_view_settings BOOLEAN DEFAULT true,
    can_view_reports BOOLEAN DEFAULT true,
    can_view_reseller BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "Admins can manage all permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);

-- Drop referral tables
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.referral_codes CASCADE;