import { useState, useEffect } from 'react';
import { SupervisorModule } from './components/SupervisorModule';
import { AgentModule } from './components/AgentModule';
import { LayoutDashboard, Users, ClipboardCheck, RefreshCw } from 'lucide-react';
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
}

function App() {
  const [activeTab, setActiveTab] = useState<'agent' | 'supervisor'>('agent');
  const [calls, setCalls] = useState<Call[]>([]);
  const [allWorkOrderIds, setAllWorkOrderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCalls = async () => {
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
          status: item.status
        }));
        setCalls(mappedCalls);
      }

      if (allIdsData) {
        setAllWorkOrderIds(allIdsData.map(item => item.work_order_no));
      }
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Sidebar / Header */}
      <header className="bg-[#003b6d] text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-2xl font-black tracking-tighter mr-2">Midea</span>
              <span className="text-sm font-medium border-l border-white/20 pl-2 uppercase tracking-widest text-[#0092d0]">NPS Survey</span>
            </div>
            
            <nav className="flex space-x-4">
              <button
                onClick={fetchCalls}
                disabled={loading}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Refresh Data"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setActiveTab('agent')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'agent' ? 'bg-[#0092d0] text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Agent
              </button>
              <button
                onClick={() => setActiveTab('supervisor')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'supervisor' ? 'bg-[#0092d0] text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Users className="w-4 h-4 mr-2" />
                Supervisor
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard / {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Module</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#1e293b]">
            {activeTab === 'agent' ? 'Happy Call Workflow' : 'Call Management & Analytics'}
          </h1>
        </div>

        {activeTab === 'agent' ? (
          <AgentModule calls={calls} onRefresh={fetchCalls} />
        ) : (
          <SupervisorModule onUploadSuccess={fetchCalls} existingWorkOrders={allWorkOrderIds} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-xs">
          © 2026 Midea Global - Internal Quality Assurance Tool
        </div>
      </footer>
    </div>
  );
}

export default App;
