import axios from "axios";
import { config } from "../config";

const apiBase = `https://api.telegram.org/bot${config.telegramBotToken}`;

export async function getMe() {
  const res = await axios.get(`${apiBase}/getMe`);
  if (!res.data?.ok) {
    throw new Error(`Telegram getMe failed: ${JSON.stringify(res.data)}`);
  }
  return res.data.result as { username?: string };
}

export async function getFilePath(fileId: string): Promise<string> {
  const res = await axios.get(`${apiBase}/getFile`, { params: { file_id: fileId } });
  if (!res.data?.ok) {
    throw new Error(`Telegram getFile failed: ${JSON.stringify(res.data)}`);
  }
  return res.data.result.file_path as string;
}

export async function downloadFile(filePath: string): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${filePath}`;
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

export async function sendMessage(chatId: number, text: string) {
  await axios.post(`${apiBase}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}
