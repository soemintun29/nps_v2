import React, { useState } from 'react';
import { Phone, ArrowLeft, User, Package, ChevronRight, ClipboardCheck, AlertCircle, Calendar, Clock } from 'lucide-react';
import type { Call } from '../App';
import { supabase } from '../lib/supabase';
import { DRIVERS } from '../lib/drivers';

interface AgentModuleProps {
  calls: Call[];
  onRefresh: () => void;
}

export const AgentModule: React.FC<AgentModuleProps> = ({ calls, onRefresh }) => {
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isSchedulingCallback, setIsSchedulingCallback] = useState(false);
  const [callbackTime, setCallbackTime] = useState('');
  const [agentTab, setAgentTab] = useState<'today' | 'upcoming'>('today');
  
  const [formData, setFormData] = useState({
    resolution: '',
    nps: null as number | null,
    compliance: {
      uniform: false,
      politeness: false,
      explanation: false,
      cleanup: false,
      receipt: false,
      idCard: false,
      twoHrCall: false,
    },
    l1Driver: '' as any,
    drivers: {} as Record<string, string[]>,
    verbatim: '',
    escalationNote: '',
    escKeyIssue: '',
    escL1Driver: '',
    escProblemType: '',
  });

  const handleNext = () => setStep(step + 1);
  const handlePrev = () => setStep(step - 1);

  const getNpsCategory = (score: number | null): 'promoter' | 'detractor' => {
    if (score === null) return 'detractor';
    return score >= 9 ? 'promoter' : 'detractor';
  };

  const toggleL1 = (l1: string) => {
    const newDrivers = { ...formData.drivers };
    if (newDrivers[l1]) {
      delete newDrivers[l1];
    } else {
      newDrivers[l1] = [];
    }
    setFormData({ ...formData, drivers: newDrivers });
  };

  const toggleL2 = (l1: string, l2: string) => {
    const newDrivers = { ...formData.drivers };
    if (newDrivers[l1].includes(l2)) {
      newDrivers[l1] = newDrivers[l1].filter(d => d !== l2);
    } else {
      newDrivers[l1] = [...newDrivers[l1], l2];
    }
    setFormData({ ...formData, drivers: newDrivers });
  };

  const handleSubmit = async () => {
    if (!selectedCall) return;
    setLoading(true);

    try {
      const isEscalation = formData.resolution === 'No';
      const isRecall = selectedCall.status === 'issue_resolved';
      const activeWorkOrderNo = isRecall ? selectedCall.newWorkOrderNo : selectedCall.id;
      
      const { data: wo, error: woError } = await supabase
        .from('work_orders')
        .select('id')
        .eq('work_order_no', selectedCall.id)
        .single();

      if (woError) throw woError;

      const formattedDrivers = isEscalation 
        ? `Escalation: ${formData.escL1Driver}`
        : Object.entries(formData.drivers)
            .map(([l1, l2s]) => `${l1}: ${l2s.join(', ')}`)
            .join(' | ');

      const l1Summary = isEscalation ? formData.escL1Driver : Object.keys(formData.drivers).join(', ');

      const { error: surveyError } = await supabase
        .from('surveys')
        .insert({
          work_order_id: wo.id,
          survey_work_order_no: activeWorkOrderNo,
          nps_score: isEscalation ? 0 : formData.nps, 
          is_working: !isEscalation,
          verbatim: isEscalation ? `[ESCALATION] ${formData.escKeyIssue}` : formData.verbatim,
          driver_l1: l1Summary,
          driver_l2: formattedDrivers,
          compliance_uniform: isEscalation ? false : formData.compliance.uniform,
          compliance_politeness: isEscalation ? false : formData.compliance.politeness,
          compliance_explanation: isEscalation ? false : formData.compliance.explanation,
          compliance_cleanup: isEscalation ? false : formData.compliance.cleanup,
          compliance_receipt: isEscalation ? false : formData.compliance.receipt,
          compliance_id_card: isEscalation ? false : formData.compliance.idCard,
          compliance_2hr_call: isEscalation ? false : formData.compliance.twoHrCall,
        });

      if (surveyError) throw surveyError;

      let nextStatus = 'completed';
      if (isEscalation) {
        nextStatus = 'callback';
      } else if (isRecall) {
        nextStatus = 'escalation_completed';
      }

      const { error: updateError } = await supabase
        .from('work_orders')
        .update({ 
          status: nextStatus,
          completed_date: new Date().toISOString()
        })
        .eq('id', wo.id);

      if (updateError) throw updateError;

      alert(!isEscalation ? 'Survey Submitted Successfully!' : 'Case Escalated to Supervisor!');
      setSelectedCall(null);
      setStep(1);
      setFormData({
        resolution: '',
        nps: null,
        compliance: { uniform: false, politeness: false, explanation: false, cleanup: false, receipt: false, idCard: false, twoHrCall: false },
        l1Driver: '' as any,
        drivers: {},
        verbatim: '',
        escalationNote: '',
        escKeyIssue: '',
        escL1Driver: '',
        escProblemType: '',
      });
      onRefresh();
    } catch (error: any) {
      alert(`Submission failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCallback = async (minutesLater?: number) => {
    if (!selectedCall) return;
    setLoading(true);

    let nextTime: string;
    if (minutesLater) {
      nextTime = new Date(Date.now() + minutesLater * 60000).toISOString();
    } else if (callbackTime) {
      nextTime = new Date(callbackTime).toISOString();
    } else {
      nextTime = new Date(Date.now() + 30 * 60000).toISOString();
    }

    try {
      const { data: wo, error: woError } = await supabase
        .from('work_orders')
        .select('id')
        .eq('work_order_no', selectedCall.id)
        .single();
      
      if (woError) throw woError;

      const { error } = await supabase
        .from('work_orders')
        .update({ 
          callback_at: nextTime,
          attempts: (selectedCall.attempts || 0) + 1,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', wo.id);

      if (error) throw error;

      alert(`Callback scheduled for ${new Date(nextTime).toLocaleString()}`);
      setSelectedCall(null);
      setIsSchedulingCallback(false);
      setStep(1);
      onRefresh();
    } catch (error: any) {
      alert(`Callback failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isTodayOrPast = (dateStr?: string) => {
    if (!dateStr) return true;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date <= today;
  };

  const filteredCalls = calls.filter(call => {
    // 1. If callback is scheduled for future (more than today), hide from today list
    const isFutureCallback = call.callbackAt && new Date(call.callbackAt) > new Date(new Date().setHours(23,59,59,999));
    const isScheduledFuture = call.scheduledDate && !isTodayOrPast(call.scheduledDate);

    if (agentTab === 'today') {
      return !isFutureCallback && !isScheduledFuture;
    } else {
      return isFutureCallback || isScheduledFuture;
    }
  }).sort((a, b) => {
    const timeA = a.callbackAt || a.scheduledDate || '';
    const timeB = b.callbackAt || b.scheduledDate || '';
    return timeA.localeCompare(timeB);
  });

  if (selectedCall) {
    const isRecall = selectedCall.status === 'issue_resolved';
    const activeWorkOrderNo = isRecall ? selectedCall.newWorkOrderNo : selectedCall.id;

    return (
      <div className="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-md space-y-6 relative">
        {isSchedulingCallback && (
          <div className="absolute inset-0 bg-white/95 z-50 rounded-xl p-8 flex flex-col items-center justify-center animate-in fade-in duration-200">
            <Phone className="w-12 h-12 text-[#0092d0] mb-4" />
            <h3 className="text-xl font-black text-[#003b6d] mb-2 uppercase">Schedule Callback</h3>
            <p className="text-gray-500 text-sm text-center mb-6 max-w-md">The phone line dropped or the customer asked for a later time? Set the next appointment below.</p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-6">
              <button onClick={() => handleCallback(30)} className="py-3 bg-gray-100 rounded-xl text-xs font-bold hover:bg-gray-200">In 30 Mins</button>
              <button onClick={() => handleCallback(120)} className="py-3 bg-gray-100 rounded-xl text-xs font-bold hover:bg-gray-200">In 2 Hours</button>
              <button onClick={() => handleCallback(1440)} className="py-3 bg-gray-100 rounded-xl text-xs font-bold hover:bg-gray-200">Tomorrow</button>
              <button onClick={() => handleCallback(2880)} className="py-3 bg-gray-100 rounded-xl text-xs font-bold hover:bg-gray-200">In 2 Days</button>
            </div>
            <div className="w-full max-w-sm space-y-4">
              <div className="flex flex-col">
                <label className="text-[10px] font-black uppercase text-gray-400 mb-1">Custom Date/Time</label>
                <input type="datetime-local" className="p-3 border-2 rounded-xl outline-none font-bold text-[#003b6d]" value={callbackTime} onChange={(e) => setCallbackTime(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleCallback()} disabled={loading} className="flex-1 py-4 bg-[#003b6d] text-white rounded-xl font-black uppercase tracking-widest text-[10px]">{loading ? 'Setting...' : 'Set Appointment'}</button>
                <button onClick={() => setIsSchedulingCallback(false)} className="px-6 py-4 border-2 border-gray-100 rounded-xl font-bold text-gray-400 text-[10px] uppercase">Back</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-6">
            <button onClick={() => setSelectedCall(null)} className="flex items-center text-gray-400 hover:text-[#003b6d] font-bold text-xs">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </button>
            <button 
              onClick={() => setIsSchedulingCallback(true)} 
              className="flex items-center px-6 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <Phone className="w-4 h-4 mr-2 animate-bounce" /> 
              Callback / Line Drop
            </button>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-[#003b6d]">{selectedCall.customerName}</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase">Active WO: <span className="text-[#0092d0]">{activeWorkOrderNo}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border text-sm">
          <div><span className="block text-gray-400 font-bold uppercase text-[10px]">Phone 1</span>{selectedCall.phone}</div>
          <div><span className="block text-gray-400 font-bold uppercase text-[10px]">Phone 2</span>{selectedCall.phone2 || '-'}</div>
          <div className="col-span-2"><span className="block text-gray-400 font-bold uppercase text-[10px]">Address</span>{selectedCall.address || '-'}</div>
          <div><span className="block text-gray-400 font-bold uppercase text-[10px]">Warranty</span><span className={`font-bold ${selectedCall.warranty === 'in' ? 'text-green-600' : 'text-red-600'}`}>{selectedCall.warranty?.toUpperCase() || '-'}</span></div>
          <div><span className="block text-gray-400 font-bold uppercase text-[10px]">Total Fee</span><span className="font-mono">{selectedCall.totalFee ? `${Number(selectedCall.totalFee).toLocaleString()} Ks` : '-'}</span></div>
          <div className="col-span-2"><span className="block text-gray-400 font-bold uppercase text-[10px]">Product</span>{selectedCall.product} ({selectedCall.productModel})</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <span className="block text-blue-400 font-bold uppercase text-[10px] mb-1">{isRecall ? 'NEW REPAIR SOLUTION' : 'INITIAL SOLUTION'}</span>
            <p className="text-[#003b6d] font-medium text-xs">{isRecall ? selectedCall.newSolution : (selectedCall.solution || 'No solution recorded')}</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
            <span className="block text-amber-500 font-bold uppercase text-[10px] mb-1">{isRecall ? 'INITIAL CUSTOMER COMPLAINT' : 'SPECIAL REMARKS'}</span>
            <p className="text-amber-900 font-medium text-xs italic">{isRecall ? selectedCall.escalationNote : (selectedCall.remark || 'No special remarks')}</p>
          </div>
        </div>

        {isRecall && (
          <div className="bg-red-50 p-4 rounded-xl border-l-4 border-red-500 animate-pulse flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-red-600 uppercase">Escalation Recovery Briefing</p>
              <p className="text-xs text-red-900 mt-1">Record feedback for WO <span className="font-bold">{selectedCall.newWorkOrderNo}</span> by <span className="font-bold">{selectedCall.newTechnicianAssigned}</span>.</p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center px-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${step === s ? 'bg-[#0092d0] text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>{s}</div>
              {s < 5 && <div className={`w-12 h-1 bg-gray-200 mx-1 ${step > s ? 'bg-green-500' : ''}`} />}
            </div>
          ))}
        </div>

        <div className="min-h-[300px] border p-6 rounded-lg bg-[#f4fbff]">
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="font-bold text-lg text-[#003b6d]">Step 1: Opening Script</h4>
              <div className="bg-white p-4 rounded border-l-4 border-[#0092d0] italic">
                <p className="text-gray-700 font-medium">"မင်္ဂလာပါရှင်။ Midea Feedback Team မှ ပါရှင်။ {selectedCall.customerName} နှင့် စကားပြောခွင့် ရမလားရှင်?"</p>
                <p className="mt-2 text-gray-600 text-sm">"လူကြီးမင်းရဲ့ {selectedCall.product} ကို မကြာသေးခင်ကမှ <span className="font-bold text-[#003b6d]">{isRecall ? 'ထပ်မံ' : ''}</span> ပြုပြင်ထားတာ ပစ္စည်းက အခုကောင်းကောင်း အလုပ်လုပ်နေပါသလားရှင့်?"</p>
              </div>
              <div className="flex justify-end pt-4"><button onClick={handleNext} className="px-6 py-2 bg-[#003b6d] text-white rounded-lg">Start Survey</button></div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h4 className="font-bold text-lg text-[#003b6d]">Step 2: Resolution Check</h4>
              <div className="flex gap-4">
                <button onClick={() => setFormData({...formData, resolution: 'Yes'})} className={`flex-1 py-4 rounded-lg border-2 font-bold ${formData.resolution === 'Yes' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white'}`}>Yes</button>
                <button onClick={() => setFormData({...formData, resolution: 'No'})} className={`flex-1 py-4 rounded-lg border-2 font-bold ${formData.resolution === 'No' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white'}`}>No</button>
              </div>
              {formData.resolution === 'No' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4 border-t pt-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-red-500 mb-2">Category (L1)</label>
                      <select className="w-full p-3 border-2 border-red-100 rounded-xl bg-white font-bold text-[#003b6d]" value={formData.escL1Driver} onChange={(e) => setFormData({...formData, escL1Driver: e.target.value})}>
                        <option value="">-- SELECT --</option>
                        <option value="Call Center">Call Center</option><option value="Speed of Service">Speed of Service</option><option value="Quality of Service">Quality of Service</option><option value="Cost of Service">Cost of Service</option><option value="Product Experience">Product Experience</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-red-500 mb-2">Problem Type</label>
                      <div className="flex gap-2">
                        {['Recurring', 'New Issue'].map((type) => (
                          <button key={type} onClick={() => setFormData({...formData, escProblemType: type})} className={`flex-1 py-3 rounded-xl text-xs font-bold border-2 ${formData.escProblemType === type ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-red-50 text-red-300'}`}>{type}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-red-500 mb-2 tracking-widest text-[8px]">Detailed Key Issue (Mandatory)</label>
                    <textarea className="w-full p-4 border-2 border-red-100 rounded-2xl h-32 font-medium bg-red-50/30" placeholder="..." value={formData.escKeyIssue} onChange={(e) => setFormData({...formData, escKeyIssue: e.target.value})}></textarea>
                  </div>
                  <button onClick={handleSubmit} disabled={loading || !formData.escL1Driver || !formData.escProblemType || !formData.escKeyIssue} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs">{loading ? 'Processing...' : 'Submit Escalation Case'}</button>
                </div>
              )}
              <div className="flex justify-between pt-4">
                <button onClick={handlePrev} className="px-6 py-2 border rounded-lg">Back</button>
                {formData.resolution === 'Yes' && <button onClick={handleNext} className="px-6 py-2 bg-[#003b6d] text-white rounded-lg">Next</button>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <h4 className="font-bold text-lg text-[#003b6d]">Step 3: NPS Score</h4>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {[...Array(11).keys()].map(num => (
                  <button key={num} onClick={() => setFormData({...formData, nps: num})} className={`w-10 h-10 rounded-full font-bold border ${formData.nps === num ? 'bg-[#0092d0] text-white border-[#0092d0]' : 'bg-white text-gray-700 border-gray-200'}`}>{num}</button>
                ))}
              </div>
              <div className="flex justify-between pt-8">
                <button onClick={handlePrev} className="px-6 py-2 border rounded-lg">Back</button>
                <button onClick={handleNext} disabled={formData.nps === null} className="px-6 py-2 bg-[#003b6d] text-white rounded-lg disabled:opacity-50">Next</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h4 className="font-bold text-lg text-[#003b6d]">Step 4: Technician Compliance</h4>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { key: 'uniform', label: 'Q1. Was the engineer wearing his uniform and ID?', mm: 'အင်ဂျင်နီယာက ယူနီဖောင်း နှင့် ဝန်ထမ်းကဒ် သေချာဝတ်ဆင်ထားပါသလားရှင်။' },
                  { key: 'politeness', label: 'Q2. Was the engineer polite?', mm: 'ယဉ်ကျေးမှု့ကောရှိပါသလားရှင်။' },
                  { key: 'explanation', label: 'Q3. Did the engineer explain the problem to you clearly?', mm: 'စက်ပျက်ရချင်းအကြောင်းရင်းနဲ့ ဆောင်ရန်ရှောင်ရန်တွေကိုကော ရှင်းရှင်းလင်းလင်း ရှင်းပြပါသလားရှင်။' },
                  { key: 'cleanup', label: 'Q4. Did the engineer clean up?', mm: 'ပါတ်ဝန်းကျင်ကိုကော သေချာသန့်ရှင်းရေးလုပ်ပေးခဲ့ပါသလားရှင်။' },
                  { key: 'receipt', label: 'Q5. Did the engineer give you proper receipt?', mm: '‌ငွေပေးချေမှု့ (သို့) အာမခံဝန်ဆောင်မှု့အတွက် ပြေစာ ပေးပါသလားရှင်။' },
                ].map((item) => (
                  <label key={item.key} className="flex items-start p-4 bg-white rounded-xl border-2 border-gray-100 cursor-pointer hover:border-[#0092d0]/30 transition-all">
                    <div className="mt-1"><input type="checkbox" checked={(formData.compliance as any)[item.key]} onChange={(e) => setFormData({ ...formData, compliance: { ...formData.compliance, [item.key]: e.target.checked } })} className="w-5 h-5 text-[#0092d0] rounded border-gray-300" /></div>
                    <div className="ml-4 flex-1"><p className="text-sm font-bold text-[#003b6d] mb-1">{item.label}</p><p className="text-xs text-gray-500 font-medium">{item.mm}</p></div>
                  </label>
                ))}
              </div>
              <div className="flex justify-between pt-6">
                <button onClick={handlePrev} className="px-8 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-400 text-xs">Back</button>
                <button onClick={handleNext} className="px-10 py-3 bg-[#003b6d] text-white rounded-xl font-black uppercase tracking-widest text-xs">Next</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h4 className="font-bold text-lg text-[#003b6d]">Step 5: Drivers & Verbatim</h4>
              <div className="bg-[#f4fbff] p-6 rounded-2xl border border-[#0092d0]/10 space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-3">Feedback Categories (L1)</label>
                  <div className="flex flex-wrap gap-2">
                    {["Call Center", "Speed of Service", "Quality of Service", "Cost of Service", "Product Experience"].map((l1) => (
                      <button key={l1} onClick={() => toggleL1(l1)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${formData.drivers[l1] ? 'bg-[#003b6d] border-[#003b6d] text-white' : 'bg-white border-gray-100 text-gray-400'}`}>{l1}</button>
                    ))}
                  </div>
                </div>
                {Object.keys(formData.drivers).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(formData.drivers).map((l1) => (
                      <div key={l1} className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-[10px] font-black uppercase text-[#003b6d] mb-2 opacity-60">{l1} Details</label>
                        <div className="space-y-1.5 max-h-[150px] overflow-y-auto border-2 rounded-xl p-3 bg-white scrollbar-thin">
                          {(DRIVERS[getNpsCategory(formData.nps)] as any)[l1]?.map((l2: string) => (
                            <label key={l2} className="flex items-start gap-2.5 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer">
                              <input type="checkbox" checked={formData.drivers[l1]?.includes(l2)} onChange={() => toggleL2(l1, l2)} className="mt-0.5 w-3.5 h-3.5 text-[#0092d0] rounded border-gray-300" />
                              <span className="text-[11px] font-medium text-gray-600 leading-tight">{l2}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Customer Verbatim</label>
                <textarea className="w-full p-4 border-2 rounded-2xl h-24 font-medium text-gray-700 bg-white" placeholder="..." value={formData.verbatim} onChange={(e) => setFormData({...formData, verbatim: e.target.value})}></textarea>
              </div>
              <div className="flex justify-between pt-4">
                <button onClick={handlePrev} className="px-8 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-400 text-xs">Back</button>
                <button onClick={handleSubmit} disabled={loading || Object.keys(formData.drivers).length === 0} className="px-10 py-3 bg-green-600 text-white rounded-xl font-black uppercase tracking-widest text-xs">{loading ? 'Finalizing...' : 'Finalize Survey'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-[#003b6d] uppercase tracking-tight">Call Schedule</h2>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button onClick={() => setAgentTab('today')} className={`flex items-center px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${agentTab === 'today' ? 'bg-[#003b6d] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}><Clock className="w-3.5 h-3.5 mr-2" />Today's Queue</button>
          <button onClick={() => setAgentTab('upcoming')} className={`flex items-center px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${agentTab === 'upcoming' ? 'bg-[#003b6d] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}><Calendar className="w-3.5 h-3.5 mr-2" />Future Schedule</button>
        </div>
      </div>
      
      <div className="grid gap-4">
        {filteredCalls.length === 0 ? (
          <div className="bg-white p-20 rounded-3xl border-4 border-dashed border-gray-50 flex flex-col items-center text-center">
            <ClipboardCheck className="w-16 h-16 text-gray-100 mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest">{agentTab === 'today' ? 'Queue is empty for now.' : 'No future appointments set.'}</p>
          </div>
        ) : (
          filteredCalls.map((call) => (
            <div key={call.id} className="bg-white p-5 rounded-2xl shadow-xl border border-gray-100 hover:border-[#0092d0] transition-all group">
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-4 flex-1">
                  <div className={`w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center transition-colors ${call.status === 'issue_resolved' ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-[#003b6d] group-hover:bg-[#f4fbff]'}`}>
                    <User className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-black text-gray-800 truncate">{call.customerName}</h3>
                      {call.status === 'issue_resolved' && <span className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full uppercase">RE-CALL</span>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-[#003b6d]"><Phone className="w-3.5 h-3.5" /> P1: {call.phone}</span>
                        <span className="flex items-center gap-1.5 text-[#0092d0]"><Phone className="w-3.5 h-3.5" /> P2: {call.phone2 || '-'}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="flex items-center gap-1.5 text-[#1e293b] truncate tracking-normal"><Package className="w-3.5 h-3.5" /> {call.status === 'issue_resolved' ? call.newWorkOrderNo : call.id} | {call.product}</span>
                        <span className="flex items-start gap-1.5 text-amber-600 normal-case font-medium line-clamp-1 italic"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {call.remark || 'No remarks'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {call.attempts > 0 && <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[9px] font-black rounded-full border">Attempt #{call.attempts}</span>}
                    {call.callbackAt && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 text-[9px] font-black rounded-full border border-amber-200 uppercase">
                        <Clock className="w-3 h-3" /> {new Date(call.callbackAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSelectedCall(call)} className="flex items-center gap-2 bg-[#003b6d] text-white px-8 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-[#005696] shadow-xl shadow-blue-900/20 transition-all active:scale-95">
                    Call <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
