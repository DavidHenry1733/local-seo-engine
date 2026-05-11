import React, { useState } from "react";
import { Check, ChevronRight, Activity, TrendingUp, RefreshCw, Play, BarChart2, Globe, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STAGES = [
  { id: 1, label: "Profile" },
  { id: 2, label: "Service Areas" },
  { id: 3, label: "Keywords" },
  { id: 4, label: "Content" },
  { id: 5, label: "Generate" },
  { id: 6, label: "Deploy" },
  { id: 7, label: "Indexing" },
  { id: 8, label: "Done" },
];

const INDEX_STATS = [
  { label: "Total Pages", value: "128" },
  { label: "Indexed", value: "112" },
  { label: "Pending", value: "16" },
  { label: "Errors", value: "0", danger: false },
];

const KEYWORD_RANKINGS = [
  { keyword: "web design rotherham", url: "/web-design-rotherham", position: 3, change: "+2", volume: "1,200", difficulty: "Medium" },
  { keyword: "seo agency rotherham", url: "/local-seo-rotherham", position: 5, change: "+1", volume: "850", difficulty: "High" },
  { keyword: "affordable web design barnsley", url: "/web-design-barnsley", position: 1, change: "0", volume: "450", difficulty: "Low" },
  { keyword: "local seo expert sheffield", url: "/local-seo-sheffield", position: 8, change: "+4", volume: "2,100", difficulty: "Hard" },
  { keyword: "ecommerce website design", url: "/ecommerce-web-design", position: 12, change: "-1", volume: "3,500", difficulty: "Hard" },
];

export function CleanStepper() {
  const currentStage = 8;
  const [isChecking, setIsChecking] = useState(false);

  const handleRunCheck = () => {
    setIsChecking(true);
    setTimeout(() => setIsChecking(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-white text-[#111827] font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Floating Top Context Bar */}
      <div className="absolute top-6 right-6 flex items-center gap-3 bg-white border border-[#E2E8F0] shadow-sm rounded-full py-1.5 pr-2 pl-4 text-sm z-10">
        <span className="font-medium text-gray-700">Rotherham Web Design Rollout</span>
        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-0 rounded-full px-2">
          Production
        </Badge>
        <div className="h-7 w-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
          JD
        </div>
      </div>

      <div className="max-w-[860px] mx-auto pt-24 pb-32 px-6">
        
        {/* Stepper Progress */}
        <div className="mb-16">
          <div className="flex items-center justify-between relative">
            {/* Connecting Lines Background */}
            <div className="absolute left-0 right-0 top-4 h-[2px] bg-[#E2E8F0] -z-10 w-[calc(100%-2rem)] mx-auto" />
            
            {/* Active connecting line (up to current) */}
            <div 
              className="absolute left-0 top-4 h-[2px] bg-indigo-600 -z-10 transition-all duration-500 ease-in-out"
              style={{ width: `calc(${(currentStage - 1) / (STAGES.length - 1) * 100}% - 1rem)` }}
            />

            {STAGES.map((stage) => {
              const isCompleted = stage.id < currentStage;
              const isActive = stage.id === currentStage;
              const isUpcoming = stage.id > currentStage;

              return (
                <div key={stage.id} className="flex flex-col items-center gap-3 relative z-0 w-16">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-200 border-2
                      ${isCompleted ? 'bg-indigo-600 border-indigo-600 text-white' : ''}
                      ${isActive ? 'bg-white border-indigo-600 text-indigo-600' : ''}
                      ${isUpcoming ? 'bg-white border-[#E2E8F0] text-gray-400' : ''}
                    `}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : stage.id}
                  </div>
                  <span 
                    className={`text-[11px] font-medium tracking-wide uppercase text-center absolute top-11 whitespace-nowrap
                      ${isActive ? 'text-indigo-600' : 'text-gray-400'}
                    `}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-3">Stage 8 — Indexing & Rankings</h1>
          <p className="text-[15px] text-gray-500 max-w-lg mx-auto leading-relaxed">
            Monitor Google Search Console indexing status and track initial keyword ranking movements for your deployed cluster pages.
          </p>
        </div>

        {/* Content Cards */}
        <div className="space-y-6">
          
          {/* Index Tracking Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-[16px] shadow-sm overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Index Tracking</h2>
                    <p className="text-sm text-gray-500">Google Search Console Coverage</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" className="text-gray-600 border-gray-200 bg-white hover:bg-gray-50">
                    <Activity className="w-4 h-4 mr-2" />
                    View GSC
                  </Button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex flex-wrap gap-3">
                {INDEX_STATS.map((stat, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-full border border-gray-100 bg-gray-50/50">
                    <span className="text-sm font-medium text-gray-500">{stat.label}</span>
                    <span className={`text-lg font-bold ${stat.danger ? 'text-red-600' : 'text-gray-900'}`}>
                      {stat.value}
                    </span>
                  </div>
                ))}
                
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-full border border-green-100 bg-green-50/50 sm:ml-auto">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-700">Healthy</span>
                </div>
              </div>
            </div>
          </div>

          {/* Keyword Rankings Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-[16px] shadow-sm overflow-hidden">
            <div className="p-6 md:p-8 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <BarChart2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Keyword Rankings</h2>
                    <p className="text-sm text-gray-500">Initial SERP positions for target clusters</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 md:px-8 py-3 font-medium">Target Keyword</th>
                    <th className="px-6 py-3 font-medium">Position</th>
                    <th className="px-6 py-3 font-medium hidden sm:table-cell">Change</th>
                    <th className="px-6 py-3 font-medium hidden md:table-cell">Vol / Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {KEYWORD_RANKINGS.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 md:px-8 py-4">
                        <div className="font-medium text-gray-900 mb-1">{row.keyword}</div>
                        <div className="text-xs text-gray-400 font-mono truncate max-w-[200px] sm:max-w-xs">{row.url}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                           {row.position <= 3 ? (
                             <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">#{row.position}</Badge>
                           ) : row.position <= 10 ? (
                             <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-0">#{row.position}</Badge>
                           ) : (
                             <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100 border-0">#{row.position}</Badge>
                           )}
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <div className={`flex items-center text-xs font-medium
                          ${row.change.startsWith('+') ? 'text-green-600' : row.change.startsWith('-') ? 'text-red-600' : 'text-gray-400'}
                        `}>
                          {row.change !== "0" && <TrendingUp className={`w-3 h-3 mr-1 ${row.change.startsWith('-') ? 'rotate-180' : ''}`} />}
                          {row.change === "0" ? "-" : row.change}
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-gray-500">
                        {row.volume} <span className="text-gray-300 mx-1">/</span> {row.difficulty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-50 bg-gray-50/30 text-center">
               <Button variant="link" className="text-indigo-600 h-auto p-0 text-sm font-medium">
                 View all 48 tracked keywords <ChevronRight className="w-4 h-4 ml-1" />
               </Button>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 border-t border-gray-100 pt-8">
          <Button 
            variant="ghost" 
            size="lg" 
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full px-6"
            disabled={isChecking}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <Button 
            size="lg" 
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 shadow-sm shadow-indigo-200"
            onClick={handleRunCheck}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Running Check...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2 fill-current" />
                Run Fresh Check
              </>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
