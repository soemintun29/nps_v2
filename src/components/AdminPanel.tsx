import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Key, UserCircle, X, ToggleLeft, ToggleRight, Briefcase } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  email?: string;
}

interface WorkOrder {
  id: string;
  work_order_no: string;
  customer_name: string;
  status: string;
}

export const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [unassignedJobs, setUnassignedJobs] = useState<WorkOrder[]>([]);
  
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    password: '',
    role: 'agent'
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, work_order_no, customer_name, status')
        .is('assigned_to', null)
        .in('status', ['pending', 'issue_resolved']);
      
      if (!error) setUnassignedJobs(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUnassignedJobs();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const email = formData.username.includes('@') ? formData.username : `${formData.username}@midea-internal.com`;

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: formData.password,
        options: { data: { full_name: formData.fullName, role: formData.role } }
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ id: authData.user.id, full_name: formData.fullName, role: formData.role, is_active: true });
        
        if (profileError) throw profileError;
        alert(`User ${formData.username} created!`);
        setIsAdding(false);
        setFormData({ username: '', fullName: '', password: '', role: 'agent' });
        fetchUsers();
      }
    } catch (error: any) {
      alert(`Creation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      fetchUsers();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAssignJob = async (jobId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ assigned_to: userId })
        .eq('id', jobId);
      if (error) throw error;
      alert("Job assigned successfully.");
      fetchUnassignedJobs();
      setAssigningTo(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handlePasswordReset = async (email: string) => {
    if (!email) { alert("No email found."); return; }
    if (!window.confirm(`Send reset link to ${email}?`)) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
      alert(`Instruction sent to ${email}`);
    } catch (error: any) { alert(error.message); }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-[#003b6d] uppercase tracking-tight">Team Management</h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className={`flex items-center px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-lg ${isAdding ? 'bg-red-500 text-white' : 'bg-[#0092d0] text-white hover:bg-[#003b6d]'}`}
        >
          {isAdding ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><UserPlus className="w-4 h-4 mr-2" /> Add New Member</>}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-[#0092d0]/20 animate-in zoom-in-95 duration-200">
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div><label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Username / Email</label><input type="text" className="w-full p-4 bg-gray-50 border-2 rounded-2xl outline-none focus:border-[#0092d0] font-bold" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} required /></div>
              <div><label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Full Name</label><input type="text" className="w-full p-4 bg-gray-50 border-2 rounded-2xl outline-none focus:border-[#0092d0] font-bold" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} required /></div>
            </div>
            <div className="space-y-4">
              <div><label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Initial Password</label><input type="password"  className="w-full p-4 bg-gray-50 border-2 rounded-2xl outline-none focus:border-[#0092d0] font-bold" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required /></div>
              <div><label className="text-[10px] font-black uppercase text-gray-400 mb-1 block">Role</label>
                <div className="flex gap-2">
                  {['agent', 'supervisor'].map(r => <button key={r} type="button" onClick={() => setFormData({...formData, role: r})} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${formData.role === r ? 'bg-[#003b6d] border-[#003b6d] text-white' : 'bg-white text-gray-400'}`}>{r}</button>)}
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading} className="md:col-span-2 py-5 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-green-900/20 hover:bg-green-700 transition-all flex items-center justify-center gap-3">{loading ? 'Provisionsing...' : 'Confirm Provisioning'}</button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Team Member</th>
                <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${user.is_active ? 'bg-blue-50 text-[#003b6d]' : 'bg-gray-100 text-gray-400'}`}><UserCircle className="w-6 h-6" /></div>
                      <div>
                        <p className={`text-sm font-black ${user.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{user.full_name}</p>
                        <p className="text-[10px] font-bold text-[#0092d0] uppercase">{user.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <button 
                      onClick={() => toggleUserStatus(user.id, user.is_active)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase border transition-all ${user.is_active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                    >
                      {user.is_active ? <><ToggleRight className="w-3.5 h-3.5" /> Active</> : <><ToggleLeft className="w-3.5 h-3.5" /> Inactive</>}
                    </button>
                  </td>
                  <td className="px-8 py-6 text-right space-x-2">
                    {user.role === 'agent' && user.is_active && (
                      <button 
                        onClick={() => setAssigningTo(assigningTo === user.id ? null : user.id)}
                        className={`p-3 rounded-xl transition-all shadow-sm ${assigningTo === user.id ? 'bg-[#003b6d] text-white' : 'bg-gray-50 text-[#003b6d] hover:bg-[#0092d0] hover:text-white'}`}
                        title="Assign Job"
                      >
                        <Briefcase className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const email = user.email || `${user.full_name.toLowerCase().replace(/\s+/g, '.')}@midea-internal.com`;
                        handlePasswordReset(email);
                      }}
                      className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-[#0092d0] hover:text-white transition-all shadow-sm" 
                      title="Password Reset"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Modal Overlay */}
      {assigningTo && (
        <div className="fixed inset-0 bg-[#003b6d]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-[#003b6d] text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Assign Dedicated Jobs</h3>
                <p className="text-[10px] font-bold text-[#0092d0] uppercase tracking-widest mt-1">Assigning to: {users.find(u => u.id === assigningTo)?.full_name}</p>
              </div>
              <button onClick={() => setAssigningTo(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {unassignedJobs.length === 0 ? (
                <div className="p-10 text-center text-gray-400"><Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-xs font-black uppercase tracking-widest">No unassigned jobs available.</p></div>
              ) : (
                unassignedJobs.map(job => (
                  <div key={job.id} className="p-4 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-[#0092d0] transition-all flex justify-between items-center group">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase">{job.work_order_no}</p>
                      <p className="text-sm font-black text-gray-800">{job.customer_name}</p>
                    </div>
                    <button 
                      onClick={() => handleAssignJob(job.id, assigningTo)}
                      className="px-4 py-2 bg-[#003b6d] text-white text-[10px] font-black uppercase rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      Assign Now
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
