export default function CalendarLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-gray-700 border-t-indigo-400 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm font-medium">Kalender wird geladen...</p>
      </div>
    </div>
  );
}
