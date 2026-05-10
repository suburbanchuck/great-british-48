import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const email = data.user.email ?? '';
      const allowed = (process.env.ALLOWED_EMAILS ?? '')
        .split(',')
        .map(e => e.trim().toLowerCase());

      if (!allowed.includes(email.toLowerCase())) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/?error=not_invited`);
      }

      return NextResponse.redirect(origin);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
