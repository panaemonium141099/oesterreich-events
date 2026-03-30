export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-slate-700 border-t-amber-400 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-medium">Wird geladen...</p>
      </div>
    </div>
  );
}
