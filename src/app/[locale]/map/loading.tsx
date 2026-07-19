export default function MapLoading() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center animate-pulse motion-reduce:animate-none">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-white/[0.06]" />
        <div className="h-3 w-32 rounded bg-white/[0.06] mx-auto" />
      </div>
    </div>
  );
}
