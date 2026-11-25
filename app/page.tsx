export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rounded-2xl border border-amber-400/25 bg-amber-950/20 p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
          Mela.io
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-amber-50">
          Welcome to the Festive Carnival
        </h1>
        <p className="mt-4 text-base text-amber-100/80">
          A cozy, private-room 3D Indian mela for up to five friends.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-950/40 px-4 py-1.5 text-xs font-medium text-emerald-200">
          <span>CP-01 Skeleton Ready</span>
          <span aria-hidden="true">•</span>
          <span>Gameplay &amp; rooms coming in later checkpoints</span>
        </div>
      </div>
    </main>
  );
}
