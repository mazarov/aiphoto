"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDebug } from "@/components/DebugFAB";
import { GenerationCard } from "@/components/GenerationCard";
import Link from "next/link";

type Generation = {
  id: string;
  status: string;
  resultUrl: string | null;
  prompt: string;
  model: string;
  aspectRatio: string;
  createdAt: string;
};

export function GenerationsContent() {
  const { user, loading: authLoading } = useAuth();
  const debug = useDebug();
  const showGeneration = debug?.debugOpen ?? false;

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !showGeneration) {
      setLoading(false);
      return;
    }

    async function load() {
      const res = await fetch("/api/generations?limit=50", { credentials: "include" });
      const data = await res.json();
      setGenerations(data.generations || []);
      setTotal(data.total ?? 0);
      setLoading(false);
    }

    load();
  }, [user, showGeneration]);

  if (!showGeneration) {
    return (
      <p className="text-zinc-500">
        Страница доступна в режиме отладки. 5 кликов по логотипу в футере.
      </p>
    );
  }

  if (authLoading || !user) {
    return (
      <p className="text-zinc-500">
        <Link href="/" className="text-indigo-600 hover:underline">Войдите</Link>, чтобы увидеть свои генерации.
      </p>
    );
  }

  if (loading) {
    return <div className="animate-pulse text-zinc-500">Загрузка...</div>;
  }

  if (generations.length === 0) {
    return (
      <p className="text-zinc-500">
        У вас пока нет генераций. Откройте карточку промпта и нажмите «Сгенерировать».
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {generations.map((g) => (
        <GenerationCard
          key={g.id}
          id={g.id}
          status={g.status}
          resultUrl={g.resultUrl}
          prompt={g.prompt}
          model={g.model}
          aspectRatio={g.aspectRatio}
          createdAt={g.createdAt}
        />
      ))}
    </div>
  );
}
