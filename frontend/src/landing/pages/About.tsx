import { motion } from "motion/react";
import { Target, Heart, Eye, Rocket, Zap, Shield } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export default function About() {
  return (
    <div className="pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20 space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-7xl font-bold font-display"
          >
            We're on a mission to <br />
            <span className="text-brand-primary">kill workflow clutter.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg lg:text-xl text-[var(--muted)] max-w-3xl mx-auto"
          >
            We believe teams do their best work when responsibilities are clear, 
            deadlines are visible, and progress is easy to understand.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-32">
          <Card className="p-10 space-y-4">
            <div className="size-14 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
              <Target size={32} />
            </div>
            <h3 className="text-2xl font-bold">Our Mission</h3>
            <p className="text-[var(--muted)] leading-relaxed">
              To empower every professional organization with a workspace that 
              fosters accountability and execution speed through radical clarity.
            </p>
          </Card>
          <Card className="p-10 space-y-4">
            <div className="size-14 rounded-2xl bg-brand-accent/10 text-brand-accent flex items-center justify-center">
              <Eye size={32} />
            </div>
            <h3 className="text-2xl font-bold">Our Vision</h3>
            <p className="text-[var(--muted)] leading-relaxed">
              Building the operating system for modern business—where every 
              decision, file, and milestone is connected to the work it belongs to.
            </p>
          </Card>
        </div>

        <section className="mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">The core values we live by</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <Zap />, title: "Speed", desc: "We ship fast and help our customers do the same." },
              { icon: <Shield />, title: "Trust", desc: "Security and data integrity are non-negotiable." },
              { icon: <Heart />, title: "Clarity", desc: "Simple, honest communication in everything we build." },
              { icon: <Rocket />, title: "Growth", desc: "Always learning, iterating, and pushing the boundary." }
            ].map((v, i) => (
              <div key={i} className="text-center space-y-4">
                <div className="mx-auto size-14 rounded-full bg-[var(--accent)] flex items-center justify-center text-brand-primary">
                  {v.icon}
                </div>
                <h4 className="font-bold text-xl">{v.title}</h4>
                <p className="text-sm text-[var(--muted)]">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-24 px-4 mb-20 relative overflow-hidden">
          <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-[3rem] p-12 lg:p-24 text-center space-y-10 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-brand-primary/10 -skew-x-12 translate-x-1/2" />
            <h2 className="text-4xl lg:text-7xl font-black uppercase tracking-tighter relative z-10 leading-none text-white">Join the <br /> journey</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light relative z-10 leading-relaxed">
              Taskflow was founded by a group of designers and engineers tired of 
              jumping between 10 different apps to get one project done. Today, we're 
              a team of 40+ people across 12 countries dedicated to simplifying execution.
            </p>
            <div className="flex justify-center gap-4 relative z-10">
              <Button size="lg" to="/contact" className="px-10 font-black uppercase tracking-tighter">Explore Careers</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

