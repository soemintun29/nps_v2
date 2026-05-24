import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { Upload, ListFilter, Download, Star, ClipboardCheck, AlertCircle, UserCheck, ChevronRight, CheckCircle2 } from 'lucide-react';

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
  nps_score: number;
  is_working: boolean;
  verbatim: string;
  driver_l1: string;
  driver_l2: string;
  created_at: string;
  compliance_uniform: boolean;
  compliance_politeness: boolean;
  compliance_explanation: boolean;
  compliance_cleanup: boolean;
  compliance_receipt: boolean;
  compliance_id_card: boolean;
  compliance_2hr_call: boolean;
  status: string;
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
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'completed' | 'escalation' | 'resolved_esc'>('upload');
  const [data, setData] = useState<CSVData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [completedCalls, setCompletedCalls] = useState<CompletedCall[]>([]);
  const [escalatedCalls, setEscalatedCalls] = useState<EscalatedCall[]>([]);
  const [resolvedEscCalls, setResolvedEscCalls] = useState<EscalatedCall[]>([]);
  const [editingCase, setEscEditingCase] = useState<string | null>(null);
  const [escFormData, setEscFormData] = useState({
    voice: '',
    remark: '',
    newTech: '',
    newWO: '',
    newSol: '',
    status: ''
  });
  const [mapping, setMapping] = useState({
    callId: '',
    customerName: '',
    phone: '',
    customerPhone2: '',
    address: '',
    productModel: '',
    product: '',
    warranty: '',
    totalFee: '',
    solution: '',
    remark: '',
  });

  const fetchCompletedCalls = async () => {
    setLoading(true);
    try {
      const { data: results, error } = await supabase
        .from('surveys')
        .select(`
          id,
          survey_work_order_no,
          nps_score,
          is_working,
          verbatim,
          driver_l1,
          driver_l2,
          created_at,
          compliance_uniform,
          compliance_politeness,
          compliance_explanation,
          compliance_cleanup,
          compliance_receipt,
          compliance_id_card,
          compliance_2hr_call,
          work_orders (
            customer_name,
            product_type,
            status
          )
        `)
        .in('work_orders.status', ['completed', 'escalation_completed', 'callback']) 
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (results) {
        const flattened: CompletedCall[] = results
          .filter((item: any) => item.work_orders !== null)
          .map((item: any) => ({
            id: item.id,
            // Use the permanent WO snapshot saved in the survey table
            work_order_no: item.survey_work_order_no || 'N/A',
            customer_name: item.work_orders.customer_name,
            product_type: item.work_orders.product_type,
            nps_score: item.nps_score,
            is_working: item.is_working,
            verbatim: item.verbatim,
            driver_l1: item.driver_l1,
            driver_l2: item.driver_l2 || '',
            created_at: item.created_at,
            compliance_uniform: item.compliance_uniform,
            compliance_politeness: item.compliance_politeness,
            compliance_explanation: item.compliance_explanation,
            compliance_cleanup: item.compliance_cleanup,
            compliance_receipt: item.compliance_receipt,
            compliance_id_card: item.compliance_id_card,
            compliance_2hr_call: item.compliance_2hr_call,
            status: item.work_orders.status
          }));
        setCompletedCalls(flattened);
      }
    } catch (error) {
      console.error('Error fetching completed calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEscalatedCalls = async () => {
    setLoading(true);
    try {
      const { data: results, error } = await supabase
        .from('work_orders')
        .select('*')
        .not('status', 'in', '("pending","completed","refused","issue_resolved","escalation_completed")')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEscalatedCalls(results || []);
    } catch (error) {
      console.error('Error fetching escalated calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResolvedEscalations = async () => {
    setLoading(true);
    try {
      const { data: results, error } = await supabase
        .from('work_orders')
        .select('*')
        .in('status', ['issue_resolved', 'escalation_completed'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResolvedEscCalls(results || []);
    } catch (error) {
      console.error('Error fetching resolved escalations:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateEscalationCase = async (id: string) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          voice_of_technician: escFormData.voice,
          internal_remark: escFormData.remark,
          new_technician_assigned: escFormData.newTech,
          new_work_order_no: escFormData.newWO,
          new_solution: escFormData.newSol,
          status: escFormData.status
        })
        .eq('id', id);

      if (error) throw error;
      alert('Case updated successfully.');
      setEscEditingCase(null);
      fetchEscalatedCalls();
      onUploadSuccess(); // Refresh global Work Order ID list
    } catch (error: any) {
      alert(`Update failed: ${error.message}`);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'completed') fetchCompletedCalls();
    if (activeSubTab === 'escalation') fetchEscalatedCalls();
    if (activeSubTab === 'resolved_esc') fetchResolvedEscalations();
  }, [activeSubTab]);

  const resetState = () => {
    setData([]);
    setHeaders([]);
    setMapping({
      callId: '',
      customerName: '',
      phone: '',
      customerPhone2: '',
      address: '',
      productModel: '',
      product: '',
      warranty: '',
      totalFee: '',
      solution: '',
      remark: '',
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length > 0) {
            setHeaders(Object.keys(results.data[0] as object));
            setData(results.data as CSVData[]);
          }
        },
      });
    }
  };

  const handleConfirm = async () => {
    if (!mapping.callId || !mapping.customerName || !mapping.phone || !mapping.product) {
      alert('Please map at least Call ID, Customer Name, Phone, and Product.');
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
      technician_name: row['technician_name'] || row['Technician Name'] || '', 
      status: 'pending'
    })).filter(item => item.work_order_no);

    const seen = new Set();
    const uniqueInCSV = mappedData.filter(item => {
      const isDuplicate = seen.has(item.work_order_no);
      seen.add(item.work_order_no);
      return !isDuplicate;
    });

    const csvDuplicatesCount = mappedData.length - uniqueInCSV.length;
    const dbDuplicates = uniqueInCSV.filter(item => existingWorkOrders.includes(item.work_order_no));
    
    if (dbDuplicates.length > 0 || csvDuplicatesCount > 0) {
      let msg = '';
      if (csvDuplicatesCount > 0) msg += `- ${csvDuplicatesCount} rows are duplicates within the file itself.\n`;
      if (dbDuplicates.length > 0) msg += `- ${dbDuplicates.length} rows already exist in the database.\n`;
      
      const confirmProceed = window.confirm(
        `Deduplication Notice:\n${msg}\nThese items will be skipped. Do you want to proceed?`
      );
      if (!confirmProceed) {
        setLoading(false);
        return;
      }
    }

    const finalDataToUpload = uniqueInCSV.filter(item => !existingWorkOrders.includes(item.work_order_no));

    if (finalDataToUpload.length === 0) {
      alert('No new unique work orders to upload.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from('work_orders').insert(finalDataToUpload);
      if (error) throw error;
      alert(`Successfully uploaded ${finalDataToUpload.length} work orders!`);
      resetState();
      onUploadSuccess();
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tabs */}
      <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveSubTab('upload')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${
            activeSubTab === 'upload' ? 'bg-white text-[#003b6d] shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Upload className="w-4 h-4 mr-2" />
          CSV Upload
        </button>
        <button
          onClick={() => setActiveSubTab('completed')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${
            activeSubTab === 'completed' ? 'bg-white text-[#003b6d] shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ListFilter className="w-4 h-4 mr-2" />
          Completed Calls
        </button>
        <button
          onClick={() => setActiveSubTab('escalation')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${
            activeSubTab === 'escalation' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Escalation Management
        </button>
        <button
          onClick={() => setActiveSubTab('resolved_esc')}
          className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${
            activeSubTab === 'resolved_esc' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Resolved Escalations
        </button>
      </div>

      {activeSubTab === 'upload' ? (
        <div className="p-6 max-w-6xl mx-auto bg-white rounded-xl shadow-md space-y-6 border border-gray-100">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-[#003b6d] uppercase tracking-tight">Data Ingestion</h2>
            {data.length > 0 && (
              <button onClick={resetState} className="text-xs font-bold text-red-500 hover:underline uppercase tracking-widest">
                Discard Current File
              </button>
            )}
          </div>
          
          {data.length === 0 ? (
            <div className="relative overflow-hidden flex flex-col space-y-4 border-4 border-dashed border-gray-100 p-16 rounded-3xl items-center bg-gray-50/50 group hover:border-[#0092d0]/20 transition-colors">
              <div className="w-20 h-20 bg-white rounded-full shadow-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-[#0092d0]" />
              </div>
              <p className="text-gray-600 font-bold text-center">
                Drag & Drop or Click to Upload<br/>
                <span className="text-xs text-gray-400 font-normal mt-2 block">Standard CSV format required</span>
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="opacity-0 absolute inset-0 cursor-pointer z-10"
              />
              <button className="px-8 py-3 bg-[#003b6d] text-white rounded-full font-bold text-sm shadow-lg shadow-blue-900/20 pointer-events-none relative z-0">
                Browse Files
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 bg-[#f4fbff] p-6 rounded-2xl border border-[#0092d0]/10">
                {(['callId', 'customerName', 'phone', 'customerPhone2', 'address', 'productModel', 'product', 'warranty', 'totalFee', 'solution', 'remark'] as const).map((field) => (
                  <div key={field} className="flex flex-col">
                    <label className="text-[10px] font-black uppercase text-[#003b6d]/60 mb-2">
                      {field.replace(/([A-Z])/g, ' $1')}
                      {['callId', 'customerName', 'phone', 'product'].includes(field) && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <select
                      className="p-2.5 text-xs font-bold border-2 rounded-xl border-gray-200 bg-white focus:border-[#0092d0] outline-none transition-colors appearance-none"
                      value={mapping[field]}
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                    >
                      <option value="">-- MAP --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm bg-white">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.slice(0, 3).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        {headers.map((h) => (
                          <td key={h} className="px-6 py-4 whitespace-nowrap text-[11px] font-medium text-gray-600">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full py-5 bg-[#003b6d] text-white font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-[#005696] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-2xl shadow-blue-900/30 text-sm"
              >
                {loading ? <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm & Sync Database'}
              </button>
            </div>
          )}
        </div>
      ) : activeSubTab === 'completed' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-[#003b6d] uppercase tracking-tight">Survey Performance Report</h2>
            <button 
              onClick={() => {
                const csv = [
                  ['Work Order', 'Customer', 'Product', 'NPS', 'Status', 'Feedback Details', 'Comment', 'Date'],
                  ...completedCalls.map(c => [
                    c.work_order_no, 
                    c.customer_name, 
                    c.product_type, 
                    c.nps_score, 
                    c.is_working ? 'Fixed' : 'Failed', 
                    c.driver_l2,
                    c.verbatim,
                    new Date(c.created_at).toLocaleDateString()
                  ])
                ].map(r => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `nps_report_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
              }}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-lg shadow-green-900/20"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-gray-100">
                <div className="w-12 h-12 border-4 border-[#003b6d]/10 border-t-[#003b6d] rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Generating Insights...</p>
              </div>
            ) : completedCalls.length === 0 ? (
              <div className="p-20 bg-white rounded-3xl border-4 border-dashed border-gray-50 flex flex-col items-center text-center">
                <ClipboardCheck className="w-16 h-16 text-gray-100 mb-4" />
                <p className="text-gray-400 font-bold uppercase tracking-widest">No surveys completed yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Job Info</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Result</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Compliance</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Detailed Feedback & Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {completedCalls.map((call) => (
                      <tr key={call.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-6">
                          <p className="text-xs font-black text-[#003b6d] mb-1">{call.work_order_no}</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase">{call.customer_name}</p>
                          <p className="text-[10px] text-gray-400">{call.product_type}</p>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                              call.nps_score >= 9 ? 'bg-green-500' : call.nps_score >= 7 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}>
                              NPS {call.nps_score}
                            </span>
                            <span className={`px-2 py-1 rounded border text-[8px] font-bold uppercase ${
                              call.is_working ? 'border-green-200 text-green-600 bg-green-50' : 'border-red-200 text-red-600 bg-red-50'
                            }`}>
                              {call.is_working ? 'Fixed' : 'Unresolved'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-gray-400 font-medium italic">
                              {new Date(call.created_at).toLocaleDateString()}
                            </p>
                            {call.status === 'escalation_completed' && (
                              <span className="text-[8px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-tighter">RE-CALL CASE</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {[
                              { label: 'U', val: call.compliance_uniform },
                              { label: 'P', val: call.compliance_politeness },
                              { label: 'E', val: call.compliance_explanation },
                              { label: 'C', val: call.compliance_cleanup },
                              { label: 'R', val: call.compliance_receipt },
                              { label: 'ID', val: call.compliance_id_card },
                              { label: '2H', val: call.compliance_2hr_call }
                            ].map((item, idx) => (
                              <span key={idx} className={`w-5 h-5 flex items-center justify-center rounded-md text-[8px] font-black border ${
                                item.val ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-300'
                              }`} title={item.label}>
                                {item.label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-2 mb-1">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            <span className="text-[10px] font-black text-gray-700 uppercase tracking-tighter">Feedback Details</span>
                          </div>
                          <div className="space-y-1 mb-2">
                            {call.driver_l2 ? (
                              call.driver_l2.split(' | ').map((group, idx) => (
                                <p key={idx} className="text-[9px] text-[#003b6d] font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100/50 w-fit">
                                  {group}
                                </p>
                              ))
                            ) : (
                              <p className="text-[9px] text-gray-400">{call.driver_l1}</p>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-600 italic leading-relaxed border-l-2 border-gray-100 pl-2">
                            "{call.verbatim || 'No feedback provided'}"
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeSubTab === 'resolved_esc' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-green-600 uppercase tracking-tight">Resolved Escalation Cases</h2>
            <button className="flex items-center px-4 py-2 bg-[#003b6d] text-white rounded-lg text-xs font-bold hover:bg-[#005696] shadow-lg">
              <Download className="w-4 h-4 mr-2" />
              Export Recovery Report
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Initial Issue</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Recovery Action</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Resolution Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {resolvedEscCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-green-50/30 transition-colors">
                    <td className="px-6 py-6">
                      <p className="text-xs font-black text-[#003b6d] mb-1">{call.customer_name}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">WO: {call.work_order_no}</p>
                    </td>
                    <td className="px-6 py-6 max-w-[200px]">
                      <p className="text-[11px] text-red-700 font-medium bg-red-50 p-2 rounded-lg border border-red-100/50 italic line-clamp-3">
                        "{call.escalation_note}"
                      </p>
                    </td>
                    <td className="px-6 py-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Recovery WO</p>
                        <p className="text-xs font-bold text-[#0092d0]">{call.new_work_order_no || '-'}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase mt-2">Recovery Tech</p>
                        <p className="text-xs font-bold text-gray-800">{call.new_technician_assigned || '-'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex flex-col gap-2">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase text-center w-fit ${
                          call.status === 'escalation_completed' ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {call.status === 'escalation_completed' ? 'Final NPS Done' : 'Waiting for NPS Call'}
                        </span>
                        <div className="bg-green-50 p-2 rounded-lg border border-green-100 max-w-[150px]">
                          <p className="text-[8px] font-black text-green-700 uppercase mb-1 tracking-tighter">Recovery Fix</p>
                          <p className="text-[10px] text-green-900 font-medium leading-tight">{call.new_solution || '-'}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-red-600 uppercase tracking-tight">Escalation Management</h2>
            <div className="bg-red-50 px-4 py-2 rounded-full border border-red-100 text-red-600 text-xs font-bold">
              {escalatedCalls.length} Active Cases
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-gray-100">
                <div className="w-12 h-12 border-4 border-red-100 border-t-red-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Syncing Escalations...</p>
              </div>
            ) : escalatedCalls.length === 0 ? (
              <div className="p-20 bg-white rounded-3xl border-4 border-dashed border-gray-50 flex flex-col items-center text-center">
                <UserCheck className="w-16 h-16 text-gray-100 mb-4" />
                <p className="text-gray-400 font-bold uppercase tracking-widest">Zero active escalations.</p>
              </div>
            ) : (
              escalatedCalls.map((call) => (
                <div key={call.id} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row">
                  <div className="p-6 md:w-1/3 bg-gray-50 border-r border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{call.work_order_no}</p>
                        <h3 className="text-lg font-black text-[#003b6d]">{call.customer_name}</h3>
                        <p className="text-sm font-bold text-[#0092d0]">{call.product_type}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                        call.status === 'issue_resolved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white animate-pulse'
                      }`}>
                        {ESCALATION_STATUSES.find(s => s.id === call.status)?.label || call.status}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm">
                        <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-2">Escalation Details</p>
                        <p className="text-xs text-red-900 font-medium leading-relaxed italic">"{call.escalation_note}"</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-2 bg-white rounded-lg border border-gray-100">
                          <span className="block text-gray-400 font-bold uppercase mb-1 text-[8px]">Original Tech</span>
                          <span className="font-bold text-gray-700">{call.technician_name}</span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-gray-100 text-right">
                          <span className="block text-gray-400 font-bold uppercase mb-1 text-[8px]">Date Reported</span>
                          <span className="font-bold text-gray-700">{new Date(call.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 flex-1 space-y-6">
                    {editingCase === call.id ? (
                      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Voice of Technician (Input)</label>
                            <textarea 
                              className="w-full p-3 text-xs font-medium border-2 rounded-xl focus:border-[#0092d0] outline-none h-24"
                              placeholder="What did the technician say?"
                              value={escFormData.voice}
                              onChange={(e) => setEscFormData({...escFormData, voice: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Internal Remark (Action)</label>
                            <textarea 
                              className="w-full p-3 text-xs font-medium border-2 rounded-xl focus:border-[#0092d0] outline-none h-24"
                              placeholder="Supervisor internal notes..."
                              value={escFormData.remark}
                              onChange={(e) => setEscFormData({...escFormData, remark: e.target.value})}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">New Tech</label>
                            <input 
                              className="w-full p-3 text-xs font-bold border-2 rounded-xl focus:border-[#0092d0] outline-none"
                              placeholder="Tech Name"
                              value={escFormData.newTech}
                              onChange={(e) => setEscFormData({...escFormData, newTech: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">New Work Order</label>
                            <input 
                              className="w-full p-3 text-xs font-bold border-2 rounded-xl focus:border-[#0092d0] outline-none"
                              placeholder="New WO #"
                              value={escFormData.newWO}
                              onChange={(e) => setEscFormData({...escFormData, newWO: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Lifecycle Status</label>
                            <select 
                              className="w-full p-3 text-xs font-bold border-2 rounded-xl focus:border-[#0092d0] outline-none bg-white"
                              value={escFormData.status}
                              onChange={(e) => setEscFormData({...escFormData, status: e.target.value})}
                            >
                              <option value="">-- SELECT --</option>
                              {ESCALATION_STATUSES.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">New Repair Solution (Current Action)</label>
                          <textarea 
                            className="w-full p-3 text-xs font-medium border-2 rounded-xl focus:border-[#0092d0] outline-none h-20"
                            placeholder="What is the new fix for this customer?"
                            value={escFormData.newSol}
                            onChange={(e) => setEscFormData({...escFormData, newSol: e.target.value})}
                          />
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button 
                            onClick={() => updateEscalationCase(call.id)}
                            className="flex-1 py-4 bg-[#003b6d] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-[#005696] shadow-lg shadow-blue-900/20"
                          >
                            Save Progress
                          </button>
                          <button 
                            onClick={() => setEscEditingCase(null)}
                            className="px-8 py-4 border-2 border-gray-100 rounded-2xl font-bold text-gray-400 text-[10px] uppercase"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col justify-between">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <p className="text-[10px] font-black text-[#003b6d]/40 uppercase tracking-widest mb-3">Escalation Progress</p>
                            <div className="space-y-4">
                              <div className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-1.5 ${call.voice_of_technician ? 'bg-[#0092d0]' : 'bg-gray-200'}`} />
                                <div>
                                  <p className="text-[9px] font-black text-gray-500 uppercase">Voice of Technician</p>
                                  <p className="text-xs text-gray-700 font-medium leading-relaxed">{call.voice_of_technician || 'Not yet recorded.'}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-1.5 ${call.internal_remark ? 'bg-[#0092d0]' : 'bg-gray-200'}`} />
                                <div>
                                  <p className="text-[9px] font-black text-gray-500 uppercase">Supervisor Remarks</p>
                                  <p className="text-xs text-gray-700 font-medium leading-relaxed">{call.internal_remark || 'No internal remarks.'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50">
                            <p className="text-[9px] font-black text-[#0092d0] uppercase tracking-widest mb-3">Resolution Plan</p>
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-gray-600 flex justify-between">
                                New Tech: <span className="text-[#003b6d]">{call.new_technician_assigned || 'Unassigned'}</span>
                              </p>
                              <p className="text-xs font-bold text-gray-600 flex justify-between">
                                New WO: <span className="text-[#003b6d]">{call.new_work_order_no || '-'}</span>
                              </p>
                              <div className="h-1 w-full bg-blue-100 rounded-full overflow-hidden mt-4">
                                <div className="h-full bg-[#0092d0] rounded-full transition-all duration-1000" 
                                     style={{ width: `${(ESCALATION_STATUSES.findIndex(s => s.id === call.status) + 1) * (100 / ESCALATION_STATUSES.length)}%` }} 
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            setEscEditingCase(call.id);
                            setEscFormData({
                              voice: call.voice_of_technician || '',
                              remark: call.internal_remark || '',
                              newTech: call.new_technician_assigned || '',
                              newWO: call.new_work_order_no || '',
                              newSol: call.new_solution || '',
                              status: call.status || ''
                            });
                          }}
                          className="mt-8 w-full py-4 bg-white border-2 border-[#003b6d] text-[#003b6d] rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#003b6d] hover:text-white transition-all flex items-center justify-center gap-2 group"
                        >
                          Update Lifecycle <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
