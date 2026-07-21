import app from './app.js';

const PORT: number = Number(process.env.PORT);

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
