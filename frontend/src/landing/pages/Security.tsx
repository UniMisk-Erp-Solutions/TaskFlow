import { motion } from "motion/react";
import { ShieldCheck, Lock, Eye, FileText, Server, RefreshCw } from "lucide-react";
import { Card } from "../components/ui/Card";

export default function Security() {
  const productName = "Taskflow";

  const pillars = [
    { icon: <Lock size={32} />, title: "Encryption", desc: "Your data is encrypted using industry-standard AES-256 both at rest and in transit (TLS 1.3)." },
    { icon: <ShieldCheck size={32} />, title: "Compliance", desc: productName + " is SOC2 Type II compliant and follows GDPR and CCPA data privacy frameworks." },
    { icon: <RefreshCw size={32} />, title: "Backups", desc: "Automated daily backups with multi-region redundancy to ensure 99.9% data durability." },
    { icon: <Eye size={32} />, title: "Observability", desc: "Complete audit logs and workspace-level transparency for all administrative actions." },
    { icon: <Server size={32} />, title: "Hosting", desc: "Hosted on secure, premium cloud infrastructure with 24/7 incident monitoring." },
    { icon: <FileText size={32} />, title: "Data Ownership", desc: "You own your data. Export your entire workspace content anytime in open formats." },
  ];

  return (
    <div className="pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-20 space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-bold"
          >
            <ShieldCheck size={16} />
            <span>Secure by design</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-7xl font-bold font-display"
          >
            Trust is our <br />
            <span className="text-emerald-600">foundation.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg lg:text-xl text-[var(--muted)]"
          >
            We understand that enterprise task management involves sensitive data. 
            {productName} is built with a security-first architecture.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-32">
          {pillars.map((p, i) => (
            <div key={i}>
              <Card className="p-10 space-y-6 h-full">
                <div className="text-emerald-600">
                  {p.icon}
                </div>
                <h3 className="text-2xl font-bold">{p.title}</h3>
                <p className="text-[var(--muted)] leading-relaxed">{p.desc}</p>
              </Card>
            </div>
          ))}
        </div>

        <section className="py-24 px-4 mb-20 relative overflow-hidden">
          <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-[3rem] p-12 lg:p-24 text-center space-y-8 shadow-2xl">
            <h2 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter text-white">Have security questions?</h2>
            <p className="text-xl text-slate-400 max-w-xl mx-auto font-light leading-relaxed">
              Request our full security whitepaper or talk to our compliance team about your specific requirements.
            </p>
            <div className="flex justify-center gap-4">
              <Button size="lg" to="/contact" className="px-10 font-black uppercase tracking-tighter">Contact Security Team</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
