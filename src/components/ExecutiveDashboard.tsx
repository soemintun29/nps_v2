import React, { useMemo, useState, useEffect } from 'react';
import { Trophy, TrendingUp, Star, Calendar, Users, LineChart as LineChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, AreaChart, Area } from 'recharts';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  completedCalls: any[];
  allCalls?: any[];
}

export const ExecutiveDashboard: React.FC<DashboardProps> = ({ completedCalls, allCalls = [] }) => {
  const [npsTarget, setNpsTarget] = useState<number>(40);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5); // Show last 6 months by default
    d.setDate(1); 
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    const fetchTarget = async () => {
      try {
        const { data } = await supabase.from('settings').select('value').eq('key', 'nps_target').single();
        if (data) setNpsTarget(Number(data.value));
      } catch (err) {
        console.error('Error fetching NPS target:', err);
      }
    };
    fetchTarget();
  }, []);

  const filteredData = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filteredCompleted = completedCalls.filter(c => {
      const date = new Date(c.created_at);
      return date >= start && date <= end;
    });

    const filteredAll = allCalls.filter(c => {
      const date = new Date(c.created_at);
      return date >= start && date <= end;
    });

    return { filteredCompleted, filteredAll };
  }, [completedCalls, allCalls, startDate, endDate]);

  const stats = useMemo(() => {
    const { filteredCompleted } = filteredData;
    if (!filteredCompleted.length) return null;

    const validCalls = filteredCompleted.filter(c => c.status !== 'refused');
    const promoters = validCalls.filter(c => (c.nps_score ?? 0) >= 9).length;
    const detractors = validCalls.filter(c => (c.nps_score ?? 0) <= 6).length;
    const totalValid = validCalls.length;
    const totalAll = filteredCompleted.length;
    
    const nps = totalValid > 0 ? Math.round(((promoters - detractors) / totalValid) * 100) : 0;
    
    const resolved = validCalls.filter(c => c.is_working).length;
    const csat = totalValid > 0 ? Math.round((resolved / totalValid) * 100) : 0;

    // Monthly Trend Analysis
    const monthlyGroups: Record<string, { total: number, promoters: number, detractors: number, sortKey: string }> = {};
    
    validCalls.forEach(c => {
      const date = new Date(c.created_at);
      const monthLabel = date.toLocaleString('default', { month: 'short' });
      const yearLabel = date.getFullYear().toString().slice(-2);
      const label = `${monthLabel} '${yearLabel}`;
      const sortKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!monthlyGroups[label]) {
        monthlyGroups[label] = { total: 0, promoters: 0, detractors: 0, sortKey };
      }
      
      monthlyGroups[label].total++;
      const score = c.nps_score ?? 0;
      if (score >= 9) monthlyGroups[label].promoters++;
      else if (score <= 6) monthlyGroups[label].detractors++;
    });

    const trendData = Object.entries(monthlyGroups)
      .map(([name, data]) => ({
        name,
        nps: Math.round(((data.promoters - data.detractors) / data.total) * 100),
        sortKey: data.sortKey
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Branch Ranking
    const branchMap: Record<string, { total: number, promoters: number, detractors: number, resolved: number }> = {};
    validCalls.forEach(c => {
      const branch = c.service_center || 'Unknown';
      if (!branchMap[branch]) branchMap[branch] = { total: 0, promoters: 0, detractors: 0, resolved: 0 };
      branchMap[branch].total++;
      const score = c.nps_score ?? 0;
      if (score >= 9) branchMap[branch].promoters++;
      else if (score <= 6) branchMap[branch].detractors++;
      
      if (c.is_working) branchMap[branch].resolved++;
    });

    const branchData = Object.entries(branchMap).map(([name, data]) => ({
      name,
      nps: Math.round(((data.promoters - data.detractors) / data.total) * 100),
      resolutionRate: Math.round((data.resolved / data.total) * 100)
    })).sort((a, b) => b.nps - a.nps);

    // Tech Ranking
    const techMap: Record<string, { total: number, score: number }> = {};
    validCalls.forEach(c => {
      const tech = c.technician_name || 'N/A';
      if (!techMap[tech]) techMap[tech] = { total: 0, score: 0 };
      techMap[tech].total++;
      techMap[tech].score += (c.nps_score ?? 0);
    });

    const techData = Object.entries(techMap).map(([name, data]) => ({
      name,
      avgNps: Number((data.score / data.total).toFixed(1))
    })).sort((a, b) => b.avgNps - a.avgNps).slice(0, 5);

    // Agent Metrics
    const agentMap: Record<string, { handled: number, completed: number, refused: number, pending: number }> = {};
    
    // Process all calls assigned to agents to count pending (current state)
    allCalls.forEach(c => {
      const agent = c.agent_name || 'Unassigned';
      if (!agentMap[agent]) agentMap[agent] = { handled: 0, completed: 0, refused: 0, pending: 0 };
      
      const isFinished = ['completed', 'escalation_completed', 'refused'].includes(c.status);
      if (!isFinished && agent !== 'Unassigned') {
        agentMap[agent].pending++;
      }
    });

    // Process handled calls in the selected period
    filteredData.filteredCompleted.forEach(c => {
      const agent = c.agent_name || 'Unassigned';
      if (!agentMap[agent]) agentMap[agent] = { handled: 0, completed: 0, refused: 0, pending: 0 };
      
      agentMap[agent].handled++;
      if (c.status === 'refused') {
        agentMap[agent].refused++;
      } else {
        agentMap[agent].completed++;
      }
    });

    const agentData = Object.entries(agentMap)
      .filter(([name]) => name !== 'Unassigned')
      .map(([name, data]) => ({
        name,
        ...data,
        completedRate: data.handled > 0 ? Math.round((data.completed / data.handled) * 100) : 0,
        refuseRate: data.handled > 0 ? Math.round((data.refused / data.handled) * 100) : 0
      }))
      .sort((a, b) => b.handled - a.handled);

    return { nps, csat, total: totalAll, trendData, branchData, techData, agentData, promoters, detractors, passives: totalValid - promoters - detractors };
  }, [filteredData, allCalls]);

  const COLORS = ['#22c55e', '#ef4444', '#eab308'];

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-lg border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0092d0]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#003b6d] uppercase">Performance Period</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase">Filter analysis by date range</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <label className="text-[8px] font-black text-gray-400 uppercase ml-1 mb-0.5">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 bg-gray-50 border-0 rounded-xl text-xs font-bold text-[#003b6d] focus:ring-2 focus:ring-[#0092d0] outline-none"
            />
          </div>
          <div className="h-8 w-px bg-gray-100 self-end mb-1" />
          <div className="flex flex-col">
            <label className="text-[8px] font-black text-gray-400 uppercase ml-1 mb-0.5">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 bg-gray-50 border-0 rounded-xl text-xs font-bold text-[#003b6d] focus:ring-2 focus:ring-[#0092d0] outline-none"
            />
          </div>
        </div>
      </div>

      {!stats ? (
        <div className="p-20 text-center bg-white rounded-3xl border-4 border-dashed border-gray-50">
          <TrendingUp className="w-16 h-16 text-gray-100 mx-auto mb-4" />
          <p className="text-gray-400 font-bold uppercase tracking-widest">No data found for this period...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Overall NPS</p>
                <span className="text-[10px] font-black text-[#0092d0] bg-blue-50 px-2 py-0.5 rounded-full uppercase">Target: {npsTarget}%</span>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className={`text-4xl font-black ${stats.nps >= npsTarget ? 'text-green-500' : 'text-amber-500'}`}>{stats.nps}%</h3>
                <span className="text-xs font-bold text-gray-400">Score</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#0092d0]" style={{ width: `${Math.max(0, Math.min(100, stats.nps + 50))}%` }} />
                </div>
                <span className={`text-[10px] font-black ${stats.nps >= npsTarget ? 'text-green-500' : 'text-amber-500'}`}>
                  {stats.nps >= npsTarget ? `+${stats.nps - npsTarget}%` : `${stats.nps - npsTarget}%`}
                </span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Resolution Rate</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-black text-[#003b6d]">{stats.csat}%</h3>
                <span className="text-xs font-bold text-gray-400">CSAT</span>
              </div>
              <div className="mt-4 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${stats.csat}%` }} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Surveys</p>
              <h3 className="text-4xl font-black text-gray-800">{stats.total}</h3>
              <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">Completed Interactions</p>
            </div>

            <div className="bg-[#003b6d] p-6 rounded-3xl shadow-xl border border-[#003b6d]">
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black text-[#0092d0] uppercase tracking-widest mb-1">Health Check</p>
                <div className={`w-2 h-2 rounded-full ${stats.nps >= npsTarget ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tighter">
                {stats.nps >= npsTarget ? 'Excellent' : stats.nps >= (npsTarget / 2) ? 'Good' : 'Action Needed'}
              </h3>
              <div className="flex gap-2 mt-4">
                <div className="flex-1 h-1 bg-green-500 rounded-full" />
                <div className="flex-1 h-1 bg-green-500 rounded-full" />
                <div className={`flex-1 h-1 rounded-full ${stats.nps >= npsTarget ? 'bg-green-500' : 'bg-green-500/20'}`} />
              </div>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-black text-[#003b6d] uppercase tracking-tight flex items-center gap-2">
                  <LineChartIcon className="w-5 h-5 text-[#0092d0]" />
                  Monthly NPS Trend Analysis
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Longitudinal service quality performance</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#0092d0]" />
                  <span className="text-[10px] font-black text-gray-400 uppercase">NPS Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-[10px] font-black text-gray-400 uppercase">Target</span>
                </div>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trendData}>
                  <defs>
                    <linearGradient id="colorNps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0092d0" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0092d0" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    fontSize={10} 
                    fontWeight="bold" 
                    dy={10}
                  />
                  <YAxis 
                    domain={[-100, 100]} 
                    axisLine={false} 
                    tickLine={false} 
                    fontSize={10} 
                    fontWeight="bold"
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <ReferenceLine y={npsTarget} stroke="#ef4444" strokeDasharray="3 3" />
                  <Area 
                    type="monotone" 
                    dataKey="nps" 
                    stroke="#0092d0" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorNps)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Branch Ranking Chart */}
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg font-black text-[#003b6d] uppercase tracking-tight flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Branch Performance Ranking
                  </h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">NPS Score vs Target ({npsTarget}%)</p>
                </div>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.branchData} layout="vertical" margin={{ left: 40, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[-100, 100]} hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} fontWeight="bold" />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}} 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [`${value}% NPS`, 'Score']}
                    />
                    <ReferenceLine x={npsTarget} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'GOAL', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                    <Bar dataKey="nps" radius={[0, 10, 10, 0]} barSize={20}>
                      {stats.branchData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.nps >= npsTarget ? '#22c55e' : '#0092d0'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Breakdown & Leaderboard */}
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                <h3 className="text-sm font-black text-[#003b6d] uppercase tracking-widest mb-6">NPS Distribution</h3>
                <div className="flex items-center gap-8">
                  <div className="h-[150px] w-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[
                          { name: 'Promoters', value: stats.promoters },
                          { name: 'Detractors', value: stats.detractors },
                          { name: 'Passives', value: stats.passives }
                        ]} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                          {COLORS.map((color, index) => <Cell key={index} fill={color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Promoters (9-10)</span>
                      <span className="text-xs font-black text-green-500">{stats.promoters}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Passives (7-8)</span>
                      <span className="text-xs font-black text-amber-500">{stats.passives}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Detractors (0-6)</span>
                      <span className="text-xs font-black text-red-500">{stats.detractors}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                <h3 className="text-sm font-black text-[#003b6d] uppercase tracking-widest mb-4">Top 5 Technicians</h3>
                <div className="space-y-4">
                  {stats.techData.map((tech, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-gray-300">#0{i+1}</span>
                        <span className="text-xs font-black text-gray-700">{tech.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-xs font-black text-[#003b6d]">{tech.avgNps}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Agent Performance Table */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-[#003b6d] uppercase tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#0092d0]" />
                  Agent Productivity Metrics
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">Efficiency and engagement analysis per agent</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Agent Name</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Handled</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Completed</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Refused</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending</th>
                    <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Success Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.agentData.map((agent, i) => (
                    <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#003b6d] text-white flex items-center justify-center text-[10px] font-black">
                            {agent.name.charAt(0)}
                          </div>
                          <span className="text-xs font-black text-gray-700 uppercase">{agent.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-gray-600 text-xs">{agent.handled}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-green-600">{agent.completed}</span>
                          <span className="text-[8px] font-bold text-gray-400 uppercase">{agent.completedRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-red-500">{agent.refused}</span>
                          <span className="text-[8px] font-bold text-gray-400 uppercase">{agent.refuseRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${agent.pending > 5 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                          {agent.pending}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${agent.completedRate}%` }} />
                          </div>
                          <span className="text-xs font-black text-[#003b6d]">{agent.completedRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
