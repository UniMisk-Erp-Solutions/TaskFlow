import { motion } from "motion/react";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export default function Pricing() {
  const plans = [
    {
      name: "Free",
      price: "0",
      description: "Perfect for individuals and small side projects.",
      features: ["Up to 3 projects", "Unlimited tasks", "Basic task views", "Team chat (limited)", "Mobile app"],
      cta: "Get started",
      href: "/login?mode=signup",
      popular: false,
    },
    {
      name: "Pro",
      price: "12",
      description: "For growing teams that need more power and automation.",
      features: ["Unlimited projects", "Timeline & calendar", "AI assistant", "Custom automations", "Priority support", "Advanced reports"],
      cta: "Start 14-day trial",
      href: "/login?mode=signup",
      popular: true,
    },
    {
      name: "Business",
      price: "24",
      description: "For organizations that need advanced security and controls.",
      features: ["Everything in Pro", "Single sign-on (SSO)", "Advanced permissions", "Dedicated manager", "API access", "Admin audit logs"],
      cta: "Contact sales",
      href: "/contact",
      popular: false,
    },
  ];

  return (
    <div className="pt-32 pb-24 px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl lg:text-6xl font-semibold tracking-[-0.03em] leading-[1.05]"
          >
            Simple, transparent pricing.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="text-base lg:text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed"
          >
            Choose the plan that's right for your team. Switch or cancel anytime.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 items-stretch">
          {plans.map((plan) => (
            <div key={plan.name} className={plan.popular ? "md:-mt-4 md:mb-0" : ""}>
              <Card
                className={
                  plan.popular
                    ? "relative border-brand-primary/40 shadow-[0_24px_48px_-20px_rgba(139,92,246,0.30)] h-full"
                    : "h-full"
                }
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-[11px] font-semibold px-3 py-1 rounded-full tracking-tight shadow-[0_4px_12px_-4px_rgba(139,92,246,0.5)]">
                    Most popular
                  </div>
                )}
                <div className="mb-7">
                  <h3 className="text-lg font-semibold tracking-tight mb-3">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="font-display text-4xl font-semibold tracking-[-0.025em]">${plan.price}</span>
                    <span className="text-[var(--muted)] text-sm">/user/mo</span>
                  </div>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">{plan.description}</p>
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <Check size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-[var(--foreground)]">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button variant={plan.popular ? "primary" : "outline"} to={plan.href} className="w-full">
                  {plan.cta}
                </Button>
              </Card>
            </div>
          ))}
        </div>

        <section className="mb-12">
          <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-3xl p-10 lg:p-16 flex flex-col lg:flex-row items-center justify-between gap-10 shadow-[0_40px_80px_-40px_rgba(15,23,42,0.35)]">
            <div className="space-y-4 text-center lg:text-left max-w-xl">
              <h2 className="font-display text-3xl lg:text-4xl font-semibold tracking-[-0.025em] text-white">
                Need something bigger?
              </h2>
              <p className="text-base text-slate-400 leading-relaxed">
                Our Enterprise plan offers custom workflows, white-glove onboarding,
                and 24/7 dedicated support for large-scale organizations.
              </p>
            </div>
            <Button size="lg" to="/contact" className="whitespace-nowrap">
              Schedule a demo <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
