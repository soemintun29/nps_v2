import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { Upload, ListFilter, Download, AlertCircle, CheckCircle2, Settings, BarChart3, ChevronRight, UserCircle2, Search } from 'lucide-react';
import { AdminPanel } from './AdminPanel';
import { ExecutiveDashboard } from './ExecutiveDashboard';
import { TechnicianScorecard } from './TechnicianScorecard';
import { CsvTemplates } from './CsvTemplates';
import { getAttemptLabel } from '../lib/utils';

interface CSVData {
  [key: string]: string;
}

interface SupervisorModuleProps {
  onUploadSuccess: () => Promise<void>;
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
  attempts: number;
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
  compliance_uniform: boolean;
  compliance_politeness: boolean;
  compliance_explanation: boolean;
  compliance_cleanup: boolean;
  compliance_receipt: boolean;
  status: string;
  agent_name: string;
  attempts: number;
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
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'upload' | 'completed' | 'escalation' | 'resolved_esc' | 'tech_scorecard' | 'admin'>('dashboard');
  const [data, setData] = useState<CSVData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [completedCalls, setCompletedCalls] = useState<CompletedCall[]>([]);
  const [allCalls, setAllCalls] = useState<any[]>([]);
  const [escalatedCalls, setEscalatedCalls] = useState<EscalatedCall[]>([]);
  const [resolvedEscCalls, setResolvedEscCalls] = useState<EscalatedCall[]>([]);
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [techSearch, setTechSearch] = useState('');
  
  const [editingCase, setEscEditingCase] = useState<string | null>(null);
  const [escFormData, setEscFormData] = useState({
    voice: '', remark: '', newTech: '', newWO: '', newSol: '', status: ''
  });
  const [mapping, setMapping] = useState({
    callId: '', customerName: '', phone: '', customerPhone2: '', address: '',
    productModel: '', product: '', warranty: '', totalFee: '', brand: '', assignedAgent: '', solution: '',
    remark: '', repairDate: '', scheduledDate: '', technicianName: '', serviceCenter: '',
  });

  const formatDbDate = (val: string) => {
    if (!val) return null;
    const parts = val.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return val;
  };

  const fetchCompletedCalls = async () => {
    setLoading(true);
    try {
      const { data: results, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          surveys (
            id, nps_score, is_working, verbatim, driver_l1, driver_l2, created_at, agent_id,
            compliance_uniform, compliance_politeness, compliance_explanation, compliance_cleanup, compliance_receipt
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (results) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name');
        const profileMap = Object.fromEntries(profiles?.map(p => [p.id, p.full_name]) || []);
        
        const flattened = results.map((item: any) => {
          const survey = item.surveys?.[0];
          return {
            id: survey?.id || item.id,
            work_order_id: item.id,
            work_order_no: item.work_order_no,
            customer_name: item.customer_name,
            product_type: item.product_type,
            product_model: item.product_model,
            customer_phone: item.customer_phone,
            customer_phone2: item.customer_phone2,
            address: item.address,
            technician_name: item.technician_name,
            service_center: item.service_center,
            new_technician_assigned: item.new_technician_assigned,
            new_work_order_no: item.new_work_order_no,
            new_solution: item.new_solution,
            nps_score: survey?.nps_score,
            is_working: survey?.is_working,
            verbatim: survey?.verbatim,
            driver_l1: survey?.driver_l1,
            driver_l2: survey?.driver_l2,
            created_at: survey?.created_at || item.created_at,
            completed_date: item.completed_date,
            compliance_uniform: survey?.compliance_uniform,
            compliance_politeness: survey?.compliance_politeness,
            compliance_explanation: survey?.compliance_explanation,
            compliance_cleanup: survey?.compliance_cleanup,
            compliance_receipt: survey?.compliance_receipt,
            status: item.status,
            agent_name: profileMap[item.assigned_to] || profileMap[survey?.agent_id] || 'Unassigned',
            attempts: item.attempts || 0,
            has_survey: !!survey
          };
        });
        
        setAllCalls(flattened);
        setCompletedCalls(flattened.filter(c => c.has_survey));
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
      
      // Filter out standard line-drop callbacks (those with status 'callback' but no escalation note)
      const trueEscalations = (results || []).filter(call => 
        call.status !== 'callback' || (call.escalation_note && call.escalation_note.trim() !== '')
      );
      
      setEscalatedCalls(trueEscalations);
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

  useEffect(() => {
    if (activeSubTab === 'completed' || activeSubTab === 'dashboard' || activeSubTab === 'tech_scorecard') fetchCompletedCalls();
    if (activeSubTab === 'escalation') fetchEscalatedCalls();
    if (activeSubTab === 'resolved_esc') fetchResolvedEscalations();
  }, [activeSubTab]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) Papa.parse(file, { 
      header: true, 
      skipEmptyLines: true, 
      encoding: "UTF-8",
      complete: (results) => {
      if (results.data.length > 0) { 
        const csvHeaders = Object.keys(results.data[0] as object);
        setHeaders(csvHeaders); 
        setData(results.data as CSVData[]); 
        
        // Auto-mapping logic
        const newMapping = { ...mapping };
        const autoMap: Record<string, string[]> = {
          callId: ['work_order_no', 'call_id', 'id'],
          customerName: ['customer_name', 'name', 'customer'],
          phone: ['customer_phone', 'phone', 'phone1'],
          customerPhone2: ['customer_phone2', 'phone2'],
          address: ['address', 'customer_address'],
          productModel: ['product_model', 'model'],
          product: ['product_type', 'product'],
          warranty: ['warranty'],
          totalFee: ['total_fee', 'fee', 'price'],
          brand: ['brand'],
          assignedAgent: ['assigned_agent_email', 'agent_email', 'agent'],
          solution: ['solution', 'repair_solution'],
          remark: ['remark', 'comments'],
          repairDate: ['repair_date', 'date'],
          scheduledDate: ['Schedule Date', 'scheduled_date', 'target_date'],
          technicianName: ['technician_name', 'technician', 'tech'],
          serviceCenter: ['service_center', 'center', 'sc'],
        };

        Object.keys(autoMap).forEach(field => {
          const match = csvHeaders.find(h => autoMap[field].some(keyword => h.toLowerCase().trim() === keyword.toLowerCase()));
          if (match) (newMapping as any)[field] = match;
        });
        setMapping(newMapping);
      }
    }});
  };

  const handleConfirm = async () => {
    if (!mapping.callId || !mapping.customerName || !mapping.phone || !mapping.product || !mapping.serviceCenter || !mapping.technicianName || !mapping.brand) {
      alert('Required mapping missing.'); return;
    }
    setLoading(true);

    try {
      // Fetch profile map for email -> ID lookup
      const { data: profiles } = await supabase.from('profiles').select('id, email');
      const emailToId = Object.fromEntries(profiles?.filter(p => p.email).map(p => [p.email!.toLowerCase().trim(), p.id]) || []);

      const mappedData = data.map((row) => {
        const rawFee = row[mapping.totalFee]?.toString().replace(/[^0-9.]/g, '') || '0';
        const parsedFee = parseFloat(rawFee);
        const agentEmail = row[mapping.assignedAgent]?.toString().toLowerCase().trim();
        const assignedId = agentEmail ? emailToId[agentEmail] : null;
        
        return {
          work_order_no: row[mapping.callId]?.trim(),
          customer_name: row[mapping.customerName],
          customer_phone: row[mapping.phone],
          customer_phone2: row[mapping.customerPhone2],
          address: row[mapping.address],
          product_model: row[mapping.productModel],
          product_type: row[mapping.product],
          warranty: row[mapping.warranty],
          total_fee: isNaN(parsedFee) ? 0 : parsedFee,
          brand: row[mapping.brand] || 'Midea',
          assigned_to: assignedId,
          solution: row[mapping.solution],
          remark: row[mapping.remark],
          repair_date: formatDbDate(row[mapping.repairDate]),
          scheduled_date: formatDbDate(row[mapping.scheduledDate]),
          technician_name: row[mapping.technicianName] || '',
          service_center: row[mapping.serviceCenter] || '',
          status: 'pending'
        };
      }).filter(item => item.work_order_no);

      const uniqueInCSV = Array.from(new Set(mappedData.map(d => d.work_order_no))).map(id => mappedData.find(d => d.work_order_no === id)!);
      const finalDataToUpload = uniqueInCSV.filter(item => !existingWorkOrders.includes(item.work_order_no));
      
      if (finalDataToUpload.length === 0) {
        alert('No new or unique work orders to upload.');
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('work_orders').insert(finalDataToUpload);
      if (error) throw error;
      alert(`Uploaded ${finalDataToUpload.length} cases.`);
      setData([]);
      onUploadSuccess();
    } catch (error: any) { 
      alert(`Upload failed: ${error.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  const updateEscalationCase = async (id: string) => {
    try {
      const { data: updateData, error } = await supabase.from('work_orders').update({
        voice_of_technician: escFormData.voice,
        internal_remark: escFormData.remark,
        new_technician_assigned: escFormData.newTech,
        new_work_order_no: escFormData.newWO,
        new_solution: escFormData.newSol,
        status: escFormData.status
      }).eq('id', id).select();

      if (error) throw error;
      if (!updateData || updateData.length === 0) {
        throw new Error('Update failed: No rows were affected. You might not have permission to update this case.');
      }

      alert('Case updated successfully.');
      setEscEditingCase(null);
      fetchEscalatedCalls();
      await onUploadSuccess(); 
    } catch (error: any) { alert(`Update failed: ${error.message}`); }
  };

  const technicians = useMemo(() => {
    const techMap: Record<string, string> = {};
    allCalls.forEach(c => {
      if (c.technician_name) {
        // Keep the most recent service center associated with the technician
        techMap[c.technician_name] = c.service_center || 'Unknown';
      }
    });
    return Object.entries(techMap).map(([name, sc]) => ({ name, sc })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allCalls]);

  const filteredTechs = useMemo(() => {
    return technicians.filter(t => 
      t.name.toLowerCase().includes(techSearch.toLowerCase()) || 
      t.sc.toLowerCase().includes(techSearch.toLowerCase())
    );
  }, [technicians, techSearch]);

  const resetMapping = () => {
    setMapping({ callId: '', customerName: '', phone: '', customerPhone2: '', address: '', productModel: '', product: '', warranty: '', totalFee: '', brand: '', assignedAgent: '', solution: '', remark: '', repairDate: '', scheduledDate: '', technicianName: '', serviceCenter: '', });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg w-fit print:hidden">
        {[
          { id: 'dashboard', icon: BarChart3, label: 'DASHBOARD' },
          { id: 'upload', icon: Upload, label: 'CSV UPLOAD' },
          { id: 'completed', icon: ListFilter, label: 'COMPLETED CALLS' },
          { id: 'escalation', icon: AlertCircle, label: 'ESCALATION MGMT' },
          { id: 'resolved_esc', icon: CheckCircle2, label: 'RESOLVED ESC.' },
          { id: 'tech_scorecard', icon: UserCircle2, label: 'TECH SCORECARD' },
          { id: 'admin', icon: Settings, label: 'ADMIN PANEL' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)} className={`flex items-center px-4 py-2 rounded-md text-[10px] font-black tracking-widest transition-all ${activeSubTab === tab.id ? 'bg-white text-[#003b6d] shadow-sm' : 'text-gray-500'}`}>
            <tab.icon className="w-3.5 h-3.5 mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'dashboard' ? (
        <ExecutiveDashboard completedCalls={completedCalls} allCalls={allCalls} />
      ) : activeSubTab === 'upload' ? (
        <div className="p-6 bg-white rounded-xl shadow-md space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-[#003b6d] uppercase tracking-tight">Data Ingestion</h2>
            {data.length > 0 && <button onClick={resetMapping} className="text-[10px] font-black text-red-500 hover:underline uppercase">Reset Mapping</button>}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {data.length === 0 ? (
                <div className="relative overflow-hidden border-4 border-dashed p-16 rounded-3xl items-center bg-gray-50/50 flex flex-col group h-full justify-center">
                  <Upload className="w-10 h-10 text-[#0092d0] mb-4 group-hover:scale-110 transition-transform" />
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="opacity-0 absolute inset-0 cursor-pointer z-10" />
                  <button className="px-8 py-3 bg-[#003b6d] text-white rounded-full font-bold text-sm">Browse CSV File</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-[#f4fbff] p-6 rounded-2xl border">
                    {Object.keys(mapping).map((field) => (
                      <div key={field} className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-[#003b6d]/60 mb-2">
                          {field === 'callId' ? 'Work Order No' : field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          {['callId', 'customerName', 'phone', 'product', 'serviceCenter', 'technicianName', 'repairDate', 'scheduledDate', 'brand'].includes(field) && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        <select className="p-2.5 text-[10px] font-bold border-2 rounded-xl bg-white outline-none appearance-none" value={(mapping as any)[field]} onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}>
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
            <div className="space-y-6">
              <CsvTemplates />
              <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                <h4 className="text-[10px] font-black text-amber-800 uppercase mb-2">Instructions</h4>
                <ul className="text-[10px] font-medium text-amber-900 space-y-2 list-disc ml-4">
                  <li>Ensure dates are in DD/MM/YYYY format.</li>
                  <li>"Work Order No" must be unique.</li>
                  <li>Required fields are marked with an asterisk (*).</li>
                  <li>Assigned Agent Email must match an existing account.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : activeSubTab === 'tech_scorecard' ? (
        <div className="animate-in fade-in duration-500">
          {selectedTech ? (
            <TechnicianScorecard technicianName={selectedTech} calls={allCalls} onBack={() => setSelectedTech(null)} />
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-black text-[#003b6d] uppercase tracking-tight">Technician Quality Directory</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search technician or branch..."
                    value={techSearch}
                    onChange={(e) => setTechSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#003b6d] focus:ring-2 focus:ring-[#0092d0] outline-none min-w-[300px] shadow-sm"
                  />
                </div>
              </div>

              {filteredTechs.length === 0 ? (
                <div className="p-20 text-center bg-white rounded-3xl border-4 border-dashed border-gray-50">
                  <UserCircle2 className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest">No technicians found...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredTechs.map((tech) => (
                    <button
                      key={tech.name}
                      onClick={() => setSelectedTech(tech.name)}
                      className="p-6 bg-white rounded-2xl shadow-lg border border-gray-100 hover:border-[#0092d0] hover:shadow-2xl transition-all group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-[#003b6d] group-hover:bg-[#0092d0] group-hover:text-white transition-all">
                          <UserCircle2 className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-800 uppercase truncate" title={tech.name}>{tech.name}</p>
                          <p className="text-[10px] font-bold text-[#0092d0] uppercase tracking-widest truncate">{tech.sc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeSubTab === 'completed' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-[#003b6d] uppercase tracking-tight">Survey Performance Report</h2>
            <button onClick={() => {
              const csvHeaders = ['Work Order', 'Customer', 'Phone', 'Phone 2', 'Address', 'Product', 'Model', 'Technician', 'Service Center', 'Agent', 'NPS', 'Status', 'Attempts', 'Feedback Category', 'Sub-Category', 'Verbatim', 'Completed At'];
              const csvRows = completedCalls.map(c => [
                c.work_order_no, c.customer_name, c.customer_phone, c.customer_phone2 || 'N/A', `"${c.address}"`, c.product_type, c.product_model, c.technician_name, c.service_center, c.agent_name, c.status === 'refused' ? 'REFUSED' : c.nps_score, c.status === 'refused' ? 'Refused' : (c.is_working ? 'Fixed' : 'Failed'), getAttemptLabel(c.attempts + 1), `"${c.driver_l1}"`, `"${c.driver_l2}"`, `"${c.verbatim}"`, c.completed_date ? new Date(c.completed_date).toLocaleString() : 'N/A'
              ]);
              const csvContent = [csvHeaders, ...csvRows].map(r => r.join(',')).join('\n');
              const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `nps_master_report_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            }} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold shadow-lg"><Download className="w-4 h-4 mr-2" />Export Master Report</button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-[11px]">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-4 py-4 text-left font-black text-gray-400 uppercase tracking-widest">Call Details</th>
                  <th className="px-4 py-4 text-left font-black text-gray-400 uppercase tracking-widest">Agent</th>
                  <th className="px-4 py-4 text-left font-black text-gray-400 uppercase tracking-widest">Job & Tech</th>
                  <th className="px-4 py-4 text-left font-black text-gray-400 uppercase tracking-widest">NPS Result</th>
                  <th className="px-4 py-4 text-left font-black text-gray-400 uppercase tracking-widest">Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {completedCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-4 font-bold text-gray-600">
                      <div className={`text-[9px] font-black uppercase ${call.attempts >= 1 ? 'text-amber-600' : 'text-[#0092d0]'}`}>
                        {getAttemptLabel(call.attempts + 1)}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-1 uppercase">Done: {call.completed_date ? new Date(call.completed_date).toLocaleString() : 'N/A'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-gray-700 uppercase">{call.agent_name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-[#003b6d]">{call.work_order_no}</p>
                      <p className="font-bold text-gray-500 uppercase">{call.customer_name}</p>
                      <p className="text-[9px] text-[#0092d0] font-bold">{call.technician_name}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">{call.service_center}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-full font-black text-white ${
                        call.status === 'refused' ? 'bg-gray-400' :
                        call.nps_score >= 9 ? 'bg-green-500' : 
                        call.nps_score >= 7 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}>
                        {call.status === 'refused' ? 'REFUSED' : `NPS ${call.nps_score}`}
                      </span>
                      {call.status === 'escalation_completed' && <span className="block mt-1 text-[8px] font-black text-red-500 uppercase tracking-tighter">RE-CALL SUCCESS</span>}
                    </td>
                    <td className="px-4 py-4 max-w-[250px]"><p className="italic text-gray-500 line-clamp-2">"{call.verbatim}"</p><p className="text-[8px] text-gray-300 mt-1 uppercase font-black tracking-widest">{call.driver_l1}</p></td>
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
                    <td className="px-6 py-4"><p className="font-black text-[#003b6d]">{call.customer_name}</p><p className="text-[10px] text-gray-400 uppercase tracking-tighter">Original WO: {call.work_order_no}</p></td>
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
          <h2 className="text-2xl font-black text-red-600 uppercase tracking-tight">Escalation Management</h2>
          <div className="grid grid-cols-1 gap-6">
            {escalatedCalls.map((call) => (
              <div key={call.id} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row">
                <div className="p-6 md:w-1/3 bg-gray-50 border-r border-gray-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{call.work_order_no}</p>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-[#003b6d]">{call.customer_name}</h3>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${call.attempts >= 1 ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-[#0092d0]'}`}>
                          {getAttemptLabel(call.attempts)}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#0092d0]">{call.product_type}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${call.status === 'issue_resolved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                      {ESCALATION_STATUSES.find(s => s.id === call.status)?.label || call.status}
                    </div>
                  </div>
                  <div className="space-y-4"><div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm text-xs text-red-900 font-medium italic">"{call.escalation_note}"</div></div>
                </div>
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
                    <div className="h-full flex flex-col justify-between">
                      <div className="grid grid-cols-2 gap-6"><div><p className="text-[10px] font-black text-[#003b6d]/40 uppercase mb-3">Escalation Progress</p><div className="space-y-4"><div><p className="text-[9px] font-black text-gray-500 uppercase">Voice of Tech</p><p className="text-xs text-gray-700">{call.voice_of_technician || '-'}</p></div><div><p className="text-[9px] font-black text-gray-500 uppercase">Supervisor Remarks</p><p className="text-xs text-gray-700">{call.internal_remark || '-'}</p></div></div></div><div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50"><p className="text-[9px] font-black text-[#0092d0] uppercase mb-3">Resolution Plan</p><div className="space-y-2"><p className="text-xs font-bold text-gray-600">New Tech: <span className="text-[#003b6d]">{call.new_technician_assigned || '-'}</span></p><p className="text-xs font-bold text-gray-600">New WO: <span className="text-[#003b6d]">{call.new_work_order_no || '-'}</span></p></div></div></div>
                      <button onClick={() => { setEscEditingCase(call.id); setEscFormData({ voice: call.voice_of_technician || '', remark: call.internal_remark || '', newTech: call.new_technician_assigned || '', newWO: call.new_work_order_no || '', newSol: call.new_solution || '', status: call.status || '' }); }} className="mt-8 w-full py-4 bg-white border-2 border-[#003b6d] text-[#003b6d] rounded-2xl font-black uppercase text-[10px] hover:bg-[#003b6d] hover:text-white transition-all flex items-center justify-center gap-2 group">Update Lifecycle <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></button>
                    </div>
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
