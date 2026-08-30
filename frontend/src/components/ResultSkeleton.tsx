export function ResultSkeleton(): JSX.Element {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="glass-panel flex flex-col gap-6 p-6 sm:flex-row">
        <div className="skeleton h-48 w-full shrink-0 sm:w-80" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="skeleton h-7 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-12 w-full" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-36 w-full" />
        ))}
      </div>
    </div>
  );
}
