# Product Spec Configurator

Account: 75fproduct@gmail.com · D1 database: `product-spec-db` (`ac34d9ae-fe01-4b51-90a8-0a1c6aeb7d63`)

Everything below is done in the Cloudflare dashboard. No command line needed.

## 1. Tables
Nothing to do: the Worker creates its tables in `product-spec-db` on first use (from `schema.sql`, all `IF NOT EXISTS`).
To check after first sign-in: **D1 → product-spec-db → Console** → `SELECT * FROM product_families;` lists 6 placeholder families.

## 2. Create the Worker

**Recommended: deploy from GitHub (redeploys on every push)**
1. **Workers & Pages → Create → Import a repository**, then connect GitHub and pick `vramakrishnan2026/product-requirements`.
2. Project name: `product-requirements` (must match `name` in `wrangler.toml`).
3. Build command: `node build.mjs` · Deploy command: `npx wrangler deploy`. Leave the root directory as `/`.
4. Click **Create and deploy**. The D1 binding comes from `wrangler.toml`, so step 3 below is already done; carry on with step 4 (secrets).

**Or paste by hand (no GitHub link)**
1. **Workers & Pages → Create → Create Worker** (start from "Hello World").
2. Name it `product-spec` and click **Deploy**.
3. Click **Edit code**, delete everything in `worker.js`, paste the contents of **`dist/worker.js`** and click **Deploy**.

## 3. Connect the database
**Worker → Settings → Bindings → Add → D1 database**
- Variable name: `DB` (exactly that)
- Database: `product-spec-db`

## 4. Set the password
**Worker → Settings → Variables and Secrets → Add**, type **Secret**:
- `ACCESS_PASSWORD`: the shared password you give people
- `SESSION_SECRET`: any long random string (keeps logins signed)

Changing either value signs everyone out.

## 5. Open it
Go to the Worker's URL (`https://product-requirements.<your-subdomain>.workers.dev`) and sign in with the password.

---

## Updating later
When you get a new `dist/worker.js` from me: **Edit code**, paste it, **Deploy**. The data stays in D1.

Editing the product-family list (the "reuse plastics" dropdown) is done in the D1 Console, e.g.:
```sql
UPDATE product_families SET name='OmniStat (Gen 2)', notes='…' WHERE id='omnistat';
INSERT INTO product_families (id, name, sort_order) VALUES ('newfam', 'New family', 70);
UPDATE product_families SET active=0 WHERE id='connect';   -- hide from dropdown
```

## What is stored
| Table | Phase | Purpose |
|---|---|---|
| `specs` | 1 | One row per requirement sheet; all answers as JSON |
| `spec_values` | 1 → 2 | Every answer flattened (one row per option), ready for product matching and BOQ costing |
| `spec_history` | 1 | Previous version each time a spec is saved |
| `product_families` | 1 | Dropdown list (placeholders for now) |
| `products`, `product_capabilities` | 2 | Existing product data to match against (empty) |
| `boq_items`, `boq_feature_map` | 3 | BOQ parts, costs, and which requirement pulls in which part (empty) |

## Planned later
- Phase 2: product matching ("this exists already" vs "new product")
- Phase 3: BOQ cost estimate (summary and detailed) from the BOQ sheet
- Visual mock-up from the spec plus the mechanical file
- Microsoft sign-in with Carrier accounts, replacing the shared password, after Carrier IT approves it

---

## ChatGPT plugin (voice / chat interview)

The Worker also serves an MCP endpoint that ChatGPT (or Claude) uses to read the questions and save answers. Answers saved there show up on the web page immediately.

**1. Turn on the endpoint.** Worker → Settings → Variables and Secrets → add Secret `MCP_TOKEN` = a long random string (e.g. from `openssl rand -hex 24`). Use letters/digits only.
The MCP address is then `https://<your-worker>.workers.dev/mcp/<MCP_TOKEN>`. Treat this URL like a password: anyone with it can read and save requirements. To revoke it, change `MCP_TOKEN`.

**2. Add it to ChatGPT** (on the web, chatgpt.com):
1. Plugins → **Add** → **Add custom MCP server**.
2. Name: `Product Spec Configurator`. Server URL: the MCP address above. Authentication: **No authentication**.
3. Accept the warning → **Create as a plugin** → install it.

**3. Add the interview skill (recommended).** Plugins → **Add** → **Upload plugin archive** → `product-spec-interviewer-plugin.zip` (built from `chatgpt-plugin/`).
If the upload is rejected, open the **Skills** tab and create a skill from `chatgpt-plugin/product-spec-interviewer/skills/spec-interview/SKILL.md` instead.

**4. Use it.** New chat → type `@Product Spec Configurator start a new product requirement interview`, or start voice mode and say the same.
ChatGPT asks before running write actions; approve `save_spec` (you can choose to always allow).

Later: replace the URL token with OAuth (Carrier Microsoft sign-in).
