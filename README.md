## Running
Fill out the environment file with application credentials and options. Alternatively specify them in your system environment variables.
```bash
cp .env.example .env
```

The first time you run the bot, or if it is updated, you should to run the setup task.
Subsequent runs should only run start.
```bash
npm run setup
npm run start
```