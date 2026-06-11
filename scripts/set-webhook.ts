import * as dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;
const url = process.argv[2];

if (!url) {
  console.error("Uso: npx ts-node scripts/set-webhook.ts https://tu-app.vercel.app");
  process.exit(1);
}

const webhookUrl = `${url}/api/webhook`;

fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: webhookUrl }),
})
  .then((r) => r.json())
  .then((data) => {
    if (data.ok) {
      console.log(`Webhook registrado: ${webhookUrl}`);
    } else {
      console.error("Error:", data.description);
    }
  });
