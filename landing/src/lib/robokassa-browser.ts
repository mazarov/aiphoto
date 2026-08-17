"use client";

export type RobokassaBrowserPayload = {
  MerchantLogin: string;
  OutSum: string;
  InvId: number;
  Description: string;
  Culture: "ru";
  Encoding: "utf-8";
  Email?: string;
  IsTest: 0 | 1;
  Receipt: string;
  Shp_payment_id: string;
  Settings: string;
  SignatureValue: string;
};

type RobokassaApi = {
  Render: (payload: RobokassaBrowserPayload) => void;
};

declare global {
  interface Window {
    Robokassa?: RobokassaApi;
  }
}

const SCRIPT_ID = "robokassa-iframe-script";
const SCRIPT_SRC =
  "https://auth.robokassa.ru/Merchant/bundle/robokassa_iframe.js";
let loadPromise: Promise<RobokassaApi> | null = null;

export function loadRobokassa(): Promise<RobokassaApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Robokassa доступна только в браузере"));
  }
  if (window.Robokassa?.Render) return Promise.resolve(window.Robokassa);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<RobokassaApi>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const onLoad = () => {
      if (window.Robokassa?.Render) {
        resolve(window.Robokassa);
      } else {
        loadPromise = null;
        reject(new Error("Robokassa не инициализировалась"));
      }
    };
    const onError = () => {
      loadPromise = null;
      reject(new Error("Не удалось загрузить форму Robokassa"));
    };
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
  return loadPromise;
}

export async function openRobokassaPayment(
  payload: RobokassaBrowserPayload,
): Promise<void> {
  const robokassa = await loadRobokassa();
  robokassa.Render(payload);
}
