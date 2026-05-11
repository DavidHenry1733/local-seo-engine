import React from "react";
import { 
  CheckCircle2, 
  ChevronRight, 
  ArrowUp, 
  ArrowDown, 
  Minus,
  Search,
  ExternalLink,
  RefreshCw,
  Settings,
  MoreVertical,
  Activity,
  Globe,
  TrendingUp,
  FileText,
  MapPin,
  Building,
  Key,
  LayoutTemplate,
  Wand2,
  Rocket,
  LineChart
} from "lucide-react";

export function CommandCenter() {
  const stages = [
    { id: 1, name: "Business Profile", icon: Building, status: "complete" },
    { id: 2, name: "Service Areas", icon: MapPin, status: "complete" },
    { id: 3, name: "Keywords", icon: Key, status: "complete" },
    { id: 4, name: "Content Structure", icon: LayoutTemplate, status: "complete" },
    { id: 5, name: "Generate Assets", icon: Wand2, status: "complete" },
    { id: 6, name: "Deploy Pages", icon: Rocket, status: "complete" },
    { id: 7, name: "Track & Index", icon: LineChart, status: "active" },
  ];

  const keywords = [
    { keyword: "web design sheffield", position: 2, change: 1, url: "/web-design-sheffield", date: "2 hours ago" },
    { keyword: "seo agency rotherham", position: 5, change: -2, url: "/seo-rotherham", date: "2 hours ago" },
    { keyword: "local seo expert barnsley", position: 1, change: 0, url: "/local-seo-barnsley", date: "3 hours ago" },
    { keyword: "affordable web designer near me", position: 8, change: 3, url: "/web-design-sheffield/affordable", date: "5 hours ago" },
    { keyword: "ecommerce website builder leeds", position: 12, change: 4, url: "/ecommerce-leeds", date: "1 day ago" },
    { keyword: "wordpress developer sheffield", position: 3, change: 0, url: "/wordpress-sheffield", date: "1 day ago" },
    { keyword: "business website design rotherham", position: 7, change: -1, url: "/web-design-rotherham", date: "1 day ago" },
  ];

  return (
    <div className="min-h-screen w-full flex bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#0F172A] text-slate-300 flex flex-col fixed h-full border-r border-slate-800">
        <div className="p-4 flex items-center gap-3 border-b border-slate-800/50">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-white tracking-tight">GeoBuilder</span>
        </div>

        <div className="px-3 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
          Project Setup
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {stages.map((stage) => {
            const isActive = stage.status === "active";
            const isComplete = stage.status === "complete";
            return (
              <a
                key={stage.id}
                href="#"
                className={`group flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive 
                    ? "bg-[#1E293B] text-indigo-400" 
                    : "hover:bg-[#1E293B] hover:text-white text-slate-400"
                }`}
              >
                <span className={`flex items-center justify-center w-5 h-5 rounded text-[10px] ${
                  isActive ? "bg-indigo-500/20 text-indigo-400" : 
                  isComplete ? "bg-transparent" : "bg-slate-800 text-slate-500"
                }`}>
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    stage.id
                  )}
                </span>
                <span className="flex-1 truncate">{stage.name}</span>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
              </a>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full">
            <Settings className="w-4 h-4" />
            <span>Project Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-[240px] flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 px-8 flex items-center justify-between border-b border-slate-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Projects</span>
              <ChevronRight className="w-4 h-4" />
              <span className="font-medium text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                InboxingProWeb Local
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Live Deployment
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 h-9 rounded-md px-3 text-slate-600 shadow-sm">
              <RefreshCw className="w-4 h-4" />
              Refresh Data
            </button>
            <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 h-9 rounded-md px-4 shadow-sm">
              View Live Site
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 max-w-[1200px] w-full mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Track & Index</h1>
            <p className="text-slate-500 mt-1">Monitor search console indexing and keyword positions across your generated pages.</p>
          </div>

          {/* Indexing Stats Row */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Total Pages
              </div>
              <div className="text-3xl font-bold text-slate-900">142</div>
              <div className="text-xs text-slate-500 mt-2">+12 this week</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                Indexed
              </div>
              <div className="text-3xl font-bold text-emerald-600">128</div>
              <div className="text-xs font-medium text-emerald-600 mt-2 bg-emerald-50 inline-flex px-2 py-0.5 rounded-full">+4 newly indexed</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                Not Indexed
              </div>
              <div className="text-3xl font-bold text-slate-900">14</div>
              <div className="text-xs text-amber-600 font-medium mt-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Crawled, not indexed
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                <Activity className="w-4 h-4 text-slate-400" />
                Index Coverage
              </div>
              <div className="flex items-end gap-2">
                <div className="text-3xl font-bold text-slate-900">90.1%</div>
              </div>
              <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
                <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '90.1%' }}></div>
              </div>
            </div>
          </div>

          {/* Keyword Rankings Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-slate-900">Keyword Rankings</h2>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filter keywords..." 
                  className="h-9 w-64 rounded-md border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200 uppercase font-medium">
                  <tr>
                    <th className="px-6 py-3 tracking-wider">Position</th>
                    <th className="px-6 py-3 tracking-wider">Keyword</th>
                    <th className="px-6 py-3 tracking-wider">Target Page</th>
                    <th className="px-6 py-3 tracking-wider text-right">Last Checked</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {keywords.map((kw, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-md font-bold text-sm shadow-sm ${
                            kw.position <= 3 ? "bg-amber-100 text-amber-700 border border-amber-200" :
                            kw.position <= 10 ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                            "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            #{kw.position}
                          </span>
                          <span className={`flex items-center text-xs font-medium ${
                            kw.change > 0 ? "text-emerald-600" : 
                            kw.change < 0 ? "text-red-600" : "text-slate-400"
                          }`}>
                            {kw.change > 0 ? <ArrowUp className="w-3 h-3 mr-0.5" /> : 
                             kw.change < 0 ? <ArrowDown className="w-3 h-3 mr-0.5" /> : 
                             <Minus className="w-3 h-3 mr-0.5" />}
                            {Math.abs(kw.change) || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{kw.keyword}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 cursor-pointer">
                          <span className="truncate max-w-[200px]">{kw.url}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-slate-500">
                        {kw.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm">
              <span className="text-slate-500">Showing 1-7 of 42 tracked keywords</span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 border border-slate-200 rounded text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled>Previous</button>
                <button className="px-3 py-1 border border-slate-200 rounded text-slate-600 bg-white hover:bg-slate-50">Next</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
