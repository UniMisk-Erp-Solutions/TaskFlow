import { motion } from "motion/react";
import { Send, MapPin, Phone, Mail, MessageSquare } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export default function Contact() {
  return (
    <div className="pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          <div className="space-y-12">
            <div className="space-y-6">
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-4xl lg:text-6xl font-bold"
              >
                Let’s talk.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg text-[var(--muted)]"
              >
                Whether you have a question about features, pricing, or professional demos, 
                our team is ready to answer all your questions.
              </motion.p>
            </div>

            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="size-12 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary">
                  <Mail size={24} />
                </div>
                <div>
                  <h4 className="font-bold">Email us</h4>
                  <p className="text-[var(--muted)]">hello@quest.team</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="size-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h4 className="font-bold">Live Support</h4>
                  <p className="text-[var(--muted)]">Available Mon-Fri, 9am - 6pm EST</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="size-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600">
                  <MapPin size={24} />
                </div>
                <div>
                  <h4 className="font-bold">Office</h4>
                  <p className="text-[var(--muted)]">123 Innovation Way, San Francisco, CA 94105</p>
                </div>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-8 lg:p-10 shadow-2xl border-[var(--border)]">
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <input 
                      type="text" 
                      placeholder="Jane" 
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <input 
                      type="text" 
                      placeholder="Doe" 
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Work Email</label>
                  <input 
                    type="email" 
                    placeholder="jane@company.com" 
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Company Size</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all">
                    <option>1-10 employees</option>
                    <option>11-50 employees</option>
                    <option>51-200 employees</option>
                    <option>201-1000 employees</option>
                    <option>1000+ employees</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <textarea 
                    rows={4} 
                    placeholder="Tell us about your team's needs..." 
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all resize-none"
                  />
                </div>

                <Button className="w-full py-4 text-lg">
                  Send Message <Send className="ml-2 size-5" />
                </Button>
                <p className="text-xs text-[var(--muted)] text-center">
                  By submitting, you agree to our <a href="#" className="underline">Privacy Policy</a> and <a href="#" className="underline">Terms</a>.
                </p>
              </form>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
