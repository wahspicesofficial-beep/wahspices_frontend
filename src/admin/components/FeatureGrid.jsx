import { CheckCircle } from 'lucide-react';

/* Reusable 2-column feature checklist */
export default function FeatureGrid({ features, phase }) {
  const isLive = phase === 'Phase 1';
  return (
    <div className="bg-white rounded-2xl shadow-card p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-body font-bold text-gray-800">Module Features</h3>
        <span className={`text-xs font-body font-semibold px-2.5 py-1 rounded-full ${
          isLive ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
        }`}>
          {isLive ? '🟢 Ready for API' : '🔵 UI Ready — API coming'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {features.map((f, i) => (
          <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
            <CheckCircle className="w-4 h-4 text-brand-green flex-shrink-0 mt-0.5" />
            <span className="text-sm font-body text-gray-700 leading-snug">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
