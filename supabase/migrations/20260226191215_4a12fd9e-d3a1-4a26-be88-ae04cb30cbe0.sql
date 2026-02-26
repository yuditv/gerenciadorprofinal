
-- Drop admin-only policies on contacts
DROP POLICY IF EXISTS "Only admins can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Only admins can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Only admins can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Only admins can delete contacts" ON public.contacts;

-- Create owner-based policies
CREATE POLICY "Users can view own contacts" ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contacts" ON public.contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contacts" ON public.contacts FOR DELETE USING (auth.uid() = user_id);
