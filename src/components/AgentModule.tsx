import React, { useState } from 'react';
import { Phone, ArrowLeft, User, Package, ChevronRight, ClipboardCheck, AlertCircle } from 'lucide-react';
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
    l1Driver: '' as any, // Legacy field, we'll use a new structure for multi-select
    drivers: {} as Record<string, string[]>, // { "Call Center": ["Option 1", "Option 2"] }
    verbatim: '',
    escalationNote: '',
    // Detailed escalation fields
    escKeyIssue: '',
    escL1Driver: '',
    escProblemType: '', // 'recurring' | 'new'
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
      
      // 1. Format drivers for database
      const formattedDrivers = isEscalation 
        ? `Escalation: ${formData.escL1Driver}`
        : Object.entries(formData.drivers)
            .map(([l1, l2s]) => `${l1}: ${l2s.join(', ')}`)
            .join(' | ');

      const l1Summary = isEscalation ? formData.escL1Driver : Object.keys(formData.drivers).join(', ');

      const { data: wo, error: woError } = await supabase
        .from('work_orders')
        .select('id')
        .eq('work_order_no', selectedCall.id)
        .single();

      if (woError) throw woError;

      // 2. Insert the survey results
      const { error: surveyError } = await supabase
        .from('surveys')
        .insert({
          work_order_id: wo.id,
          survey_work_order_no: activeWorkOrderNo, // Record the exact WO number used at this moment
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

      // 3. Update work order status and escalation note
      let nextStatus = 'completed';
      if (isEscalation) {
        nextStatus = 'callback';
      } else if (isRecall) {
        nextStatus = 'escalation_completed';
      }

      const updateData: any = { 
        status: nextStatus
      };
      
      if (isEscalation) {
        updateData.escalation_note = `Key Issue: ${formData.escKeyIssue} | Category: ${formData.escL1Driver} | Type: ${formData.escProblemType}`;
      }

      const { error: updateError } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('id', wo.id);

      if (updateError) throw updateError;

      alert(!isEscalation ? 'Survey Submitted Successfully!' : 'Case Escalated to Supervisor!');
      setSelectedCall(null);
      setStep(1);
      // Reset form
      setFormData({
        resolution: '',
        nps: null,
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
        drivers: {},
        verbatim: '',
        escalationNote: '',
        escKeyIssue: '',
        escL1Driver: '',
        escProblemType: '',
      });
      onRefresh();
    } catch (error: any) {
      console.error('Submission error:', error);
      alert(`Submission failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (selectedCall) {
    const isRecall = selectedCall.status === 'issue_resolved';
    const activeWorkOrderNo = isRecall ? selectedCall.newWorkOrderNo : selectedCall.id;

    return (
      <div className="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-md space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <button onClick={() => setSelectedCall(null)} className="flex items-center text-gray-500 hover:text-[#003b6d]">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to List
          </button>
          <div className="text-right">
            <h3 className="font-bold text-[#003b6d]">{selectedCall.customerName}</h3>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Active WO: <span className="text-[#0092d0]">{activeWorkOrderNo}</span>
            </p>
          </div>
        </div>

        {/* Customer & Product Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border text-sm">
          <div>
            <span className="block text-gray-400 font-bold uppercase text-[10px]">Phone 1</span>
            <span className="text-gray-700">{selectedCall.phone}</span>
          </div>
          <div>
            <span className="block text-gray-400 font-bold uppercase text-[10px]">Phone 2</span>
            <span className="text-gray-700">{selectedCall.phone2 || '-'}</span>
          </div>
          <div className="col-span-2">
            <span className="block text-gray-400 font-bold uppercase text-[10px]">Address</span>
            <span className="text-gray-700">{selectedCall.address || '-'}</span>
          </div>
          <div>
            <span className="block text-gray-400 font-bold uppercase text-[10px]">Warranty</span>
            <span className={`font-bold ${selectedCall.warranty === 'in' ? 'text-green-600' : 'text-red-600'}`}>
              {selectedCall.warranty?.toUpperCase() || '-'}
            </span>
          </div>
          <div>
            <span className="block text-gray-400 font-bold uppercase text-[10px]">Total Fee</span>
            <span className="text-gray-700 font-mono">{selectedCall.totalFee ? `${Number(selectedCall.totalFee).toLocaleString()} Ks` : '-'}</span>
          </div>
          <div className="col-span-2">
            <span className="block text-gray-400 font-bold uppercase text-[10px]">Product</span>
            <span className="text-gray-700">{selectedCall.product} ({selectedCall.productModel})</span>
          </div>
        </div>

        {/* Repair & Remark Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <span className="block text-blue-400 font-bold uppercase text-[10px] mb-1">
              {isRecall ? 'NEW REPAIR SOLUTION' : 'INITIAL SOLUTION'}
            </span>
            <p className="text-[#003b6d] font-medium text-xs leading-relaxed">
              {isRecall ? selectedCall.newSolution : (selectedCall.solution || 'No solution recorded')}
            </p>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
            <span className="block text-amber-500 font-bold uppercase text-[10px] mb-1">
              {isRecall ? 'INITIAL CUSTOMER COMPLAINT' : 'SPECIAL REMARKS'}
            </span>
            <p className="text-amber-900 font-medium text-xs leading-relaxed italic">
              {isRecall ? selectedCall.escalationNote : (selectedCall.remark || 'No special remarks')}
            </p>
          </div>
        </div>

        {/* Escalation Context Alert */}
        {isRecall && (
          <div className="bg-red-50 p-4 rounded-xl border-l-4 border-red-500 animate-pulse flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Escalation Recovery Briefing</p>
              <p className="text-xs text-red-900 font-medium mt-1 leading-relaxed">
                This is a follow-up for the new repair attempt. Please record feedback for 
                Work Order <span className="font-bold border-b border-red-200">{selectedCall.newWorkOrderNo}</span> fixed by 
                <span className="font-bold border-b border-red-200 ml-1">{selectedCall.newTechnicianAssigned}</span>.
              </p>
            </div>
          </div>
        )}

        {/* Snake Workflow Steps */}
        <div className="flex justify-between items-center px-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                step === s ? 'bg-[#0092d0] text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {s}
              </div>
              {s < 5 && <div className={`w-12 h-1 bg-gray-200 mx-1 ${step > s ? 'bg-green-500' : ''}`} />}
            </div>
          ))}
        </div>

        <div className="min-h-[300px] border p-6 rounded-lg bg-[#f4fbff]">
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="font-bold text-lg text-[#003b6d]">Step 1: Opening Script</h4>
              <div className="bg-white p-4 rounded border-l-4 border-[#0092d0] italic">
                <p className="text-gray-700 font-medium">"မင်္ဂလာပါရှင်။ Midea Feedback Team မှ {import.meta.env.VITE_AGENT_NAME || 'Agent'} ပါရှင်။ {selectedCall.customerName} နှင့် စကားပြောခွင့် ရမလားရှင်?"</p>
                <p className="mt-2 text-gray-600 text-sm">"လူကြီးမင်းရဲ့ {selectedCall.product} ကို မကြာသေးခင်ကမှ <span className="font-bold text-[#003b6d]">{isRecall ? 'ထပ်မံ' : ''}</span> ပြုပြင်ထားတာ ပစ္စည်းက အခုကောင်းကောင်း အလုပ်လုပ်နေပါသလားရှင့်?"</p>
              </div>
              <div className="flex justify-end pt-4">
                <button onClick={handleNext} className="px-6 py-2 bg-[#003b6d] text-white rounded-lg">Start Survey</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h4 className="font-bold text-lg text-[#003b6d]">Step 2: Resolution Check</h4>
              <p className="text-gray-600">Is the technical issue resolved?</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setFormData({...formData, resolution: 'Yes'})}
                  className={`flex-1 py-4 rounded-lg border-2 font-bold ${formData.resolution === 'Yes' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white'}`}
                >
                  Yes
                </button>
                <button 
                  onClick={() => setFormData({...formData, resolution: 'No'})}
                  className={`flex-1 py-4 rounded-lg border-2 font-bold ${formData.resolution === 'No' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white'}`}
                >
                  No
                </button>
              </div>

              {formData.resolution === 'No' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4 border-t pt-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-red-500 mb-2 tracking-widest">Feedback Category (L1)</label>
                      <select 
                        className="w-full p-3 border-2 border-red-100 rounded-xl bg-white font-bold text-[#003b6d] focus:border-red-500 outline-none"
                        value={formData.escL1Driver}
                        onChange={(e) => setFormData({...formData, escL1Driver: e.target.value})}
                      >
                        <option value="">-- SELECT CATEGORY --</option>
                        <option value="Call Center">Call Center</option>
                        <option value="Speed of Service">Speed of Service</option>
                        <option value="Quality of Service">Quality of Service</option>
                        <option value="Cost of Service">Cost of Service</option>
                        <option value="Product Experience">Product Experience</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-red-500 mb-2 tracking-widest">Problem Type</label>
                      <div className="flex gap-2">
                        {['Recurring', 'New Issue'].map((type) => (
                          <button
                            key={type}
                            onClick={() => setFormData({...formData, escProblemType: type})}
                            className={`flex-1 py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                              formData.escProblemType === type 
                                ? 'bg-red-500 border-red-500 text-white shadow-md' 
                                : 'bg-white border-red-50 text-red-300 hover:border-red-200'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-red-500 mb-2 tracking-widest">Detailed Key Issue (Mandatory)</label>
                    <textarea
                      className="w-full p-4 border-2 border-red-100 rounded-2xl h-32 font-medium text-gray-700 focus:border-red-500 outline-none bg-red-50/30"
                      placeholder="Describe exactly what the customer said about the unresolved issue..."
                      value={formData.escKeyIssue}
                      onChange={(e) => setFormData({...formData, escKeyIssue: e.target.value})}
                    ></textarea>
                  </div>

                  <button 
                    onClick={handleSubmit}
                    disabled={loading || !formData.escL1Driver || !formData.escProblemType || !formData.escKeyIssue}
                    className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-red-700 shadow-xl shadow-green-900/20 disabled:opacity-50 flex items-center justify-center gap-3 text-xs transition-all active:scale-95"
                  >
                    {loading && <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />}
                    Submit Escalation Case
                  </button>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button onClick={handlePrev} className="px-6 py-2 border rounded-lg">Back</button>
                {formData.resolution === 'Yes' && (
                  <button 
                    onClick={handleNext} 
                    className="px-6 py-2 bg-[#003b6d] text-white rounded-lg"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <h4 className="font-bold text-lg text-[#003b6d]">Step 3: NPS Score</h4>
              <p className="text-gray-600">How likely are you to recommend Midea to others? (0-10)</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {[...Array(11).keys()].map(num => (
                  <button
                    key={num}
                    onClick={() => setFormData({...formData, nps: num})}
                    className={`w-10 h-10 rounded-full font-bold border ${
                      formData.nps === num ? 'bg-[#0092d0] text-white border-[#0092d0]' : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    {num}
                  </button>
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
                  { 
                    key: 'uniform', 
                    label: 'Q1. Was the engineer wearing his uniform and ID?', 
                    mm: 'အင်ဂျင်နီယာက ယူနီဖောင်း နှင့် ဝန်ထမ်းကဒ် သေချာဝတ်ဆင်ထားပါသလားရှင်။' 
                  },
                  { 
                    key: 'politeness', 
                    label: 'Q2. Was the engineer polite?', 
                    mm: 'ယဉ်ကျေးမှု့ကောရှိပါသလားရှင်။' 
                  },
                  { 
                    key: 'explanation', 
                    label: 'Q3. Did the engineer explain the problem to you clearly?', 
                    mm: 'စက်ပျက်ရချင်းအကြောင်းရင်းနဲ့ ဆောင်ရန်ရှောင်ရန်တွေကိုကော ရှင်းရှင်းလင်းလင်း ရှင်းပြပါသလားရှင်။' 
                  },
                  { 
                    key: 'cleanup', 
                    label: 'Q4. Did the engineer clean up?', 
                    mm: 'ပါတ်ဝန်းကျင်ကိုကော သေချာသန့်ရှင်းရေးလုပ်ပေးခဲ့ပါသလားရှင်။' 
                  },
                  { 
                    key: 'receipt', 
                    label: 'Q5. Did the engineer give you proper receipt in case of any payment made by you?', 
                    mm: '‌ငွေပေးချေမှု့ (သို့) အာမခံဝန်ဆောင်မှု့အတွက် ပြေစာ ပေးပါသလားရှင်။' 
                  },
                ].map((item) => (
                  <label key={item.key} className="flex items-start p-4 bg-white rounded-xl border-2 border-gray-100 cursor-pointer hover:border-[#0092d0]/30 hover:bg-blue-50/20 transition-all group">
                    <div className="mt-1">
                      <input
                        type="checkbox"
                        checked={(formData.compliance as any)[item.key]}
                        onChange={(e) => setFormData({
                          ...formData,
                          compliance: { ...formData.compliance, [item.key]: e.target.checked }
                        })}
                        className="w-5 h-5 text-[#0092d0] rounded border-gray-300 focus:ring-[#0092d0]"
                      />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-bold text-[#003b6d] mb-1">{item.label}</p>
                      <p className="text-xs text-gray-500 font-medium">{item.mm}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-between pt-6">
                <button onClick={handlePrev} className="px-8 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-colors uppercase text-xs tracking-widest">Back</button>
                <button onClick={handleNext} className="px-10 py-3 bg-[#003b6d] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#005696] shadow-xl shadow-blue-900/20 transition-all active:scale-95 text-xs">Next</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h4 className="font-bold text-lg text-[#003b6d]">Step 5: Drivers & Verbatim</h4>
              
              <div className="bg-[#f4fbff] p-6 rounded-2xl border border-[#0092d0]/10 space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest">Select Feedback Categories (L1)</label>
                  <div className="flex flex-wrap gap-2">
                    {["Call Center", "Speed of Service", "Quality of Service", "Cost of Service", "Product Experience"].map((l1) => (
                      <button
                        key={l1}
                        onClick={() => toggleL1(l1)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                          formData.drivers[l1] 
                            ? 'bg-[#003b6d] border-[#003b6d] text-white shadow-lg' 
                            : 'bg-white border-gray-100 text-gray-400 hover:border-[#0092d0]/30'
                        }`}
                      >
                        {l1}
                      </button>
                    ))}
                  </div>
                </div>

                {Object.keys(formData.drivers).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(formData.drivers).map((l1) => (
                      <div key={l1} className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-[10px] font-black uppercase text-[#003b6d] mb-2 tracking-widest opacity-60">
                          {l1} - {getNpsCategory(formData.nps).toUpperCase()} Details
                        </label>
                        <div className="space-y-1.5 max-h-[150px] overflow-y-auto border-2 rounded-xl p-3 bg-white scrollbar-thin">
                          {(DRIVERS[getNpsCategory(formData.nps)] as any)[l1]?.map((l2: string) => (
                            <label key={l2} className="flex items-start gap-2.5 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                              <input
                                type="checkbox"
                                checked={formData.drivers[l1]?.includes(l2)}
                                onChange={() => toggleL2(l1, l2)}
                                className="mt-0.5 w-3.5 h-3.5 text-[#0092d0] rounded border-gray-300 focus:ring-[#0092d0]"
                              />
                              <span className="text-[11px] font-medium text-gray-600 leading-tight group-hover:text-[#003b6d]">{l2}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Customer Verbatim</label>
                <textarea
                  className="w-full p-4 border-2 rounded-2xl h-24 font-medium text-gray-700 focus:border-[#0092d0] outline-none bg-white"
                  placeholder="Enter specific customer comments here..."
                  value={formData.verbatim}
                  onChange={(e) => setFormData({...formData, verbatim: e.target.value})}
                ></textarea>
              </div>

              <div className="flex justify-between pt-4">
                <button onClick={handlePrev} className="px-8 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-colors uppercase text-xs tracking-widest">Back</button>
                <button 
                  onClick={handleSubmit}
                  disabled={loading || Object.keys(formData.drivers).length === 0}
                  className="px-10 py-3 bg-green-600 text-white rounded-xl font-black uppercase tracking-[0.2em] hover:bg-green-700 shadow-xl shadow-green-900/20 disabled:opacity-50 flex items-center gap-2 text-xs transition-all active:scale-95"
                >
                  {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Finalize Survey
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#003b6d]">Assigned Happy Calls</h2>
        <div className="bg-[#f4fbff] px-4 py-2 rounded-full border border-[#0092d0] text-[#0092d0] text-sm font-bold">
          Target: 10 / Day
        </div>
      </div>
      
      <div className="grid gap-4">
        {calls.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-gray-400">
            <ClipboardCheck className="w-12 h-12 mb-2 opacity-20" />
            <p className="font-medium">No pending happy calls assigned.</p>
            <p className="text-xs">New assignments will appear here once uploaded by a supervisor.</p>
          </div>
        ) : (
          calls.map((call) => (
            <div key={call.id} className="bg-white p-4 rounded-xl shadow-sm border hover:border-[#0092d0] transition-all group">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-[#003b6d]">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{call.customerName}</h3>
                    <div className="flex items-center text-xs text-gray-500 gap-3 mt-1">
                      <span className="flex items-center"><Phone className="w-3 h-3 mr-1" /> {call.phone}</span>
                      <span className="flex items-center tracking-tighter"><Package className="w-3 h-3 mr-1" /> {call.status === 'issue_resolved' ? call.newWorkOrderNo : call.id}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {call.status === 'issue_resolved' && (
                    <span className="px-2 py-1 bg-red-100 text-red-600 text-[8px] font-black rounded uppercase">Re-call recovery</span>
                  )}
                  <button 
                    onClick={() => setSelectedCall(call)}
                    className="flex items-center gap-2 bg-[#003b6d] text-white px-4 py-2 rounded-lg hover:bg-[#005696]"
                  >
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
