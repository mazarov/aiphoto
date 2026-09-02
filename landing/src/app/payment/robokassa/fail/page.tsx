import { RobokassaReturnScreen } from "@/components/RobokassaReturnScreen";

export default function RobokassaFailPage() {
  return (
    <RobokassaReturnScreen
      title="Оплата не завершена"
      description="Токены не списаны. Возвращаем на экран до оплаты."
    />
  );
}
