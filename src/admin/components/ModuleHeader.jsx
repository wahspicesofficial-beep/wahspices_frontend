/* Reusable module page header — icon, title, phase badge, feature count */
export default function ModuleHeader({ icon, title, phase, featureCount, desc, children }) {
  const phaseColor = {
    'Phase 1': 'bg-green-100 text-green-700',
    'Phase 2': 'bg-blue-100 text-blue-700',
    'Phase 3': 'bg-purple-100 text-purple-700',
  }[phase] || 'bg-gray-100 text-gray-600';

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="text-4xl">{icon}</div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-body font-black text-gray-900">{title}</h1>
            <span className={`text-xs font-body font-bold px-2.5 py-0.5 rounded-full ${phaseColor}`}>{phase}</span>
          </div>
          <p className="text-sm text-gray-500 font-body mt-0.5">{desc}</p>
          <p className="text-xs text-gray-400 font-body mt-0.5">✓ {featureCount} features included</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}
