import React, { useMemo } from 'react';
import { Trophy, TrendingUp, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardProps {
  completedCalls: any[];
}

export const ExecutiveDashboard: React.FC<DashboardProps> = ({ completedCalls }) => {
  const stats = useMemo(() => {
    if (!completedCalls.length) return null;

    const promoters = completedCalls.filter(c => c.nps_score >= 9).length;
    const detractors = completedCalls.filter(c => c.nps_score <= 6).length;
    const total = completedCalls.length;
    const nps = Math.round(((promoters - detractors) / total) * 100);
    
    const resolved = completedCalls.filter(c => c.is_working).length;
    const csat = Math.round((resolved / total) * 100);

    // Branch Ranking
    const branchMap: Record<string, { total: number, score: number, resolved: number }> = {};
    completedCalls.forEach(c => {
      const branch = c.service_center || 'Unknown';
      if (!branchMap[branch]) branchMap[branch] = { total: 0, score: 0, resolved: 0 };
      branchMap[branch].total++;
      branchMap[branch].score += c.nps_score;
      if (c.is_working) branchMap[branch].resolved++;
    });

    const branchData = Object.entries(branchMap).map(([name, data]) => ({
      name,
      avgNps: Number((data.score / data.total).toFixed(1)),
      resolutionRate: Math.round((data.resolved / data.total) * 100)
    })).sort((a, b) => b.avgNps - a.avgNps);

    // Tech Ranking
    const techMap: Record<string, { total: number, score: number }> = {};
    completedCalls.forEach(c => {
      const tech = c.technician_name || 'N/A';
      if (!techMap[tech]) techMap[tech] = { total: 0, score: 0 };
      techMap[tech].total++;
      techMap[tech].score += c.nps_score;
    });

    const techData = Object.entries(techMap).map(([name, data]) => ({
      name,
      avgNps: Number((data.score / data.total).toFixed(1))
    })).sort((a, b) => b.avgNps - a.avgNps).slice(0, 5);

    return { nps, csat, total, branchData, techData, promoters, detractors, passives: total - promoters - detractors };
  }, [completedCalls]);

  if (!stats) return (
    <div className="p-20 text-center bg-white rounded-3xl border-4 border-dashed border-gray-50">
      <TrendingUp className="w-16 h-16 text-gray-100 mx-auto mb-4" />
      <p className="text-gray-400 font-bold uppercase tracking-widest">Awaiting data for analysis...</p>
    </div>
  );

  const COLORS = ['#22c55e', '#ef4444', '#eab308'];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Overall NPS</p>
          <div className="flex items-baseline gap-2">
            <h3 className={`text-4xl font-black ${stats.nps >= 50 ? 'text-green-500' : 'text-amber-500'}`}>{stats.nps}</h3>
            <span className="text-xs font-bold text-gray-400">Score</span>
          </div>
          <div className="mt-4 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#0092d0]" style={{ width: `${Math.max(0, Math.min(100, stats.nps + 50))}%` }} />
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
          <p className="text-[10px] font-black text-[#0092d0] uppercase tracking-widest mb-1">Health Check</p>
          <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Excellent</h3>
          <div className="flex gap-2 mt-4">
            <div className="flex-1 h-1 bg-green-500 rounded-full" />
            <div className="flex-1 h-1 bg-green-500 rounded-full" />
            <div className="flex-1 h-1 bg-green-500/20 rounded-full" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch Ranking Chart */}
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-black text-[#003b6d] uppercase tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Branch Performance Ranking
            </h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.branchData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} fontWeight="bold" />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="avgNps" fill="#0092d0" radius={[0, 10, 10, 0]} barSize={20} />
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
    </div>
  );
};
