import React, { useMemo, useState } from 'react';
import { 
  MessageSquare, 
  Calendar, 
  ArrowLeft, 
  Download, 
  ThumbsUp, 
  ThumbsDown, 
  Filter, 
  User
} from 'lucide-react';

interface TechScorecardProps {
  technicianName: string;
  calls: any[];
  onBack: () => void;
}

export const TechnicianScorecard: React.FC<TechScorecardProps> = ({ technicianName, calls, onBack }) => {
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

  const stats = useMemo(() => {
    let techCalls = calls.filter(c => c.technician_name === technicianName);
    
    if (dateRange.start) {
      techCalls = techCalls.filter(c => new Date(c.created_at) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      techCalls = techCalls.filter(c => new Date(c.created_at) <= end);
    }

    if (!techCalls.length) return null;

    const total = techCalls.length;
    // Only count calls that have a score for NPS calculation
    const scoredCalls = techCalls.filter(c => c.nps_score !== null && c.nps_score !== undefined);
    const totalScored = scoredCalls.length;

    const promoters = scoredCalls.filter(c => c.nps_score >= 9);
    const passives = scoredCalls.filter(c => c.nps_score >= 7 && c.nps_score <= 8);
    const detractors = scoredCalls.filter(c => c.nps_score <= 6);

    const promotersCount = promoters.length;
    const passivesCount = passives.length;
    const detractorsCount = detractors.length;

    const nps = totalScored > 0 
      ? Math.round(((promotersCount - detractorsCount) / totalScored) * 100) 
      : 0;
    
    const resolved = techCalls.filter(c => c.is_working).length;
    const csat = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const compliance = {
      uniform: Math.round((techCalls.filter(c => c.compliance_uniform).length / total) * 100),
      politeness: Math.round((techCalls.filter(c => c.compliance_politeness).length / total) * 100),
      explanation: Math.round((techCalls.filter(c => c.compliance_explanation).length / total) * 100),
      cleanup: Math.round((techCalls.filter(c => c.compliance_cleanup).length / total) * 100),
      receipt: Math.round((techCalls.filter(c => c.compliance_receipt).length / total) * 100),
    };

    const positiveComments = scoredCalls
      .filter(c => c.nps_score >= 9 && c.verbatim)
      .map(c => ({ text: c.verbatim, date: c.created_at, score: c.nps_score }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const negativeComments = scoredCalls
      .filter(c => c.nps_score <= 6 && c.verbatim)
      .map(c => ({ text: c.verbatim, date: c.created_at, score: c.nps_score }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const chartData = [
      { name: 'Uniform', value: compliance.uniform },
      { name: 'Polite', value: compliance.politeness },
      { name: 'Explain', value: compliance.explanation },
      { name: 'Cleanup', value: compliance.cleanup },
      { name: 'Receipt', value: compliance.receipt },
    ];

    return { 
      total, 
      totalScored,
      nps, 
      csat, 
      promotersCount, 
      passivesCount, 
      detractorsCount,
      compliance, 
      chartData, 
      positiveComments,
      negativeComments,
      recentJobs: techCalls.slice(0, 10) 
    };
  }, [technicianName, calls, dateRange]);

  if (!stats) return (
    <div className="p-12 text-center">
      <p className="text-gray-400 italic">No data found for the selected period.</p>
      <button onClick={() => setDateRange({ start: '', end: '' })} className="mt-4 text-[#0092d0] font-black uppercase text-xs">Reset Filters</button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div>
          <button onClick={onBack} className="text-xs font-black text-gray-400 hover:text-[#003b6d] uppercase tracking-widest flex items-center gap-2 mb-4">
            <ArrowLeft className="w-3 h-3" /> Back to Directory
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#003b6d] rounded-2xl flex items-center justify-center text-white">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-[#0092d0] uppercase tracking-[0.2em]">Service Engineer Profile</p>
              <h2 className="text-2xl font-black text-[#003b6d] uppercase leading-tight">{technicianName}</h2>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
            <Filter className="w-3 h-3 text-gray-400" />
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="text-[10px] font-bold border-none p-0 focus:ring-0 w-24"
              />
              <span className="text-gray-300 text-[10px] font-bold">TO</span>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="text-[10px] font-bold border-none p-0 focus:ring-0 w-24"
              />
            </div>
          </div>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-[#003b6d] text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#002b52] transition-colors shadow-lg shadow-blue-900/10"
          >
            <Download className="w-3 h-3" />
            Download Mobile Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
        {/* Left Column: Stats & Breakdown */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-[#0092d0]" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Net Promoter Score</p>
            <h3 className="text-6xl font-black text-[#003b6d] mb-1">{stats.nps}%</h3>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter mb-6">Technician Performance</p>
            
            <div className="grid grid-cols-3 gap-2 py-4 border-y border-gray-50 mb-6">
              <div>
                <p className="text-lg font-black text-green-500">{stats.promotersCount}</p>
                <p className="text-[7px] font-black text-gray-400 uppercase">Promoters</p>
              </div>
              <div>
                <p className="text-lg font-black text-yellow-500">{stats.passivesCount}</p>
                <p className="text-[7px] font-black text-gray-400 uppercase">Passives</p>
              </div>
              <div>
                <p className="text-lg font-black text-red-500">{stats.detractorsCount}</p>
                <p className="text-[7px] font-black text-gray-400 uppercase">Detractors</p>
              </div>
            </div>

            <div className="flex justify-between px-4">
              <div><p className="text-xs font-black text-gray-800">{stats.totalScored}</p><p className="text-[8px] font-black text-gray-400 uppercase">Responses</p></div>
              <div><p className="text-xs font-black text-green-500">{stats.csat}%</p><p className="text-[8px] font-black text-gray-400 uppercase">Resolution</p></div>
              <div><p className="text-xs font-black text-[#0092d0]">{stats.total}</p><p className="text-[8px] font-black text-gray-400 uppercase">Total Jobs</p></div>
            </div>
          </div>

          <div className="bg-[#003b6d] p-8 rounded-3xl shadow-xl text-white">
            <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 opacity-60">Quality Compliance Breakdown</h4>
            <div className="space-y-4">
              {stats.chartData.map(d => (
                <div key={d.name}>
                  <div className="flex justify-between text-[10px] font-black uppercase mb-1.5">
                    <span>{d.name}</span>
                    <span className="text-[#0092d0]">{d.value}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0092d0]" style={{ width: `${d.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Feedback & History */}
        <div className="md:col-span-2 space-y-6">
          {/* Feedback Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Positive Comments */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-green-50 flex justify-between items-center bg-green-50/30">
                <h4 className="text-[10px] font-black text-green-700 uppercase tracking-widest flex items-center gap-2">
                  <ThumbsUp className="w-3 h-3" />
                  Positive Feedback
                </h4>
                <span className="text-[10px] font-bold text-green-600 uppercase">{stats.positiveComments.length}</span>
              </div>
              <div className="p-4 space-y-4 max-h-[250px] overflow-y-auto flex-1">
                {stats.positiveComments.length > 0 ? (
                  stats.positiveComments.map((comment, i) => (
                    <div key={i} className="bg-green-50/30 p-3 rounded-xl border border-green-100/50">
                      <p className="text-[11px] text-gray-700 italic leading-relaxed">"{comment.text}"</p>
                      <p className="text-[8px] font-bold text-green-600 mt-2 uppercase tracking-tighter">
                        {new Date(comment.date).toLocaleDateString()} • SCORE: {comment.score}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-8">No positive feedback yet.</p>
                )}
              </div>
            </div>

            {/* Negative Comments */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-red-50 flex justify-between items-center bg-red-50/30">
                <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest flex items-center gap-2">
                  <ThumbsDown className="w-3 h-3" />
                  Areas for Improvement
                </h4>
                <span className="text-[10px] font-bold text-red-600 uppercase">{stats.negativeComments.length}</span>
              </div>
              <div className="p-4 space-y-4 max-h-[250px] overflow-y-auto flex-1">
                {stats.negativeComments.length > 0 ? (
                  stats.negativeComments.map((comment, i) => (
                    <div key={i} className="bg-red-50/30 p-3 rounded-xl border border-red-100/50">
                      <p className="text-[11px] text-gray-700 italic leading-relaxed">"{comment.text}"</p>
                      <p className="text-[8px] font-bold text-red-600 mt-2 uppercase tracking-tighter">
                        {new Date(comment.date).toLocaleDateString()} • SCORE: {comment.score}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-8">No negative feedback recorded.</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <h4 className="text-sm font-black text-[#003b6d] uppercase tracking-widest flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0092d0]" />
                Recent Service History
              </h4>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Voice of Customer</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
              {stats.recentJobs.map((job: any) => (
                <div key={job.id} className="p-6 hover:bg-blue-50/30 transition-colors flex gap-6">
                  <div className="flex-shrink-0 text-center border-r pr-6 border-gray-100">
                    <p className="text-[10px] font-black text-gray-300 uppercase mb-1">Score</p>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white ${
                      job.nps_score >= 9 ? 'bg-green-500' : job.nps_score >= 7 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      {job.nps_score || '-'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h5 className="text-xs font-black text-[#003b6d] uppercase">{job.customer_name}</h5>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">WO: {job.work_order_no}</p>
                      </div>
                      <p className="text-[9px] font-bold text-gray-400">{new Date(job.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-start gap-2 bg-gray-50 p-3 rounded-xl">
                      <MessageSquare className="w-3 h-3 text-[#0092d0] mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-gray-600 italic leading-relaxed line-clamp-2">
                        "{job.verbatim || 'No comments provided.'}"
                      </p>
                    </div>
                    <div className="mt-3 flex gap-1">
                      {['U', 'P', 'E', 'C', 'R'].map((label, idx) => {
                        const vals = [job.compliance_uniform, job.compliance_politeness, job.compliance_explanation, job.compliance_cleanup, job.compliance_receipt];
                        return (
                          <span key={idx} className={`w-5 h-5 flex items-center justify-center rounded-md text-[8px] font-black border ${
                            vals[idx] ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-100 text-gray-200'
                          }`}>
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE REPORT - PRINT ONLY */}
      <div className="hidden print:block fixed inset-0 z-[9999] bg-white w-full h-full p-6 overflow-hidden">
        <div className="max-w-2xl mx-auto border-2 border-[#003b6d] rounded-[40px] p-8 min-h-full flex flex-col">
          <div className="text-center mb-6 border-b-2 border-[#003b6d] pb-4">
            <div className="flex justify-center items-center gap-2 mb-1">
              <div className="bg-[#003b6d] text-white px-3 py-1 font-black text-xl italic tracking-tighter">Midea</div>
              <div className="text-[#003b6d] font-bold text-xs uppercase tracking-[0.3em]">Service Excellence</div>
            </div>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Technician Performance Card • {new Date().toLocaleDateString()}</p>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-3xl font-black text-[#003b6d] uppercase leading-none">{technicianName}</h2>
            <p className="text-[10px] font-bold text-[#0092d0] uppercase tracking-widest mt-1">Service Engineer Profile</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-3xl text-center border border-gray-100">
              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Net Promoter Score</p>
              <p className="text-4xl font-black text-[#003b6d]">{stats.nps}%</p>
              <div className="mt-2 flex justify-center gap-2 text-[8px] font-bold">
                <span className="text-green-600">P: {stats.promotersCount}</span>
                <span className="text-red-600">D: {stats.detractorsCount}</span>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-3xl text-center border border-gray-100">
              <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Resolution Rate</p>
              <p className="text-4xl font-black text-[#0092d0]">{stats.csat}%</p>
              <p className="text-[8px] font-bold text-gray-500 mt-2 uppercase">Total Jobs: {stats.total}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-[8px] font-black text-[#003b6d] uppercase tracking-widest mb-3 border-b pb-1">Quality Compliance</h3>
            <div className="grid grid-cols-1 gap-2">
              {stats.chartData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-[10px]">
                  <span className="font-black text-gray-600 uppercase w-16">{d.name}</span>
                  <div className="flex-1 mx-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#003b6d]" style={{ width: `${d.value}%` }} />
                  </div>
                  <span className="font-black text-[#003b6d] w-8 text-right">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 flex-1">
            {stats.positiveComments.length > 0 && (
              <div>
                <h3 className="text-[8px] font-black text-green-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <ThumbsUp className="w-2.5 h-2.5" /> Customer Highlights
                </h3>
                <div className="space-y-2">
                  {stats.positiveComments.slice(0, 2).map((c, i) => (
                    <div key={i} className="bg-green-50 p-3 rounded-2xl border border-green-100 italic text-[10px] text-gray-700 leading-tight">
                      "{c.text}"
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.negativeComments.length > 0 && (
              <div>
                <h3 className="text-[8px] font-black text-red-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <ThumbsDown className="w-2.5 h-2.5" /> Improvement Areas
                </h3>
                <div className="space-y-2">
                  {stats.negativeComments.slice(0, 2).map((c, i) => (
                    <div key={i} className="bg-red-50 p-3 rounded-2xl border border-red-100 italic text-[10px] text-gray-700 leading-tight">
                      "{c.text}"
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-center mt-6 pt-4 border-t border-gray-100 text-[8px] font-bold text-gray-300 uppercase tracking-[0.2em]">
            Official Performance Report • Midea Customer Care
          </div>
        </div>
      </div>
    </div>
  );
};
