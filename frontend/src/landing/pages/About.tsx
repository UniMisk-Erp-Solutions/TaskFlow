import { motion } from "motion/react";
import { Target, Heart, Eye, Rocket, Zap, Shield } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export default function About() {
  return (
    <div className="pt-32 pb-24 px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20 space-y-5">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05]"
          >
            On a mission to kill<br />
            <span className="text-brand-primary">workflow clutter.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="text-base lg:text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed"
          >
            Teams do their best work when responsibilities are clear, deadlines are visible,
            and progress is easy to understand.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-24">
          <Card className="p-9 space-y-4">
            <div className="size-12 rounded-xl bg-brand-primary/[0.10] text-brand-primary flex items-center justify-center">
              <Target size={26} />
            </div>
            <h3 className="text-xl font-semibold tracking-tight">Our mission</h3>
            <p className="text-[var(--muted)] leading-relaxed">
              Empower every organization with a workspace that fosters accountability
              and execution speed through radical clarity.
            </p>
          </Card>
          <Card className="p-9 space-y-4">
            <div className="size-12 rounded-xl bg-brand-accent/[0.10] text-brand-accent flex items-center justify-center">
              <Eye size={26} />
            </div>
            <h3 className="text-xl font-semibold tracking-tight">Our vision</h3>
            <p className="text-[var(--muted)] leading-relaxed">
              Build the operating system for modern business — where every decision,
              file, and milestone is connected to the work it belongs to.
            </p>
          </Card>
        </div>

        <section className="mb-24">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em]">
              The values we live by
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <Zap size={22} />, title: "Speed", desc: "We ship fast and help our customers do the same." },
              { icon: <Shield size={22} />, title: "Trust", desc: "Security and data integrity are non-negotiable." },
              { icon: <Heart size={22} />, title: "Clarity", desc: "Simple, honest communication in everything we build." },
              { icon: <Rocket size={22} />, title: "Growth", desc: "Always learning, iterating, pushing the boundary." },
            ].map((v) => (
              <div key={v.title} className="text-center space-y-3">
                <div className="mx-auto size-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-brand-primary">
                  {v.icon}
                </div>
                <h4 className="font-semibold tracking-tight">{v.title}</h4>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-3xl p-12 lg:p-20 text-center space-y-8 relative overflow-hidden shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)]">
            <div className="absolute -top-24 -right-24 size-96 bg-brand-primary/15 rounded-full blur-3xl" />
            <h2 className="font-display text-4xl lg:text-5xl font-semibold tracking-[-0.03em] relative z-10 leading-[1.05] text-white">
              Join the journey
            </h2>
            <p className="text-base lg:text-lg text-slate-400 max-w-2xl mx-auto relative z-10 leading-relaxed">
              Taskflow was founded by a group of designers and engineers tired of
              jumping between 10 apps to get one project done. Today we're a team
              of 40+ across 12 countries dedicated to simplifying execution.
            </p>
            <div className="flex justify-center gap-3 relative z-10">
              <Button size="lg" to="/contact">Explore careers</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
