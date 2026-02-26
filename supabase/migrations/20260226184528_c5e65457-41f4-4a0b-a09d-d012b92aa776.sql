
-- Drop admin-only policies
DROP POLICY "Only admins can delete sent contacts" ON public.sent_contacts;
DROP POLICY "Only admins can insert sent contacts" ON public.sent_contacts;
DROP POLICY "Only admins can update sent contacts" ON public.sent_contacts;
DROP POLICY "Only admins can view sent contacts" ON public.sent_contacts;

-- Create user-based policies
CREATE POLICY "Users can view own sent contacts"
ON public.sent_contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sent contacts"
ON public.sent_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sent contacts"
ON public.sent_contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sent contacts"
ON public.sent_contacts FOR DELETE
USING (auth.uid() = user_id);
