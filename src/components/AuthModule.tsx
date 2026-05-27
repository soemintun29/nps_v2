import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, ShieldCheck, User } from 'lucide-react';

export const AuthModule = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedInput = email.trim();
    const trimmedPassword = password.trim();

    // Append default domain ONLY if no '@' is present
    const userEmail = trimmedInput.includes('@') 
      ? trimmedInput 
      : `${trimmedInput}@midea-internal.com`;

    console.log('Attempting login for:', userEmail);

    try {
      const { error: authError, data } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: trimmedPassword,
      });

      if (authError) {
        console.error('Login error details:', authError);
        // Display specific error code for debugging
        setError(`${authError.message} (Code: ${authError.status || 'AuthError'})`);
        throw authError;
      }
      
      console.log('Login successful for:', data.user?.email);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-500">
        <div className="bg-[#003b6d] p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0092d0] rounded-full -mr-16 -mt-16 opacity-20" />
          <div className="relative z-10">
            <span className="text-3xl font-black text-white tracking-tighter uppercase">Midea</span>
            <div className="mt-2 text-[#0092d0] text-[10px] font-black tracking-[0.3em] uppercase">NPS Insight Portal</div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-10 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 text-xs font-bold flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest ml-1">Account ID</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0092d0] transition-colors" />
                <input
                  type="text"
                  placeholder="e.g. nody.shine"
                  className="w-full pl-11 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#0092d0] outline-none font-bold text-gray-700 transition-all placeholder:font-medium placeholder:text-gray-300"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest ml-1">Password</label>
              <div className="relative group">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#0092d0] transition-colors" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#0092d0] outline-none font-bold text-gray-700 transition-all placeholder:font-medium placeholder:text-gray-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-[#003b6d] text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-[#005696] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xs disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Authorize Session
              </>
            )}
          </button>

          <div className="pt-4 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Internal Quality Assurance Access Only</p>
          </div>
        </form>
      </div>
    </div>
  );
};
