import express from 'express';
import transactionsRouter from './routes/transactions';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/transactions', transactionsRouter);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
