import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Zap, Shield, Users, BarChart3, Clock, Sparkles } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "@/src/lib/utils";

export default function Home() {
  const features = [
    { icon: <Zap size={24} />, title: "Real-time Sync", description: "Collaborate with your team in real-time with instant updates across all devices." },
    { icon: <Users size={24} />, title: "Team Management", description: "Manage roles, permissions, and workload distribution with intuitive controls." },
    { icon: <Shield size={24} />, title: "Enterprise Security", description: "Bank-grade encryption and advanced security protocols to keep your data safe." },
    { icon: <BarChart3 size={24} />, title: "Advanced Reports", description: "Deep insights into productivity, task completion rates, and project health." },
    { icon: <Clock size={24} />, title: "Timeline View", description: "Plan projects with visual timelines and manage dependencies effortlessly." },
    { icon: <Sparkles size={24} />, title: "AI Automation", description: "Let Quest AI handle repetitive tasks, summaries, and smart scheduling." },
  ];

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 size-[600px] bg-brand-primary/10 rounded-full blur-[120px]" />
          <div className="absolute top-40 left-1/3 size-[500px] bg-brand-accent/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-block px-4 py-2 rounded-full bg-brand-primary/10 text-brand-primary text-[10px] font-black mb-8 tracking-[0.2em] border border-brand-primary/20"
          >
            NEW: AI WORKFLOW AUTOMATION
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-6xl lg:text-8xl font-black tracking-tighter leading-[0.95] mb-8 text-balance uppercase"
          >
            Project clarity <br />
            for teams <br />
            that move fast.
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl lg:text-2xl text-[var(--muted)] max-w-2xl mx-auto mb-12 text-pretty font-light leading-relaxed"
          >
            Turn scattered tasks into organized execution. Manage your team, 
            track progress, and hit deadlines in one powerful workspace.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button size="lg" to="/login?mode=signup" className="w-full sm:w-auto min-w-[200px]">
              Get Started Free
            </Button>
            <Button variant="outline" size="lg" to="/features" className="w-full sm:w-auto min-w-[200px]">
              Watch Demo
            </Button>
          </motion.div>
        </div>

        {/* Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="max-w-6xl mx-auto mt-20 relative px-4"
        >
          <div className="rounded-3xl border border-[var(--border)] bg-white dark:bg-[#141820] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] overflow-hidden flex min-h-[500px]">
            {/* Sidebar Mockup */}
            <div className="w-16 bg-slate-950 dark:bg-black border-r border-slate-800 flex flex-col items-center py-8 gap-6 shrink-0">
              <div className="size-8 rounded-lg bg-brand-primary shadow-lg shadow-brand-primary/20" />
              <div className="size-8 rounded-lg bg-slate-800" />
              <div className="size-8 rounded-lg bg-slate-800" />
              <div className="size-8 rounded-lg bg-slate-800" />
            </div>
            {/* Mock Content */}
            <div className="flex-1 flex flex-col bg-slate-950">
              <div className="h-16 border-b border-white/10 flex items-center px-8 justify-between bg-white/5 backdrop-blur-sm">
                <p className="font-bold text-white uppercase tracking-widest text-xs">Team Dashboard</p>
                <div className="flex gap-2">
                  <div className="size-8 rounded-full bg-brand-primary/20 border border-brand-primary/30" />
                  <div className="size-8 rounded-full bg-slate-800" />
                </div>
              </div>
              <div className="flex-1 p-8 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-brand-primary mb-2 uppercase tracking-[0.2em] font-black">Total Productivity</p>
                    <p className="text-3xl font-black text-white">94.2%</p>
                    <div className="h-1.5 w-full bg-white/10 rounded-full mt-4 overflow-hidden">
                      <div className="h-full bg-brand-primary w-[72%]" />
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-[10px] text-brand-primary mb-2 uppercase tracking-[0.2em] font-black">Active Sprints</p>
                    <p className="text-3xl font-black text-white">12</p>
                    <p className="text-[10px] text-emerald-400 mt-2 font-bold uppercase tracking-wider">3 closing today</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-6">Upcoming Tasks</p>
                  {[
                    { title: "Review Q3 Marketing Deck", status: "High", color: "bg-red-400" },
                    { title: "Update API Documentation", status: "Done", color: "bg-brand-primary" },
                    { title: "Sync with Engineering Lead", status: "Medium", color: "bg-brand-primary" }
                  ].map((task, i) => (
                    <div key={i} className="flex items-center gap-4 py-4 border-b border-white/5 last:border-0">
                      <div className={cn("size-5 rounded border-2 border-white/20", i === 1 && "bg-brand-primary border-brand-primary")} />
                      <p className={cn("text-sm flex-1 font-medium text-white", i === 1 && "line-through opacity-30")}>{task.title}</p>
                      <span className="px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full text-[10px] font-black text-brand-primary uppercase tracking-widest">{task.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="absolute -bottom-10 right-10 p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-[var(--border)] hidden lg:block w-52">
            <p className="text-xs font-bold mb-4">Project Health</p>
            <div className="flex items-end gap-1.5 h-12">
              {[0.4, 0.6, 0.3, 0.8, 1, 0.7].map((h, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-brand-primary/20 rounded-sm"
                  style={{ height: `${h * 100}%`, backgroundColor: h > 0.7 ? '#8B5CF6' : undefined }}
                />
              ))}
            </div>
            <p className="text-[10px] text-[var(--muted)] mt-4">Stable execution pace</p>
          </div>
        </motion.div>
      </section>

      {/* Trust Bar */}
      <section className="py-16 border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-12">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)] whitespace-nowrap">Trusted by industry leaders</p>
          <div className="flex flex-wrap justify-center lg:justify-end gap-x-16 gap-y-8 text-xl font-bold opacity-30 grayscale grayscale-100 hover:opacity-100 transition-opacity duration-700">
            <span className="tracking-tighter">LAYER</span>
            <span className="tracking-tighter">QUARTZ</span>
            <span className="tracking-tighter">NOTION</span>
            <span className="tracking-tighter">VELOCITY</span>
            <span className="tracking-tighter">FORGE</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-40 px-4 bg-[var(--background)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter">Everything you need to ship.</h2>
            <p className="text-[var(--muted)] text-lg max-w-2xl mx-auto font-light leading-relaxed">
              Multiple task views, deep analytics, and AI-driven workflows built for scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div key={idx}>
                <Card className="group overflow-hidden">
                  <div className="size-12 rounded-xl bg-brand-primary/5 text-brand-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-[var(--muted)] text-sm leading-relaxed">{feature.description}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section - Premium Gradient */}
      <section className="py-32 bg-slate-950 dark:bg-[#141820] text-white px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 via-transparent to-brand-accent/20 opacity-50" />
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-white dark:from-[#0B0E14] to-transparent opacity-10" />
        
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-20 relative z-10 text-center">
          <div className="space-y-4">
            <p className="text-6xl font-bold tracking-tighter">98%</p>
            <p className="text-slate-400 font-medium uppercase tracking-widest text-xs">Satisfaction Rate</p>
          </div>
          <div className="space-y-4">
            <p className="text-6xl font-bold tracking-tighter">1.2M+</p>
            <p className="text-slate-400 font-medium uppercase tracking-widest text-xs">Tasks Monthly</p>
          </div>
          <div className="space-y-4">
            <p className="text-6xl font-bold tracking-tighter">50k+</p>
            <p className="text-slate-400 font-medium uppercase tracking-widest text-xs">Global Teams</p>
          </div>
        </div>
      </section>

      <section className="py-32 px-4">
        <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-[3rem] p-10 lg:p-24 text-center space-y-10 relative overflow-hidden shadow-2xl">
          <div className="absolute -top-24 -left-24 size-96 bg-brand-primary/20 rounded-full blur-3xl opacity-50" />
          <div className="absolute -bottom-24 -right-24 size-96 bg-brand-accent/20 rounded-full blur-3xl opacity-50" />
          
          <div className="relative z-10 space-y-6">
            <h2 className="text-5xl lg:text-7xl font-black tracking-tighter uppercase leading-none text-white">Ready to move <br /> faster?</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light">
              Join 50,000+ teams that use Taskflow to organize their projects and ship with confidence.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <Button size="lg" to="/login?mode=signup" className="w-full sm:w-auto px-12 py-5 text-xl font-black uppercase tracking-tighter">Get Started Free</Button>
            <Button variant="outline" size="lg" to="/contact" className="w-full sm:w-auto px-12 py-5 text-xl border-white/20 text-white hover:bg-white/10">Talk to Sales</Button>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 relative z-10">No credit card required • Cancel anytime</p>
        </div>
      </section>
    </div>
  );
}
