import { Bot } from "grammy";
import { Client } from "@notionhq/client";
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";

dotenv.config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

type Horario = "Desayuno" | "Almuerzo" | "Merienda" | "Cena" | "Snack";

interface FoodEntry {
  alimento: string;
  horario: Horario | null;
}

async function parseFood(text: string): Promise<FoodEntry> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    tools: [
      {
        name: "registrar_alimento",
        description:
          "Extrae el nombre del alimento y el horario de comida del mensaje del usuario",
        input_schema: {
          type: "object" as const,
          properties: {
            alimento: {
              type: "string",
              description:
                "Nombre del alimento o descripción de lo que se comió. Si hay varios, unirlos en una sola descripción.",
            },
            horario: {
              type: "string",
              enum: ["Desayuno", "Almuerzo", "Merienda", "Cena", "Snack"],
              description:
                "Momento del día en que se comió. Omitir si no se menciona.",
            },
          },
          required: ["alimento"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "registrar_alimento" },
    messages: [
      {
        role: "user",
        content: text,
      },
    ],
    system:
      "Sos un asistente que registra alimentos. Extraé el nombre del alimento y el horario del mensaje del usuario.",
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("No se pudo parsear el alimento");
  }

  const input = toolUse.input as { alimento: string; horario?: Horario };
  return {
    alimento: input.alimento,
    horario: input.horario ?? null,
  };
}

async function saveToNotion(entry: FoodEntry): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: {
      Alimento: {
        title: [{ text: { content: entry.alimento } }],
      },
      ...(entry.horario && {
        Horario: {
          select: { name: entry.horario },
        },
      }),
      Fecha: {
        date: { start: today },
      },
    },
  });
}

bot.command("start", (ctx) => {
  ctx.reply(
    "Hola! Mandame lo que comiste y lo registro automáticamente en Notion.\n\nEjemplos:\n• desayuno: avena con leche y banana\n• almorcé pollo con arroz y ensalada\n• una manzana\n• merienda: yogur con granola"
  );
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  try {
    await ctx.replyWithChatAction("typing");
    const entry = await parseFood(text);
    await saveToNotion(entry);

    const horarioText = entry.horario ? ` (${entry.horario})` : "";
    await ctx.reply(`Registrado: ${entry.alimento}${horarioText}`);
  } catch (error) {
    console.error(error);
    await ctx.reply("No pude registrar el alimento. Intentá de nuevo.");
  }
});

bot.start();
console.log("Bot iniciado");
