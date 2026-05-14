export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* 상단 컨트롤 영역 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-slate-200 rounded-lg" />
          <div className="h-9 w-20 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-6 w-24 bg-slate-100 rounded" />
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <div className="h-4 w-20 bg-slate-200 rounded" />
            </div>
            <div className="divide-y divide-slate-100">
              {[0, 1, 2].map((j) => (
                <div key={j} className="p-3 flex items-start gap-2">
                  <div className="h-4 w-4 bg-slate-200 rounded shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
