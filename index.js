require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Telegraf } = require('telegraf');
const firebaseAdmin = require('firebase-admin');
const crypto = require('crypto');

// Initialize Firebase
const serviceAccount = require('./telecfu-firebase-adminsdk-slozh-b4e0dcaa8b.json');
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
});
const db = firebaseAdmin.firestore();

// Initialize Express and Telegraf
const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

app.use(cors());
app.use(express.json());

// Verify Telegram Login
app.post('/api/auth', async (req, res) => {
  const { hash, ...data } = req.body;
  const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();

  const checkHash = crypto
    .createHmac('sha256', secret)
    .update(Object.entries(data).sort().map(([key, value]) => `${key}=${value}`).join('\n'))
    .digest('hex');

  if (checkHash !== hash) {
    return res.status(403).json({ success: false, message: 'Invalid login' });
  }

  const { id, first_name } = data;
  await db.collection('users').doc(id.toString()).set({ id, name: first_name }, { merge: true });
  res.status(200).json({ success: true });
});

// Fetch User Files
app.get('/api/files/:userId', async (req, res) => {
  const { userId } = req.params;
  const files = await db.collection('files').where('userId', '==', parseInt(userId)).get();
  if (files.empty) return res.json([]);
  res.json(files.docs.map((doc) => doc.data()));
});

// Telegram Bot Handlers
bot.on('document', async (ctx) => {
  const { file_id, file_name } = ctx.message.document;
  const userId = ctx.from.id;

  await db.collection('files').add({ fileId: file_id, fileName: file_name, userId, uploadedAt: new Date() });
  ctx.reply(`File "${file_name}" uploaded successfully!`);
});

bot.launch();
app.listen(process.env.PORT, () => console.log(`Backend running on port ${process.env.PORT}`));
