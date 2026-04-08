import Link from "next/link";
import {
  BarChart3,
  Send,
  Zap,
  ArrowRight,
  TrendingUp,
  Calendar,
  Link2,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between max-w-6xl mx-auto px-6 py-6">
        <div className="text-2xl font-extrabold gradient-text">Pulsr</div>
        <Link
          href="/login"
          className="gradient-bg text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          Get started free
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-purple/10 border border-purple/20 px-4 py-1.5 text-sm text-purple mb-8">
          <Zap className="w-3.5 h-3.5" />
          7-day free trial — no card required
        </div>
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05] mb-6">
          All your stats.
          <br />
          <span className="gradient-text">One bold dashboard.</span>
        </h1>
        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Stop logging into 5 apps to check your numbers. Pulsr pulls every
          platform into one dopamine-inducing dashboard — then lets you
          schedule posts without leaving.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="gradient-bg text-white font-semibold px-8 py-3.5 rounded-xl text-base hover:opacity-90 transition-opacity inline-flex items-center gap-2 shadow-lg shadow-purple/25"
          >
            Start free trial
            <ArrowRight className="w-4 h-4" />
          </Link>
          <span className="text-sm text-zinc-500">
            then $29/mo after trial
          </span>
        </div>
      </section>

      {/* Mock dashboard preview */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="rounded-2xl border border-border bg-surface p-8 sm:p-12">
          <div className="text-center mb-8">
            <p className="text-sm text-zinc-500 mb-2 font-medium">
              TOTAL FOLLOWERS
            </p>
            <p className="text-7xl sm:text-[96px] font-black font-mono gradient-text leading-none">
              284,391
            </p>
            <p className="text-accent text-sm font-semibold mt-3 flex items-center justify-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              +2,847 this week
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Views", value: "1.2M", delta: "+14%" },
              { label: "Likes", value: "89.4K", delta: "+8%" },
              { label: "Comments", value: "12.1K", delta: "+23%" },
              { label: "Shares", value: "4.7K", delta: "+11%" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-bg border border-border p-4 text-center"
              >
                <p className="text-xs text-zinc-500 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold font-mono text-zinc-100">
                  {stat.value}
                </p>
                <p className="text-xs text-accent font-medium mt-1">
                  {stat.delta}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <h2 className="text-3xl font-bold text-center mb-16">
          Everything you need.{" "}
          <span className="text-zinc-500">Nothing you don&apos;t.</span>
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            {
              icon: BarChart3,
              title: "Unified analytics",
              desc: "Every platform's numbers in one place. Big bold numbers that make you feel something.",
            },
            {
              icon: Send,
              title: "Cross-post & schedule",
              desc: "Write once, publish everywhere. Schedule posts for the perfect time with live previews.",
            },
            {
              icon: Calendar,
              title: "Content calendar",
              desc: "See your entire week at a glance. Never miss a posting window again.",
            },
            {
              icon: Link2,
              title: "One-click connect",
              desc: "Twitter, Instagram, TikTok, YouTube, LinkedIn and more. Connect in seconds.",
            },
            {
              icon: TrendingUp,
              title: "Growth tracking",
              desc: "Watch your follower count climb in real-time with hourly snapshots.",
            },
            {
              icon: Zap,
              title: "Fast & focused",
              desc: "No bloat, no enterprise complexity. Just the tools creators actually use.",
            },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-bg mb-4">
                <f.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-zinc-100 mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20">
        <div className="text-center max-w-xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-4">
            Ready to see your real numbers?
          </h2>
          <p className="text-zinc-400 mb-8">
            Start your free 7-day trial. No credit card needed.
          </p>
          <Link
            href="/login"
            className="gradient-bg text-white font-semibold px-8 py-3.5 rounded-xl text-base hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            Get started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <p className="text-sm text-zinc-600">
            © 2026 Pulsr. All rights reserved.
          </p>
          <div className="text-xl font-extrabold gradient-text">Pulsr</div>
        </div>
      </footer>
    </div>
  );
}
