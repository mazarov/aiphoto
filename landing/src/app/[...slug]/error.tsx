"use client";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function TagListingError({ error, reset }: Props) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-5 py-16 text-center">
      <h1 className="text-xl font-bold text-zinc-900">Не удалось загрузить категорию</h1>
      <p className="mt-3 max-w-md text-sm text-zinc-600">
        Временная ошибка сервера. Попробуйте обновить страницу — каталог может загрузиться через
        несколько секунд.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-zinc-400">Код: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
      >
        Попробовать снова
      </button>
    </div>
  );
}
