import React from "react";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  LayoutTemplate,
  MapPin,
  MessageSquare,
  Package,
  Play,
  Search,
  Settings,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  MoreHorizontal,
  Plus
} from "lucide-react";

export function GlassPro() {
  const stages = [
    { id: 1, name: "Business Profile", icon: Package, status: "complete" },
    { id: 2, name: "Service Areas", icon: MapPin, status: "complete" },
    { id: 3, name: "Keywords", icon: Search, status: "current" },
    { id: 4, name: "Content", icon: MessageSquare, status: "pending" },
    { id: 5, name: "Generate", icon: LayoutTemplate, status: "pending" },
    { id: 6, name: "Deploy", icon: Globe, status: "pending" },
    { id: 7, name: "Indexing", icon: Sparkles, status: "pending" },
    { id: 8, name: "Done", icon: CheckCircle2, status: "pending" },
  ];

  const keywords = [
    { id: 1, term: "emergency plumber austin", volume: "3.2k", kd: 45, currentRank: 12, change: 4 },
    { id: 2, term: "water heater repair near me", volume: "2.1k", kd: 38, currentRank: 3, change: 1 },
    { id: 3, term: "austin tx residential plumbing", volume: "850", kd: 22, currentRank: 8, change: 2 },
    { id: 4, term: "clogged drain repair 78704", volume: "450", kd: 15, currentRank: 1, change: 0 },
    { id: 5, term: "24/7 plumbing services", volume: "5.4k", kd: 65, currentRank: 24, change: -2 },
  ];

  return (
    <div 
      className="min-h-screen w-full flex flex-col font-sans text-white overflow-hidden relative"
      style={{
        backgroundColor: "#0D0B1E",
        backgroundImage: `
          radial-gradient(circle at 15% 50%, rgba(109, 40, 217, 0.15), transparent 25%),
          radial-gradient(circle at 85% 30%, rgba(37, 99, 235, 0.15), transparent 25%)
        `,
        fontFamily: "'Geist', 'Inter', sans-serif"
      }}
    >
      {/* Top Navigation */}
      <nav 
        className="h-14 w-full flex items-center justify-between px-6 z-10 shrink-0"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.2)"
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold tracking-wide text-sm">SEO Builder</span>
          <div className="h-4 w-[1px] bg-white/20 mx-2" />
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/80">
            <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
            Austin Plumbers LLC
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-white/60 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-emerald-400 border border-white/20 overflow-hidden">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover" />
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden z-10">
        {/* Left Sidebar */}
        <aside 
          className="w-[240px] flex flex-col p-4 shrink-0"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            borderRight: "1px solid rgba(255, 255, 255, 0.15)"
          }}
        >
          <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4 px-2">Setup Progress</div>
          <div className="flex flex-col gap-1">
            {stages.map((stage, idx) => {
              const isCurrent = stage.status === "current";
              const isComplete = stage.status === "complete";
              const Icon = stage.icon;
              
              return (
                <div 
                  key={stage.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${
                    isCurrent ? "bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]" : "hover:bg-white/5"
                  }`}
                  style={isCurrent ? { backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } : {}}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-colors ${
                    isCurrent ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.3)]" : 
                    isComplete ? "bg-green-500/20 text-green-400 border border-green-500/30" : 
                    "bg-white/5 text-white/40 border border-white/10"
                  }`}>
                    {isComplete ? <CheckCircle2 className="w-4 h-4" /> : stage.id}
                  </div>
                  <span className={`text-sm font-medium ${
                    isCurrent ? "text-white" : 
                    isComplete ? "text-white/80" : 
                    "text-white/40 group-hover:text-white/60"
                  }`}>
                    {stage.name}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            
            <div className="flex items-end justify-between mb-2">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Target Keywords</h1>
                <p className="text-white/60 text-sm">Select and prioritize the local search terms you want to target.</p>
              </div>
              <button 
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                  boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)",
                  textShadow: "0 1px 2px rgba(0,0,0,0.2)"
                }}
              >
                <span>Continue to Content</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Total Keywords", value: "24", glow: "rgba(99, 102, 241, 0.5)" },
                { label: "Total Search Volume", value: "14.2k", glow: "rgba(16, 185, 129, 0.5)" },
                { label: "Avg. Difficulty", value: "32", glow: "rgba(245, 158, 11, 0.5)" }
              ].map((stat, i) => (
                <div 
                  key={i}
                  className="rounded-2xl p-5 relative overflow-hidden group"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)"
                  }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ boxShadow: `inset 0 0 0 1px ${stat.glow}` }}
                  />
                  <div className="text-white/60 text-xs font-medium uppercase tracking-wider mb-2">{stat.label}</div>
                  <div 
                    className="text-4xl font-bold tracking-tight"
                    style={{ textShadow: `0 0 20px ${stat.glow}` }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            <div 
              className="rounded-2xl overflow-hidden mt-2 relative group"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)"
              }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.3)" }}
              />
              
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                <h3 className="font-semibold text-lg">Selected Keywords</h3>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input 
                      type="text" 
                      placeholder="Search keywords..." 
                      className="bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-sm outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all text-white placeholder:text-white/30"
                    />
                  </div>
                  <button className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/70">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-white/50 uppercase tracking-wider bg-black/20">
                      <th className="py-3 px-5 font-medium">Keyword</th>
                      <th className="py-3 px-5 font-medium text-right">Volume</th>
                      <th className="py-3 px-5 font-medium text-right">KD</th>
                      <th className="py-3 px-5 font-medium text-center">Current Rank</th>
                      <th className="py-3 px-5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((kw, idx) => {
                      const rankColor = 
                        kw.currentRank <= 3 ? "text-amber-300 border-amber-500/30 bg-amber-500/10 shadow-[0_0_10px_rgba(251,191,36,0.2)]" : 
                        kw.currentRank <= 10 ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_10px_rgba(52,211,153,0.2)]" : 
                        "text-blue-300 border-blue-500/30 bg-blue-500/10 shadow-[0_0_10px_rgba(96,165,250,0.2)]";

                      return (
                        <tr key={kw.id} className={`border-b border-white/5 transition-colors hover:bg-white/10 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}`}>
                          <td className="py-3 px-5 font-medium text-sm text-white/90">{kw.term}</td>
                          <td className="py-3 px-5 text-sm text-white/70 text-right">{kw.volume}</td>
                          <td className="py-3 px-5 text-right">
                            <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-white/80 border border-white/10">
                              {kw.kd}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${rankColor}`}>
                                #{kw.currentRank}
                              </span>
                              {kw.change !== 0 && (
                                <span className={`text-xs flex items-center ${kw.change > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {kw.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  {Math.abs(kw.change)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <button className="p-1 text-white/40 hover:text-white transition-colors rounded hover:bg-white/10">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
