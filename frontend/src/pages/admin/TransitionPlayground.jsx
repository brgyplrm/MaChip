import React, { useState } from "react";
import Sidebar from "../../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, RotateCcw, Play, Check, Copy, Layers, Zap, Eye, Code, ArrowRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const transitionPresets = [
  {
    id: "slide-up",
    name: "🌊 Subtle Slide Up",
    description: "Smooth upward glide with gentle fade-in. Elegant and professional.",
    containerClass: "animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out",
    cardDelayClass: (index) => `transition-all duration-500 delay-[${index * 100}ms]`,
    tailwindSnippet: "animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out",
    recommendedFor: "Dashboard pages, Analytics Hub, Reports"
  },
  {
    id: "fade-scale",
    name: "✨ Smooth Fade & Scale",
    description: "Subtle zoom scale effect from 95% to 100%. Modern app feel.",
    containerClass: "animate-in fade-in zoom-in-95 duration-400 ease-out",
    cardDelayClass: () => "",
    tailwindSnippet: "animate-in fade-in zoom-in-95 duration-400 ease-out",
    recommendedFor: "Modals, Profile Cards, Key Metrics"
  },
  {
    id: "staggered-wave",
    name: "🚀 Staggered Card Wave",
    description: "Cards enter sequentially with 120ms staggered delays.",
    containerClass: "animate-in fade-in duration-300",
    isStaggered: true,
    tailwindSnippet: "animate-in fade-in slide-in-from-bottom-3 duration-400 (staggered delay per card)",
    recommendedFor: "Grid layouts, Employee lists, Metric cards"
  },
  {
    id: "glow-reveal",
    name: "💜 Brand Glow Entrance",
    description: "Expands with a ambient purple brand halo glow that smoothly dissolves.",
    containerClass: "animate-in fade-in zoom-in-95 duration-600 shadow-[0_0_30px_rgba(42,23,78,0.2)]",
    tailwindSnippet: "animate-in fade-in zoom-in-95 duration-600 shadow-[0_0_30px_rgba(42,23,78,0.2)]",
    recommendedFor: "Featured cards, Hero sections, Summary metrics"
  },
  {
    id: "slide-right",
    name: "⚡ Brisk Slide Right",
    description: "Clean horizontal entrance from the left. Quick & snappy.",
    containerClass: "animate-in fade-in slide-in-from-left-6 duration-350 ease-out",
    tailwindSnippet: "animate-in fade-in slide-in-from-left-6 duration-350 ease-out",
    recommendedFor: "Sidebar tabs, Subtab panels, Drawer content"
  },
  {
    id: "glass-pulse",
    name: "💎 Glassmorphic Pulse",
    description: "Translucent backdrop filter with a soft breathing aura.",
    containerClass: "animate-in fade-in duration-700 backdrop-blur-md bg-white/80 border border-purple-100",
    tailwindSnippet: "backdrop-blur-md bg-white/80 animate-in fade-in duration-700",
    recommendedFor: "High-end summaries, Special alerts, Floating bars"
  },
  {
    id: "pop-bounce",
    name: "🎯 Springy Pop",
    description: "Energetic slight overshoot spring animation for interactive cards.",
    containerClass: "animate-in fade-in zoom-in-90 duration-300 [animation-timing-function:cubic-bezier(0.175,0.885,0.32,1.275)]",
    tailwindSnippet: "animate-in fade-in zoom-in-90 duration-300 [animation-timing-function:cubic-bezier(0.175,0.885,0.32,1.275)]",
    recommendedFor: "Action buttons, Quick tools, Notification badges"
  },
  {
    id: "elastic-bounce",
    name: "🌌 Elastic Bounce Reveal",
    description: "Overshoots scale gracefully for an engaging, high-energy entrance.",
    containerClass: "animate-in fade-in zoom-in-75 duration-600 [animation-timing-function:cubic-bezier(0.34,1.56,0.64,1)]",
    tailwindSnippet: "animate-in fade-in zoom-in-75 duration-600 [animation-timing-function:cubic-bezier(0.34,1.56,0.64,1)]",
    recommendedFor: "Dashboard Widgets, Key Badges, Callout Cards"
  },
  {
    id: "perspective-tilt",
    name: "🎭 Perspective 3D Tilt",
    description: "Tilts smoothly from 3D space with subtle depth rotation on reveal.",
    containerClass: "animate-in fade-in slide-in-from-bottom-6 duration-500 [transform:perspective(1000px)_rotateX(-8deg)] ease-out",
    tailwindSnippet: "animate-in fade-in slide-in-from-bottom-6 duration-500 [transform:perspective(1000px)_rotateX(-8deg)]",
    recommendedFor: "Analytics cards, Summary matrices, Premium headers"
  },
  {
    id: "frosted-focus",
    name: "🧊 Frosted Focus Blur",
    description: "Transitions smoothly from soft blur into sharp focus.",
    containerClass: "animate-in fade-in blur-sm to-blur-none duration-500 ease-out",
    tailwindSnippet: "animate-in fade-in blur-sm to-blur-none duration-500 ease-out",
    recommendedFor: "Personal Attendance Logs, Employee Tables, History Grids"
  },
  {
    id: "accelerated-cascade",
    name: "🏎️ Accelerated Curtain Drop",
    description: "Top-down drop with a rapid custom cubic-bezier deceleration curve.",
    containerClass: "animate-in fade-in slide-in-from-top-8 duration-450 [animation-timing-function:cubic-bezier(0.16,1,0.3,1)]",
    tailwindSnippet: "animate-in fade-in slide-in-from-top-8 duration-450 [animation-timing-function:cubic-bezier(0.16,1,0.3,1)]",
    recommendedFor: "Dropdown sheets, Modal dialogs, Header announcements"
  },
  {
    id: "diagonal-sweep",
    name: "🌠 Diagonal Corner Sweep",
    description: "Enters dynamically from top-left 45-degree angle.",
    containerClass: "animate-in fade-in slide-in-from-top-4 slide-in-from-left-4 duration-400 ease-out",
    tailwindSnippet: "animate-in fade-in slide-in-from-top-4 slide-in-from-left-4 duration-400 ease-out",
    recommendedFor: "Notification toasts, Drawer popups, Quick action menus"
  },
  {
    id: "ultra-fast-snap",
    name: "⚡ Ultra Fast Snap",
    description: "Lightning-fast 200ms entrance for zero latency power users.",
    containerClass: "animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out",
    tailwindSnippet: "animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out",
    recommendedFor: "Data tables, Search results, Instant tab switching"
  }
];

const TransitionPlayground = () => {
  const [selectedPreset, setSelectedPreset] = useState(transitionPresets[0]);
  const [animKey, setAnimKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleReplay = () => {
    setAnimKey(prev => prev + 1);
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(selectedPreset.tailwindSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-4 md:p-6 w-full max-w-6xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#2A174E] text-white rounded-lg shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#2A174E] tracking-tight">
                  UI Transition & Animation Lab
                </h1>
              </div>
              <p className="text-sm text-slate-500 mt-1.5 font-medium">
                Test and compare multiple element transition effects live to select the best animation style for MAChip.
              </p>
            </div>

            <Button 
              onClick={handleReplay} 
              className="bg-[#2A174E] text-white hover:bg-[#1f103b] shadow-md gap-2 font-bold px-5 py-2.5 transition-all hover:scale-105 active:scale-95"
            >
              <RotateCcw className="h-4 w-4 animate-spin-once" /> Replay Transition
            </Button>
          </div>

          {/* Preset Selector Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#2A174E]" />
                Select Transition Effect Preset ({transitionPresets.length})
              </h2>
              <span className="text-xs text-[#2A174E] font-bold bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
                Click any preset to preview
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {transitionPresets.map((preset) => {
                const isSelected = selectedPreset.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedPreset(preset);
                      setAnimKey(prev => prev + 1);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? "bg-[#2A174E] text-white border-[#2A174E] shadow-md ring-2 ring-[#2A174E]/30"
                        : "bg-white text-slate-700 border-slate-200 hover:border-[#2A174E]/40 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sm truncate">{preset.name}</span>
                        {isSelected && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                      </div>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${isSelected ? "text-purple-100" : "text-slate-500"}`}>
                        {preset.description}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100/20 flex items-center justify-between">
                      <span className={`text-[10px] font-mono ${isSelected ? "text-purple-200" : "text-slate-400"}`}>
                        {preset.recommendedFor.split(",")[0]}
                      </span>
                      <ArrowRight className={`h-3 w-3 ${isSelected ? "text-purple-200" : "text-slate-400"}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Code Snippet Banner */}
          <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg border border-slate-800">
            <div className="flex items-start gap-3 min-w-0">
              <Code className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider block">
                  Active Preset Tailwind Code Snippet
                </span>
                <code className="font-mono text-xs text-purple-200 block truncate mt-0.5">
                  {selectedPreset.tailwindSnippet}
                </code>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Best suited for: <strong className="text-white">{selectedPreset.recommendedFor}</strong>
                </span>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySnippet}
              className="bg-slate-800 text-purple-200 border-slate-700 hover:bg-slate-700 hover:text-white shrink-0 gap-1.5 text-xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Classes"}
            </Button>
          </div>

          {/* --- LIVE DEMO PLAYGROUND AREA --- */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-extrabold text-[#2A174E] uppercase tracking-wider flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#2A174E]" />
                Live Preview Canvas ({selectedPreset.name})
              </h3>
              <Badge className="bg-emerald-500 text-white font-bold text-[10px]">
                LIVE RENDER
              </Badge>
              <Button 
              onClick={handleReplay} 
              className="bg-[#2A174E] text-white hover:bg-[#1f103b] shadow-md gap-2 font-bold px-5 py-2.5 transition-all hover:scale-105 active:scale-95"
            >
              <RotateCcw className="h-4 w-4 animate-spin-once" /> Replay Transition
            </Button>
            </div>

            {/* Dynamic Container with key triggering transition */}
            <div key={animKey} className={`space-y-6 ${selectedPreset.containerClass}`}>
              
              {/* Mock Hero Header */}
              <div className="bg-gradient-to-r from-[#2A174E] via-[#3B1F6C] to-[#4A2B8C] text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <Badge className="bg-white/20 text-white border-none text-[10px] font-bold uppercase tracking-wider mb-2">
                    MAChip Capstone Preview
                  </Badge>
                  <h2 className="text-2xl font-black tracking-tight">Good day, MAC-J Administration!</h2>
                  <p className="text-purple-200 text-sm mt-1 font-medium">
                    This sample dashboard component is demonstrating <strong className="underline decoration-purple-400">{selectedPreset.name}</strong>.
                  </p>
                </div>
                <Button className="bg-white text-[#2A174E] hover:bg-purple-50 font-bold text-xs shadow-sm">
                  View Full Analytics
                </Button>
              </div>

              {/* Mock Stat Cards Grid (with optional staggered delays) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { title: "Total Employees", val: "148", note: "Active headcount", color: "bg-[#2A174E]", text: "text-white" },
                  { title: "On-Time Rate", val: "94.2%", note: "Current cutoff average", color: "bg-emerald-500", text: "text-white" },
                  { title: "Total Payroll", val: "₱842,500.00", note: "July 15 cutoff", color: "bg-amber-500", text: "text-slate-950" },
                  { title: "Pending Requests", val: "12", note: "Requires approval", color: "bg-purple-600", text: "text-white" },
                ].map((stat, i) => (
                  <Card 
                    key={i} 
                    className={`border border-slate-200/80 shadow-sm bg-white hover:shadow-md transition-all ${
                      selectedPreset.isStaggered 
                        ? `animate-in fade-in slide-in-from-bottom-4 duration-500` 
                        : ""
                    }`}
                    style={selectedPreset.isStaggered ? { animationDelay: `${i * 120}ms`, animationFillMode: "backwards" } : {}}
                  >
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.title}</span>
                        <Badge className={`${stat.color} ${stat.text} text-[10px] font-mono font-bold border-none`}>LIVE</Badge>
                      </div>
                      <p className="text-2xl font-black text-[#2A174E] font-mono mt-2">{stat.val}</p>
                      <span className="text-[11px] text-slate-400 font-medium mt-1">{stat.note}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Mock Distributed Log Table */}
              <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 py-3.5 px-6">
                  <CardTitle className="text-base font-bold text-[#2A174E]">Sample Attendance & Access Log Table</CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Observing how tabular data renders under the active transition
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-[#2A174E]">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-bold text-white text-xs py-3 px-6">EMPLOYEE</TableHead>
                        <TableHead className="font-bold text-white text-xs py-3 text-center">DEPT</TableHead>
                        <TableHead className="font-bold text-white text-xs py-3 text-center">TIME IN</TableHead>
                        <TableHead className="font-bold text-white text-xs py-3 text-center">STATUS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { name: "Juan Dela Cruz", dept: "Logistics", time: "07:55 AM", status: "On Time", badge: "bg-emerald-500 text-white" },
                        { name: "Maria Santos", dept: "Warehouse", time: "08:14 AM", status: "Late", badge: "bg-amber-400 text-slate-900" },
                        { name: "Arnel Mendoza", dept: "Operations", time: "07:48 AM", status: "On Time", badge: "bg-emerald-500 text-white" },
                      ].map((row, i) => (
                        <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100">
                          <TableCell className="font-bold text-[#2A174E] text-xs py-3 px-6">{row.name}</TableCell>
                          <TableCell className="text-center text-xs text-slate-600 py-3">{row.dept}</TableCell>
                          <TableCell className="text-center font-mono text-xs text-slate-800 py-3">{row.time}</TableCell>
                          <TableCell className="text-center py-3">
                            <Badge className={`${row.badge} font-bold text-[10px] px-2.5 py-0.5 rounded-full border-none`}>
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

            </div>
          </div>

        </div>
      </TooltipProvider>
    </Sidebar>
  );
};

export default TransitionPlayground;
