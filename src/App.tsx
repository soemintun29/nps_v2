import { useState, useEffect } from 'react';
import { SupervisorModule } from './components/SupervisorModule';
import { AgentModule } from './components/AgentModule';
import { AuthModule } from './components/AuthModule';
import { LayoutDashboard, RefreshCw, LogOut, User as UserIcon } from 'lucide-react';
import { supabase } from './lib/supabase';

export interface Call {
  id: string;
  customerName: string;
  phone: string;
  phone2?: string;
  address?: string;
  productModel?: string;
  product: string;
  warranty?: string;
  totalFee?: string;
  brand?: string;
  solution?: string;
  remark?: string;
  escalationNote?: string;
  technicianName?: string;
  newWorkOrderNo?: string;
  newSolution?: string;
  newTechnicianAssigned?: string;
  status?: string;
  attempts: number;
  lastAttemptAt?: string;
  callbackAt?: string;
  scheduledDate?: string;
  serviceCenter?: string;
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [allWorkOrderIds, setAllWorkOrderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = async (currentSession: any) => {
    if (!currentSession?.user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    try {
      const userEmail = currentSession.user.email?.toLowerCase() || '';
      const supervisorEmails = [
        'mrsoemintun@gmail.com',
        'yinmyothu@vsk.com.mm',
        'winlai.mon@vsk.com.mm',
        'soemintun@vsk.com.mm',
        'ygnmideacare@vsk.com.mm'
      ];
      const isMasterSupervisor = supervisorEmails.includes(userEmail);

      console.log('Fetching profile for:', userEmail, 'with ID:', currentSession.user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id);
      
      if (error) {
        console.error('Supabase profile query error:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const userProfile = data[0];
        console.log('Profile loaded from DB:', userProfile.full_name);
        
        // If full_name is missing/null in DB, generate it from email
        if (!userProfile.full_name) {
          const generatedName = userEmail.split('@')[0]
            .split('.')
            .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(' ');
          userProfile.full_name = generatedName;
          console.log('DB name was null, using generated:', generatedName);
        }

        setProfile(isMasterSupervisor ? { ...userProfile, role: 'supervisor' } : userProfile);
      } else {
        console.warn('No profile found in DB for ID:', currentSession.user.id);
        // Fallback: Generate name from email
        let generatedName = userEmail.split('@')[0];
        
        if (generatedName.includes('.')) {
          generatedName = generatedName.split('.')
            .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(' ');
        } else {
          generatedName = generatedName.charAt(0).toUpperCase() + generatedName.slice(1);
          if (generatedName.toLowerCase() === 'yinmyothu') generatedName = 'Yin Myo Thu';
        }
        
        const mockProfile = { 
          id: currentSession.user.id, 
          full_name: generatedName, 
          role: isMasterSupervisor ? 'supervisor' : 'agent',
          email: userEmail 
        };
        
        console.log('Using generated profile:', mockProfile.full_name);
        setProfile(mockProfile);

        // Background sync
        supabase.from('profiles').upsert(mockProfile).then(({ error }) => {
          if (error) console.warn('Sync error:', error.message);
        });
      }
    } catch (err) {
      console.error('Fatal fetch error:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchCalls = async (profileOverride?: any) => {
    const currentProfile = profileOverride || profile;
    if (!session || !currentProfile) return;
    
    setLoading(true);
    try {
      const isAgent = currentProfile.role?.toLowerCase() === 'agent';
      
      let query = supabase
        .from('work_orders')
        .select('*')
        .in('status', ['pending', 'issue_resolved', 'callback'])
        .order('created_at', { ascending: false });

      // If agent, only show assigned work orders
      if (isAgent) {
        query = query.eq('assigned_to', currentProfile.id);
      }

      const { data: pendingData, error: pendingError } = await query;

      if (pendingError) throw pendingError;

      const { data: allIdsData, error: allIdsError } = await supabase
        .from('work_orders')
        .select('work_order_no');

      if (allIdsError) throw allIdsError;

      if (pendingData) {
        // Filter out escalated calls from the agent's queue. 
        // Status 'callback' should only show for agents if it's a standard line-drop (no escalation note).
        const mappedCalls: Call[] = pendingData
          .filter(item => item.status !== 'callback' || !item.escalation_note)
          .map(item => ({
            id: item.work_order_no,
            customerName: item.customer_name,
            phone: item.customer_phone,
            phone2: item.customer_phone2,
            address: item.address,
            productModel: item.product_model,
            product: item.product_type,
            warranty: item.warranty,
            totalFee: item.total_fee,
            brand: item.brand,
            solution: item.solution,
            remark: item.remark,
            escalationNote: item.escalation_note,
            technicianName: item.technician_name,
            newWorkOrderNo: item.new_work_order_no,
            newSolution: item.new_solution,
            newTechnicianAssigned: item.new_technician_assigned,
            status: item.status,
            attempts: item.attempts || 0,
            lastAttemptAt: item.last_attempt_at,
            callbackAt: item.callback_at,
            scheduledDate: item.scheduled_date,
            serviceCenter: item.service_center
          }));
        setCalls(mappedCalls);
      }
      if (allIdsData) setAllWorkOrderIds(allIdsData.map(item => item.work_order_no));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) fetchProfile(currentSession);
      else setProfileLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) fetchProfile(currentSession);
      else {
        setProfile(null);
        setProfileLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && profile) {
      fetchCalls();
    }
  }, [session, profile]);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#003b6d]/10 border-t-[#003b6d] rounded-full animate-spin" />
          <p className="text-[10px] font-black text-[#003b6d] uppercase tracking-widest">Accessing Secure Gateway...</p>
        </div>
      </div>
    );
  }

  if (!session) return <AuthModule />;

  const isSupervisor = profile?.role?.toLowerCase() === 'supervisor';

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-[#003b6d] text-white shadow-lg sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-2xl font-black tracking-tighter mr-2">Midea</span>
              <span className="text-[10px] font-black border-l border-white/20 pl-2 uppercase tracking-widest text-[#0092d0]">NPS Portal</span>
            </div>
            
            <nav className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                <UserIcon className="w-3.5 h-3.5 text-[#0092d0]" />
                <span className="text-[10px] font-black uppercase tracking-tighter">{profile?.full_name || session.user.email?.split('@')[0]}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${isSupervisor ? 'bg-red-500' : 'bg-[#0092d0]'}`}>{profile?.role}</span>
              </div>

              <button onClick={fetchCalls} disabled={loading} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button 
                onClick={() => supabase.auth.signOut()} 
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 print:p-0 print:max-w-none">
        <div className="mb-8 print:hidden">
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
            <LayoutDashboard className="w-3 h-3" />
            <span>{isSupervisor ? 'Management Control' : 'Agent Operations'} / Dashboard</span>
          </div>
          <h1 className="text-3xl font-black text-[#1e293b] uppercase tracking-tight">
            {isSupervisor ? 'Command Center' : 'Happy Call Queue'}
          </h1>
        </div>

        {isSupervisor ? (
          <SupervisorModule onUploadSuccess={fetchCalls} existingWorkOrders={allWorkOrderIds} />
        ) : (
          <AgentModule 
            calls={calls} 
            onRefresh={fetchCalls} 
            agentName={profile?.full_name} 
          />
        )}
      </main>

      <footer className="mt-auto py-6 border-t bg-white print:hidden">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-300 text-[9px] font-bold uppercase tracking-widest">
          © 2026 Midea Global Quality Assurance • Authorized Personnel Only
        </div>
      </footer>
    </div>
  );
}

export default App;
