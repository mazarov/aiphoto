import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/PageLayout";

const SITE = "PromptShot";
const DOMAIN = "promptshot.ru";
const EMAIL = `hello@${DOMAIN}`;

export const metadata: Metadata = {
  title: `Политика конфиденциальности — ${SITE}`,
  description: `Политика конфиденциальности сервиса ${SITE}. Информация о сборе, хранении и обработке данных.`,
  robots: "noindex, follow",
};

export default function PrivacyPage() {
  return (
    <PageLayout>
      <article className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Политика конфиденциальности
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Дата вступления в силу: 19 марта 2026 г.
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-zinc-900">1. Общие положения</h2>
            <p className="mt-2">
              Настоящая Политика конфиденциальности определяет порядок сбора, хранения,
              обработки и защиты персональных данных пользователей сайта{" "}
              <strong>{DOMAIN}</strong> (далее — «Сервис», «{SITE}»).
            </p>
            <p className="mt-2">
              Используя Сервис, вы соглашаетесь с условиями данной Политики. Если вы не
              согласны с какими-либо положениями, пожалуйста, прекратите использование Сервиса.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">2. Какие данные мы собираем</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Данные авторизации:</strong> при входе через Telegram мы получаем ваш
                Telegram ID, имя пользователя и имя. Мы не получаем ваш номер телефона или пароль.
              </li>
              <li>
                <strong>Данные об использовании:</strong> просмотренные страницы, сохранённые
                карточки, созданные генерации. Эти данные помогают улучшать Сервис.
              </li>
              <li>
                <strong>Технические данные:</strong> IP-адрес, тип браузера, операционная система,
                источник перехода (UTM-метки). Собираются автоматически для аналитики.
              </li>
              <li>
                <strong>Cookies:</strong> используются для авторизации и аналитики
                (Яндекс.Метрика).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">3. Цели обработки данных</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Обеспечение работы Сервиса и авторизации пользователей</li>
              <li>Персонализация контента (избранное, история генераций)</li>
              <li>Анализ использования и улучшение Сервиса</li>
              <li>Предотвращение злоупотреблений и обеспечение безопасности</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">4. Хранение данных</h2>
            <p className="mt-2">
              Данные хранятся на серверах, расположенных на территории Российской Федерации
              и Европейского Союза. Мы применяем стандартные меры безопасности для защиты
              данных от несанкционированного доступа, изменения или уничтожения.
            </p>
            <p className="mt-2">
              Данные хранятся в течение всего срока использования Сервиса. При удалении
              аккаунта данные удаляются в течение 30 дней.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">5. Передача данных третьим лицам</h2>
            <p className="mt-2">Мы не продаём и не передаём ваши персональные данные третьим лицам, за исключением:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Сервисы аналитики:</strong> Яндекс.Метрика — для анализа посещаемости
                (обезличенные данные).
              </li>
              <li>
                <strong>Платформы дистрибуции:</strong> Pinterest, социальные сети — публикуются
                только карточки промтов (публичный контент), не персональные данные.
              </li>
              <li>
                <strong>По требованию закона:</strong> в случаях, предусмотренных
                законодательством РФ.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">6. Права пользователя</h2>
            <p className="mt-2">Вы имеете право:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Запросить информацию о хранимых данных</li>
              <li>Потребовать исправления неточных данных</li>
              <li>Потребовать удаления ваших данных</li>
              <li>Отозвать согласие на обработку данных</li>
            </ul>
            <p className="mt-2">
              Для реализации этих прав свяжитесь с нами:{" "}
              <a href={`mailto:${EMAIL}`} className="text-blue-600 underline">
                {EMAIL}
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">7. Изменения Политики</h2>
            <p className="mt-2">
              Мы можем обновлять данную Политику. Актуальная версия всегда доступна по
              адресу{" "}
              <Link href="/privacy" className="text-blue-600 underline">
                {DOMAIN}/privacy
              </Link>
              . Продолжая использовать Сервис после изменений, вы принимаете обновлённую
              Политику.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-900">8. Контакты</h2>
            <p className="mt-2">
              По всем вопросам, связанным с обработкой персональных данных:{" "}
              <a href={`mailto:${EMAIL}`} className="text-blue-600 underline">
                {EMAIL}
              </a>
            </p>
          </section>
        </div>
      </article>
    </PageLayout>
  );
}
