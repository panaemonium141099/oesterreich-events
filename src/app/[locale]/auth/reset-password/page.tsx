'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const t = useTranslations('Auth');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('errPasswordMismatchShort'));
      return;
    }
    if (password.length < 6) {
      setError(t('errPasswordMin6'));
      return;
    }

    setLoading(true);
    setError('');

    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/map'), 2000);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">{t('resetSuccessTitle')}</h2>
        <p className="text-white/40 text-sm">{t('resetSuccessText')}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-2">{t('resetTitle')}</h2>
      <p className="text-white/40 text-sm mb-8">{t('resetText')}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('resetNewPlaceholder')}
          required
          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('resetConfirmPlaceholder')}
          required
          className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
        />

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password || !confirmPassword}
          className="w-full py-3.5 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            t('resetSubmit')
          )}
        </button>
      </form>
    </div>
  );
}
