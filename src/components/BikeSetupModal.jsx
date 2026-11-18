import React from 'react';
import { X, Bike, CheckCircle2, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';

export function BikeSetupModal({ isOpen, onClose, onEnableKneeFriendly, isKneeFriendly }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg max-h-[92vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/90 flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/15 text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Bike Setup & Knee Protection</h2>
              <p className="text-xs text-slate-400">30-Second Orthopedic Fit for Zero Knee Pain</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
          {/* Why Knees Hurt Callout */}
          <div className="bg-gradient-to-br from-amber-500/10 to-teal-500/10 border border-amber-500/30 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Why Knees Hurt on a Peloton</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>90% of cycling knee pain</strong> occurs when the saddle is 1–2 inches too low. When the saddle is low, the kneecap is pinned tightly against the femur under massive compressive force at the top of every single stroke.
            </p>
          </div>

          {/* Step 1: Saddle Height */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-teal-400">
                Step 1 • The Heel-on-Pedal Test
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-bold">
                Most Important
              </span>
            </div>
            <h3 className="text-sm font-bold text-white">Set Saddle Height</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sit on the saddle and place your <strong>bare heel</strong> directly onto the pedal. Spin down to the lowest position (6 o'clock).
            </p>
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Target:</strong> Your leg should be completely straight with your heel flat (no hip rocking).</span>
              </div>
              <div className="flex items-start gap-2 text-slate-400 pt-1">
                <ArrowRight className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                <span>When you clip in with the ball of your foot, this automatically produces the perfect <strong>25°–30° slight bend</strong> that takes all pressure off the kneecap.</span>
              </div>
            </div>
          </div>

          {/* Step 2: Saddle Fore/Aft */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-teal-400">
              Step 2 • Forward / Backward
            </span>
            <h3 className="text-sm font-bold text-white">Saddle Fore / Aft (Knee Over Pedal)</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Rotate pedals level so your feet are at 3 o'clock and 9 o'clock.
            </p>
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Target:</strong> The front bony part of your forward kneecap should align directly above the center axle of the pedal.</span>
              </div>
              <div className="flex items-start gap-2 text-slate-400 pt-1">
                <ArrowRight className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                <span>If your knee drifts forward past your toes, slide the saddle backward a notch.</span>
              </div>
            </div>
          </div>

          {/* Step 3: Handlebars */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-teal-400">
              Step 3 • Handlebar Height
            </span>
            <h3 className="text-sm font-bold text-white">Raise the Handlebars</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Set the handlebars <strong>equal to or 1–2 inches higher</strong> than the saddle. This opens up your hip angle, prevents pelvic rotation, and stops your knees from jamming upward.
            </p>
          </div>

          {/* Step 4: Cadence Over Resistance */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-teal-400">
              Step 4 • Pedaling Technique
            </span>
            <h3 className="text-sm font-bold text-white">Spin Smooth (80–90 RPM) — Never Grind</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pushing heavy resistance at slow speeds (&lt;65 RPM) acts like hundreds of repetitive heavy leg presses on your joints. Keep resistance light-to-moderate (25–35) and spin smoothly at 80–90 RPM. Let your cardiovascular system burn the calories, not your knee joints.
            </p>
          </div>

          {/* In-App Knee-Friendly Mode Toggle */}
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">Knee-Friendly Ride Mode</span>
              </div>
              <p className="text-xs text-slate-300">
                100% seated in saddle • Capped resistance (≤35) • Joint-sparing 80–90 RPM cadence.
              </p>
            </div>
            {onEnableKneeFriendly && (
              <button
                type="button"
                onClick={() => onEnableKneeFriendly(!isKneeFriendly)}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border shrink-0 transition-all active:scale-95 ${
                  isKneeFriendly
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                {isKneeFriendly ? '✓ Enabled' : 'Enable'}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-teal-500/20"
          >
            Ready to Ride
          </button>
        </div>
      </div>
    </div>
  );
}

export default BikeSetupModal;
