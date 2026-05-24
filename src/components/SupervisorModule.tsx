import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { Upload, ListFilter, Download, AlertCircle, CheckCircle2, Settings, BarChart3, ChevronRight } from 'lucide-react';
import { AdminPanel } from './AdminPanel';
import { ExecutiveDashboard } from './ExecutiveDashboard';

interface CSVData {
  [key: string]: string;
}

interface SupervisorModuleProps {
  onUploadSuccess: () => void;
  existingWorkOrders: string[];
}

interface EscalatedCall {
  id: string;
  work_order_no: string;
  customer_name: string;
  customer_phone: string;
  product_type: string;
  technician_name: string;
  service_center: string;
  escalation_note: string;
  voice_of_technician: string;
  internal_remark: string;
  new_technician_assigned: string;
  new_work_order_no: string;
  new_solution: string;
  status: string;
  created_at: string;
}

interface CompletedCall {
  id: string;
  work_order_no: string;
  customer_name: string;
  product_type: string;
  product_model: string;
  customer_phone: string;
  customer_phone2: string;
  address: string;
  technician_name: string;
  service_center: string;
  new_technician_assigned: string;
  new_work_order_no: string;
  new_solution: string;
  nps_score: number;
  is_working: boolean;
  verbatim: string;
  driver_l1: string;
  driver_l2: string;
  created_at: string;
  completed_date: string;
  status: string;
  agent_name: string;
}

const ESCALATION_STATUSES = [
  { id: 'callback', label: 'Complaint Received' },
  { id: 'finding_root_cause', label: 'Finding Root Cause' },
  { id: 'internal_discussion', label: 'Internal Discussion' },
  { id: 'waiting_parts', label: 'Waiting Parts' },
  { id: 'technician_assigned', label: 'Assign New Technician' },
  { id: 'visit_scheduled', label: 'Schedule to Visit' },
  { id: 'issue_resolved', label: 'Resolved (Ready for NPS)' },
];

export const SupervisorModule: React.FC<SupervisorModuleProps> = ({ onUploadSuccess, existingWorkOrders }) => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'upload' | 'completed' | 'escalation' | 'resolved_esc' | 'admin'>('dashboard');
  const [data, setData] = useState<CSVData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [completedCalls, setCompletedCalls] = useState<CompletedCall[]>([]);
  const [escalatedCalls, setEscalatedCalls] = useState<EscalatedCall[]>([]);
  const [resolvedEscCalls, setResolvedEscCalls] = useState<EscalatedCall[]>([]);
  const [editingCase, setEscEditingCase] = useState<string | null>(null);
  const [escFormData, setEscFormData] = useState({
    voice: '', remark: '', newTech: '', newWO: '', newSol: '', status: ''
  });
  const [mapping, setMapping] = useState({
    callId: '', customerName: '', phone: '', customerPhone2: '', address: '',
    productModel: '', product: '', warranty: '', totalFee: '', solution: '',
    remark: '', repairDate: '', scheduledDate: '', technicianName: '', serviceCenter: '',
  });

  // Helper to convert DD/MM/YYYY to YYYY-MM-DD
  const formatDbDate = (val: string) => {
    if (!val) return null;
    const parts = val.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return val; // Fallback if already standard
  };

  const fetchCompletedCalls = async () => {
    setLoading(true);
    try {
      const { data: results, error } = await supabase
        .from('surveys')
        .select(`
          id, survey_work_order_no, nps_score, is_working, verbatim, driver_l1, driver_l2, created_at, agent_id,
          work_orders (
            customer_name, product_type, product_model, customer_phone, customer_phone2, address,
            technician_name, service_center, new_technician_assigned, new_work_order_no, new_solution,
            status, completed_date
          )
        `)
        .in('work_orders.status', ['completed', 'escalation_completed', 'callback']) 
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (results) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name');
        const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p.full_name]) || []);
        const flattened: CompletedCall[] = results
          .filter((item: any) => item.work_orders !== null)
          .map((item: any) => ({
            id: item.id,
            work_order_no: item.survey_work_order_no || 'N/A',
            customer_name: item.work_orders.customer_name,
            product_type: item.work_orders.product_type,
            product_model: item.work_orders.product_model,
            customer_phone: item.work_orders.customer_phone,
            customer_phone2: item.work_orders.customer_phone2,
            address: item.work_orders.address,
            technician_name: item.work_orders.technician_name,
            service_center: item.work_orders.service_center,
            new_technician_assigned: item.work_orders.new_technician_assigned,
            new_work_order_no: item.work_orders.new_work_order_no,
            new_solution: item.work_orders.new_solution,
            nps_score: item.nps_score,
            is_working: item.is_working,
            verbatim: item.verbatim,
            driver_l1: item.driver_l1,
            driver_l2: item.driver_l2 || '',
            created_at: item.created_at,
            completed_date: item.work_orders.completed_date,
            status: item.work_orders.status,
            agent_name: profileMap[item.agent_id] || 'System'
          }));
        setCompletedCalls(flattened);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchEscalatedCalls = async () => {
    setLoading(true);
    try {
      const { data: results, error } = await supabase.from('work_orders').select('*')
        .not('status', 'in', '("pending","completed","refused","issue_resolved","escalation_completed")')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEscalatedCalls(results || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchResolvedEscalations = async () => {
    setLoading(true);
    try {
      const { data: results, error } = await supabase.from('work_orders').select('*')
        .in('status', ['issue_resolved', 'escalation_completed'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setResolvedEscCalls(results || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const updateEscalationCase = async (id: string) => {
    try {
      const { error } = await supabase.from('work_orders').update({
        voice_of_technician: escFormData.voice,
        internal_remark: escFormData.remark,
        new_technician_assigned: escFormData.newTech,
        new_work_order_no: escFormData.newWO,
        new_solution: escFormData.newSol,
        status: escFormData.status
      }).eq('id', id);
      if (error) throw error;
      alert('Case updated.');
      setEscEditingCase(null);
      fetchEscalatedCalls();
      onUploadSuccess(); 
    } catch (error: any) { alert(error.message); }
  };

  useEffect(() => {
    if (activeSubTab === 'completed' || activeSubTab === 'dashboard') fetchCompletedCalls();
    if (activeSubTab === 'escalation') fetchEscalatedCalls();
    if (activeSubTab === 'resolved_esc') fetchResolvedEscalations();
  }, [activeSubTab]);

  const resetState = () => {
    setData([]); setHeaders([]);
    setMapping({ callId: '', customerName: '', phone: '', customerPhone2: '', address: '', productModel: '', product: '', warranty: '', totalFee: '', solution: '', remark: '', repairDate: '', scheduledDate: '', technicianName: '', serviceCenter: '', });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => {
      if (results.data.length > 0) { setHeaders(Object.keys(results.data[0] as object)); setData(results.data as CSVData[]); }
    }});
  };

  const handleConfirm = async () => {
    if (!mapping.callId || !mapping.customerName || !mapping.phone || !mapping.product || !mapping.serviceCenter || !mapping.technicianName) {
      alert('Missing required mapping: Work Order No, Customer Name, Phone, Product, Service Center, and Technician Name are all MANDATORY.'); 
      return; 
    }
    setLoading(true);
    let mappedData = data.map((row) => ({
      work_order_no: row[mapping.callId]?.trim(),
      customer_name: row[mapping.customerName],
      customer_phone: row[mapping.phone],
      customer_phone2: row[mapping.customerPhone2],
      address: row[mapping.address],
      product_model: row[mapping.productModel],
      product_type: row[mapping.product],
      warranty: row[mapping.warranty],
      total_fee: row[mapping.totalFee] ? parseFloat(row[mapping.totalFee].toString().replace(/[^0-9.]/g, '')) : 0,
      solution: row[mapping.solution],
      remark: row[mapping.remark],
      repair_date: formatDbDate(row[mapping.repairDate]),
      scheduled_date: formatDbDate(row[mapping.scheduledDate]),
      technician_name: row[mapping.technicianName] || '',
      service_center: row[mapping.serviceCenter] || '',
      status: 'pending'
    })).filter(item => item.work_order_no);

    const uniqueInCSV = Array.from(new Set(mappedData.map(d => d.work_order_no))).map(id => mappedData.find(d => d.work_order_no === id)!);
    const finalDataToUpload = uniqueInCSV.filter(item => !existingWorkOrders.includes(item.work_order_no));
    try {
      const { error } = await supabase.from('work_orders').insert(finalDataToUpload);
      if (error) throw error;
      alert(`Uploaded ${finalDataToUpload.length} cases.`); resetState(); onUploadSuccess();
    } catch (error: any) { alert(`Upload failed: ${error.message}`); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'dashboard', icon: BarChart3, label: 'DASHBOARD' },
          { id: 'upload', icon: Upload, label: 'CSV UPLOAD' },
          { id: 'completed', icon: ListFilter, label: 'COMPLETED CALLS' },
          { id: 'escalation', icon: AlertCircle, label: 'ESCALATION MGMT' },
          { id: 'resolved_esc', icon: CheckCircle2, label: 'RESOLVED ESC.' },
          { id: 'admin', icon: Settings, label: 'ADMIN PANEL' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)} className={`flex items-center px-4 py-2 rounded-md text-[10px] font-black tracking-widest transition-all ${activeSubTab === tab.id ? 'bg-white text-[#003b6d] shadow-sm' : 'text-gray-500'}`}>
            <tab.icon className="w-3.5 h-3.5 mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'dashboard' ? (
        <ExecutiveDashboard completedCalls={completedCalls} />
      ) : activeSubTab === 'upload' ? (
        <div className="p-6 bg-white rounded-xl shadow-md space-y-6">
          <h2 className="text-2xl font-black text-[#003b6d] uppercase tracking-tight">Data Ingestion</h2>
          {data.length === 0 ? (
            <div className="relative overflow-hidden border-4 border-dashed p-16 rounded-3xl items-center bg-gray-50/50 flex flex-col">
              <Upload className="w-10 h-10 text-[#0092d0] mb-4" /><input type="file" accept=".csv" onChange={handleFileUpload} className="opacity-0 absolute inset-0 cursor-pointer z-10" />
              <button className="px-8 py-3 bg-[#003b6d] text-white rounded-full font-bold text-sm">Browse CSV File</button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 bg-[#f4fbff] p-6 rounded-2xl border">
                {Object.keys(mapping).map((field) => (
                  <div key={field} className="flex flex-col">
                    <label className="text-[10px] font-black uppercase text-[#003b6d]/60 mb-2">
                      {field === 'callId' ? 'Work Order No' : 
                       field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      {['callId', 'customerName', 'phone', 'product', 'serviceCenter', 'technicianName', 'repairDate', 'scheduledDate'].includes(field) && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <select 
                      className="p-2.5 text-[10px] font-bold border-2 rounded-xl bg-white focus:border-[#0092d0] outline-none appearance-none" 
                      value={(mapping as any)[field]} 
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    >
                      <option value="">-- SELECT --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button onClick={handleConfirm} disabled={loading} className="w-full py-5 bg-[#003b6d] text-white font-black uppercase rounded-2xl shadow-2xl">{loading ? 'Syncing...' : 'Confirm & Sync Database'}</button>
            </div>
          )}
        </div>
      ) : activeSubTab === 'completed' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-[#003b6d] uppercase tracking-tight">Survey Performance Report</h2>
            <button onClick={() => {
              const csvHeaders = ['Work Order', 'Customer', 'Phone', 'Phone 2', 'Address', 'Product', 'Model', 'Technician', 'Service Center', 'Agent', 'NPS', 'Status', 'L1 Categories', 'L2 Details', 'Verbatim Comment', 'Survey Start Date', 'Completed Date Time'];
              const csvRows = completedCalls.map(c => [
                c.work_order_no, c.customer_name, c.customer_phone, c.customer_phone2 || 'N/A', `"${c.address}"`, c.product_type, c.product_model, c.technician_name, c.service_center, c.agent_name, c.nps_score, c.is_working ? 'Fixed' : 'Failed', `"${c.driver_l1}"`, `"${c.driver_l2}"`, `"${c.verbatim}"`, new Date(c.created_at).toLocaleDateString(), c.completed_date ? new Date(c.completed_date).toLocaleString() : 'N/A'
              ]);
              const csvContent = [csvHeaders, ...csvRows].map(r => r.join(',')).join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `nps_master_report_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            }} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold shadow-lg"><Download className="w-4 h-4 mr-2" />Export Master Report</button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-[11px]">
              <thead className="bg-gray-50/50">
                <tr><th className="px-4 py-4 text-left font-black text-gray-400 uppercase tracking-widest">Job Metadata</th><th className="px-4 py-4 text-left font-black text-gray-400 uppercase tracking-widest">Agent & Timing</th><th className="px-4 py-4 text-left font-black text-gray-400 uppercase tracking-widest">Tech & Branch</th><th className="px-4 py-4 text-left font-black text-gray-400 uppercase tracking-widest">NPS Result</th><th className="px-4 py-4 text-left font-black text-gray-400 uppercase tracking-widest">Feedback Details</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {completedCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-4"><p className="font-black text-[#003b6d]">{call.work_order_no}</p><p className="font-bold text-gray-500 uppercase">{call.customer_name}</p><p className="text-[9px] text-gray-400">{call.product_type} ({call.product_model})</p></td>
                    <td className="px-4 py-4 font-bold text-gray-600"><div>Agent: {call.agent_name}</div><div className="text-[9px] text-gray-400 mt-1 uppercase">Done: {call.completed_date ? new Date(call.completed_date).toLocaleString() : 'N/A'}</div></td>
                    <td className="px-4 py-4 font-bold text-gray-600"><div>{call.technician_name}</div><div className="text-[9px] text-[#0092d0] uppercase">{call.service_center}</div></td>
                    <td className="px-4 py-4"><span className={`px-2 py-0.5 rounded-full font-black text-white ${call.nps_score >= 9 ? 'bg-green-500' : call.nps_score >= 7 ? 'bg-yellow-500' : 'bg-red-500'}`}>NPS {call.nps_score}</span>{call.status === 'escalation_completed' && <span className="block mt-1 text-[8px] font-black text-red-500 uppercase tracking-tighter">RE-CALL SUCCESS</span>}</td>
                    <td className="px-4 py-4 max-w-[250px]"><p className="italic text-gray-500 line-clamp-2">"{call.verbatim}"</p><div className="flex flex-wrap gap-1 mt-1">{call.driver_l1.split(', ').map(l1 => <span key={l1} className="text-[8px] bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-bold uppercase">{l1}</span>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeSubTab === 'resolved_esc' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center"><h2 className="text-2xl font-black text-green-600 uppercase tracking-tight">Resolved Escalations</h2></div>
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 text-xs">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50"><tr><th className="px-6 py-4 text-left uppercase tracking-widest font-black text-gray-400">Customer</th><th className="px-6 py-4 text-left uppercase tracking-widest font-black text-gray-400">Recovery Info</th><th className="px-6 py-4 text-left uppercase tracking-widest font-black text-gray-400">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {resolvedEscCalls.map((call) => (
                  <tr key={call.id}>
                    <td className="px-6 py-4"><p className="font-black text-[#003b6d]">{call.customer_name}</p><p className="text-[10px] text-gray-400 uppercase">Original WO: {call.work_order_no}</p></td>
                    <td className="px-6 py-4"><p className="font-bold text-[#0092d0]">New WO: {call.new_work_order_no}</p><p className="text-[10px] text-gray-500">Tech: {call.new_technician_assigned}</p></td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full font-black uppercase text-[9px] text-white ${call.status === 'escalation_completed' ? 'bg-green-600' : 'bg-amber-500'}`}>{call.status === 'escalation_completed' ? 'Final NPS Done' : 'Waiting for NPS Call'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeSubTab === 'admin' ? (
        <AdminPanel />
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
          <div className="flex justify-between items-center"><h2 className="text-2xl font-black text-red-600 uppercase tracking-tight">Escalation Management</h2><div className="bg-red-50 px-4 py-2 rounded-full border border-red-100 text-red-600 text-xs font-bold">{escalatedCalls.length} Active Cases</div></div>
          <div className="grid grid-cols-1 gap-6">
            {escalatedCalls.map((call) => (
              <div key={call.id} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row">
                <div className="p-6 md:w-1/3 bg-gray-50 border-r border-gray-100"><div className="flex justify-between items-start mb-4"><div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">{call.work_order_no}</p><h3 className="text-lg font-black text-[#003b6d]">{call.customer_name}</h3><p className="text-sm font-bold text-[#0092d0]">{call.product_type}</p></div><div className="px-3 py-1 bg-red-500 text-white rounded-full text-[9px] font-black uppercase">{call.status}</div></div><div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm text-xs text-red-900 font-medium italic">"{call.escalation_note}"</div></div>
                <div className="p-8 flex-1 space-y-6">
                  {editingCase === call.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Voice of Tech</label><textarea className="w-full p-3 text-xs border-2 rounded-xl h-24" value={escFormData.voice} onChange={(e) => setEscFormData({...escFormData, voice: e.target.value})} /></div>
                        <div><label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Supervisor Remark</label><textarea className="w-full p-3 text-xs border-2 rounded-xl h-24" value={escFormData.remark} onChange={(e) => setEscFormData({...escFormData, remark: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">New Tech</label><input className="w-full p-3 text-xs font-bold border-2 rounded-xl" value={escFormData.newTech} onChange={(e) => setEscFormData({...escFormData, newTech: e.target.value})} /></div>
                        <div><label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">New WO</label><input className="w-full p-3 text-xs font-bold border-2 rounded-xl" value={escFormData.newWO} onChange={(e) => setEscFormData({...escFormData, newWO: e.target.value})} /></div>
                        <div><label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Status</label><select className="w-full p-3 text-xs font-bold border-2 rounded-xl bg-white" value={escFormData.status} onChange={(e) => setEscFormData({...escFormData, status: e.target.value})}><option value="">-- SELECT --</option>{ESCALATION_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
                      </div>
                      <div><label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">New Fix Solution</label><textarea className="w-full p-3 text-xs border-2 rounded-xl h-20" value={escFormData.newSol} onChange={(e) => setEscFormData({...escFormData, newSol: e.target.value})} /></div>
                      <div className="flex gap-3 pt-2"><button onClick={() => updateEscalationCase(call.id)} className="flex-1 py-4 bg-[#003b6d] text-white rounded-2xl font-black uppercase text-[10px]">Save & Sync</button><button onClick={() => setEscEditingCase(null)} className="px-8 py-4 border-2 border-gray-100 rounded-2xl font-bold text-gray-400 text-[10px] uppercase">Cancel</button></div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col justify-between"><div className="grid grid-cols-2 gap-6"><div><p className="text-[10px] font-black text-[#003b6d]/40 uppercase mb-3">Escalation Progress</p><div className="space-y-4"><div><p className="text-[9px] font-black text-gray-500 uppercase">Voice of Tech</p><p className="text-xs text-gray-700">{call.voice_of_technician || '-'}</p></div><div><p className="text-[9px] font-black text-gray-500 uppercase">Supervisor Remarks</p><p className="text-xs text-gray-700">{call.internal_remark || '-'}</p></div></div></div><div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50"><p className="text-[9px] font-black text-[#0092d0] uppercase mb-3">Resolution Plan</p><div className="space-y-2"><p className="text-xs font-bold text-gray-600">New Tech: <span className="text-[#003b6d]">{call.new_technician_assigned || '-'}</span></p><p className="text-xs font-bold text-gray-600">New WO: <span className="text-[#003b6d]">{call.new_work_order_no || '-'}</span></p></div></div></div><button onClick={() => { setEscEditingCase(call.id); setEscFormData({ voice: call.voice_of_technician || '', remark: call.internal_remark || '', newTech: call.new_technician_assigned || '', newWO: call.new_work_order_no || '', newSol: call.new_solution || '', status: call.status || '' }); }} className="mt-8 w-full py-4 bg-white border-2 border-[#003b6d] text-[#003b6d] rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#003b6d] hover:text-white transition-all flex items-center justify-center gap-2 group">Update Lifecycle <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></button></div>
                  )}
                </div>
              </div>
            ))
          }</div>
        </div>
      )}
    </div>
  );
};
