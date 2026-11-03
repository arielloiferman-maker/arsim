# Beach Brawl deployment

The Cloudflare Worker serves the game. One Durable Object per room handles joins, player movement and melee hits. Supabase optionally records room creation. It does not receive player positions, session tokens or hit data.

1. Create a private GitHub repository and upload the source files from the deployment ZIP. Keep `team-model.obj` with the game code.
2. From the project folder, run `npm install`, `npx wrangler login`, and `npm run deploy`. Use the Worker URL printed at the end.
3. In the chosen Supabase project, apply `supabase.sql` from the SQL editor.
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as Worker secrets through Cloudflare. Do not add them to GitHub or the browser bundle. The Worker can accept matches before the optional room log is connected.

For local play, run `npm run build` and `npm start` and open http://127.0.0.1:4183/.
