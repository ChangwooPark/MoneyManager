import express from 'express';
import transactionsRouter from './routes/transactions';
import settingsRouter from './routes/settings';
import budgetsRouter from './routes/budgets';
import categoriesRouter from './routes/categories';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
].filter(Boolean) as string[];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/transactions', transactionsRouter);
app.use('/settings', settingsRouter);
app.use('/budgets', budgetsRouter);
app.use('/categories', categoriesRouter);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
