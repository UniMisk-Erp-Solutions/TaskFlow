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
      features: [
        "Up to 3 projects",
        "Unlimited tasks",
        "Basic task views",
        "Team chat (limited)",
        "Mobile app"
      ],
      cta: "Get Started",
      href: "/login?mode=signup",
      popular: false
    },
    {
      name: "Pro",
      price: "12",
      description: "For growing teams that need more power and automation.",
      features: [
        "Unlimited projects",
        "Timeline & Calendar views",
        "Quest AI Assistant",
        "Custom automations",
        "Priority support",
        "Advanced reports"
      ],
      cta: "Start 14-day Free Trial",
      href: "/login?mode=signup",
      popular: true
    },
    {
      name: "Business",
      price: "24",
      description: "For organizations requiring advanced security and controls.",
      features: [
        "Everything in Pro",
        "Single Sign-On (SSO)",
        "Advanced permissions",
        "Dedicated workspace manager",
        "API Access",
        "Admin audit logs"
      ],
      cta: "Contact Sales",
      href: "/contact",
      popular: false
    }
  ];

  return (
    <div className="pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-6xl font-bold"
          >
            Simple, transparent pricing.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-[var(--muted)] max-w-2xl mx-auto"
          >
            Choose the plan that's right for your team. Switch or cancel anytime.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {plans.map((plan) => (
            <div key={plan.name} className={plan.popular ? "scale-105 z-10" : ""}>
              <Card
                className={plan.popular ? "relative border-brand-primary/50 shadow-brand-primary/10 shadow-2xl h-full" : "h-full"}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-bold tracking-tight">${plan.price}</span>
                    <span className="text-[var(--muted)]">/user/mo</span>
                  </div>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">{plan.description}</p>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map(feature => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check size={18} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant={plan.popular ? "primary" : "outline"}
                  to={plan.href}
                  className="w-full mt-auto"
                >
                  {plan.cta}
                </Button>
              </Card>
            </div>
          ))}
        </div>

        <section className="py-24 px-4 mb-20 relative overflow-hidden">
          <div className="max-w-5xl mx-auto bg-slate-950 border border-white/10 rounded-[3rem] p-12 lg:p-24 flex flex-col lg:flex-row items-center justify-between gap-12 shadow-2xl">
            <div className="space-y-6 text-center lg:text-left relative z-10">
              <h2 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter text-white">Need something <br /> bigger?</h2>
              <p className="text-lg text-slate-400 max-w-lg font-light leading-relaxed">
                Our Enterprise plan offers custom workflows, white-glove onboarding, 
                and 24/7 dedicated support for large-scale organizations.
              </p>
            </div>
            <Button size="lg" to="/contact" className="whitespace-nowrap px-10 py-4 text-lg relative z-10 font-black uppercase tracking-tighter">
              Schedule a Demo <ArrowRight className="ml-2 size-5" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
