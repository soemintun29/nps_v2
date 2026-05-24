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
  solution?: string;
  remark?: string;
  escalationNote?: string;
  technicianName?: string;
  newWorkOrderNo?: string;
  newSolution?: string;
  newTechnicianAssigned?: string;
  status?: string;
  attempts: number;
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchProfile();
    } else {
      setProfile(null);
      setProfileLoading(false);
    }
  }, [session]);

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      // 1. Force identify Supervisor by email (Master Override)
      const userEmail = session.user.email?.toLowerCase() || '';
      const isMasterSupervisor = userEmail.includes('winlai.mon') || 
                                 userEmail.includes('mrsoemintun@gmail.com') ||
                                 userEmail.includes('soemintun@vsk.com.mm');

      // 2. Fetch profile from DB
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (!error && data) {
        // If master email, ensure role is supervisor even if DB says otherwise
        if (isMasterSupervisor) {
          setProfile({ ...data, role: 'supervisor' });
        } else {
          setProfile(data);
        }
      } else {
        // 3. Fallback: Create or Mock Profile
        const name = userEmail.split('@')[0].replace('.', ' ');
        const role = isMasterSupervisor ? 'supervisor' : 'agent';
        
        const mockProfile = { id: session.user.id, full_name: name, role: role };
        setProfile(mockProfile);

        // Try to save to DB in background
        supabase.from('profiles').upsert(mockProfile).then(({ error }) => {
          if (error) console.warn('Background profile sync failed:', error.message);
        });
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchCalls = async () => {
    if (!session) return;
    setLoading(true);
    try {
      // 1. Fetch pending calls AND issues resolved by supervisor for the Agent queue
      const { data: pendingData, error: pendingError } = await supabase
        .from('work_orders')
        .select('*')
        .in('status', ['pending', 'issue_resolved'])
        .order('created_at', { ascending: false });

      if (pendingError) throw pendingError;

      // 2. Fetch ALL work order numbers for Supervisor deduplication
      const { data: allIdsData, error: allIdsError } = await supabase
        .from('work_orders')
        .select('work_order_no');

      if (allIdsError) throw allIdsError;

      if (pendingData) {
        const mappedCalls: Call[] = pendingData.map(item => ({
          id: item.work_order_no,
          customerName: item.customer_name,
          phone: item.customer_phone,
          phone2: item.customer_phone2,
          address: item.address,
          productModel: item.product_model,
          product: item.product_type,
          warranty: item.warranty,
          totalFee: item.total_fee,
          solution: item.solution,
          remark: item.remark,
          escalationNote: item.escalation_note,
          technicianName: item.technician_name,
          newWorkOrderNo: item.new_work_order_no,
          newSolution: item.new_solution,
          newTechnicianAssigned: item.new_technician_assigned,
          status: item.status,
          attempts: item.attempts || 0,
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
    if (session) fetchCalls();
  }, [session]);

  if (!session) return <AuthModule />;
  
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#003b6d]/10 border-t-[#003b6d] rounded-full animate-spin" />
          <p className="text-xs font-black text-[#003b6d] uppercase tracking-widest">Accessing Secure Gateway...</p>
        </div>
      </div>
    );
  }

  const isSupervisor = profile?.role?.toLowerCase() === 'supervisor';
  
  if (session && profile) {
    console.log('Active Session User:', session.user.email);
    console.log('Fetched Profile Role:', profile.role);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-[#003b6d] text-white shadow-lg sticky top-0 z-50">
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

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
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
          <AgentModule calls={calls} onRefresh={fetchCalls} />
        )}
      </main>

      <footer className="mt-auto py-6 border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-300 text-[9px] font-bold uppercase tracking-widest">
          © 2026 Midea Global Quality Assurance • Authorized Personnel Only
        </div>
      </footer>
    </div>
  );
}

export default App;
