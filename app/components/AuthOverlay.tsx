'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AuthOverlay() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'not_invited') {
      setError('This app is private. Only Gelly & Charlie can sign in.');
      window.history.replaceState({}, '', '/');
    } else if (params.get('error')) {
      setError('Something went wrong. Please try again.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  async function handleSignIn() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-4 py-2 rounded-xl shadow whitespace-nowrap">
          {error}
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-lg px-5 py-3 flex items-center gap-3">
        <span
          className="text-sm text-gray-500 font-[family-name:var(--font-overpass)]"
          style={{ letterSpacing: '0.04em' }}
        >
          Sign in to log stays
        </span>
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl px-4 py-2 transition-colors disabled:opacity-50"
        >
          <GoogleIcon />
          {loading ? 'Signing in…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
