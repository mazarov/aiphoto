export default function RobokassaFailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold text-zinc-950">Оплата не завершена</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Закройте окно и попробуйте снова — токены не списаны.
        </p>
      </div>
    </main>
  );
}
