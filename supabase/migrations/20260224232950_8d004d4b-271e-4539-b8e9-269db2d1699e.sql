
-- Drop existing contacts policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can manage their own contacts" ON public.contacts;

-- Only admins can view contacts
CREATE POLICY "Only admins can view contacts"
ON public.contacts FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Only admins can insert contacts
CREATE POLICY "Only admins can insert contacts"
ON public.contacts FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = user_id);

-- Only admins can update contacts
CREATE POLICY "Only admins can update contacts"
ON public.contacts FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Only admins can delete contacts
CREATE POLICY "Only admins can delete contacts"
ON public.contacts FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Same for sent_contacts
DROP POLICY IF EXISTS "Users can view their own sent contacts" ON public.sent_contacts;
DROP POLICY IF EXISTS "Users can insert their own sent contacts" ON public.sent_contacts;
DROP POLICY IF EXISTS "Users can update their own sent contacts" ON public.sent_contacts;
DROP POLICY IF EXISTS "Users can delete their own sent contacts" ON public.sent_contacts;

CREATE POLICY "Only admins can view sent contacts"
ON public.sent_contacts FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can insert sent contacts"
ON public.sent_contacts FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Only admins can update sent contacts"
ON public.sent_contacts FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete sent contacts"
ON public.sent_contacts FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
