import { motion } from "motion/react";
import { ShieldCheck, Lock, Eye, FileText, Server, RefreshCw } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export default function Security() {
  const productName = "Taskflow";

  const pillars = [
    { icon: <Lock size={26} />, title: "Encryption", desc: "Your data is encrypted with AES-256 at rest and TLS 1.3 in transit." },
    { icon: <ShieldCheck size={26} />, title: "Compliance", desc: `${productName} is SOC2 Type II compliant and follows GDPR / CCPA.` },
    { icon: <RefreshCw size={26} />, title: "Backups", desc: "Automated daily backups with multi-region redundancy for 99.9% durability." },
    { icon: <Eye size={26} />, title: "Observability", desc: "Complete audit logs and workspace transparency for admin actions." },
    { icon: <Server size={26} />, title: "Hosting", desc: "Secure cloud infrastructure with 24/7 incident monitoring." },
    { icon: <FileText size={26} />, title: "Data ownership", desc: "You own your data — export everything in open formats anytime." },
  ];

  return (
    <div className="pt-32 pb-24 px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-20 space-y-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/[0.10] text-emerald-600 text-xs font-medium border border-emerald-500/15"
          >
            <ShieldCheck size={14} />
            <span>Secure by design</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05]"
          >
            Trust is our<br />
            <span className="text-emerald-600">foundation.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="text-base lg:text-lg text-[var(--muted)] leading-relaxed"
          >
            Enterprise task management involves sensitive data. {productName} is built
            with a security-first architecture from day one.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
          {pillars.map((p, i) => (
            <Card key={i} className="p-8 space-y-4 h-full">
              <div className="size-12 rounded-xl bg-emerald-500/[0.08] text-emerald-600 flex items-center justify-center">
                {p.icon}
              </div>
              <h3 className="text-lg font-semibold tracking-tight">{p.title}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{p.desc}</p>
            </Card>
          ))}
        </div>

        <section className="mb-12">
          <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-3xl p-12 lg:p-20 text-center space-y-7 shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)]">
            <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em] text-white">
              Have security questions?
            </h2>
            <p className="text-base lg:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
              Request our full security whitepaper or talk to our compliance team about your requirements.
            </p>
            <div className="flex justify-center gap-3">
              <Button size="lg" to="/contact">Contact security team</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
