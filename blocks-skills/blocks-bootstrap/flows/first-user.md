# Flow: Creating the first end user

Login is configured but nobody can use it yet — a fresh project has no end users. This flow gets exactly one person able to sign in, which is where bootstrap ends. Everything afterwards (inviting the rest of the team, roles at scale, offboarding) belongs to `blocks-iam-users` and `blocks-iam-account`.

These are real accounts on the user's own tenant. Every mutation gets `--dry-run` first, then approval, then `--yes`.

## 1. Check mail before promising email

```bash
blocks mail config list --json
```

Do this **first**, because it decides which of the two paths below is even possible. Account activation and password reset are delivered by email, and on a project with no mail configuration that mail goes nowhere — silently. Recommending "they'll get an activation email" on such a project strands the user waiting for something that will never arrive.

If there is no mail configuration, say so plainly and offer the choice: set mail up first (`blocks-mail`), or use the direct path in step 3b.

## 2. Ask who creates the account

> Do you want to create this first user from the Blocks portal, or here?

Both are legitimate. The portal is often the better answer for a real administrator account the user intends to keep. If they choose the portal, hand them the link, wait for confirmation, then verify from here:

```bash
blocks iam users list --page-size 5 --json
```

## 3. Creating it here

Check the address is free first — creating over a collision is a worse failure than being told no:

```bash
blocks iam email available "<email>" --json
```

Decide roles before creating, not after. `blocks iam roles list --json` shows what exists, and `blocks iam roles assignable --json` shows what this account may actually grant. Confirm the choice with the user rather than assigning something administrative on your own judgement.

### 3a. Preferred — let the user set their own password

Create the account without a password so the person completes setup themselves through the activation/reset mail. Invited users are created with no name and supply it on the activation form, so `--first-name`/`--last-name` are optional here:

```bash
blocks iam users create --email "<email>" --roles "<role>" --dry-run --json
```

Then `--yes` after approval. This is the path to prefer whenever mail is configured: no password ever passes through your output, the terminal, or a file.

### 3b. Fallback — admin-set password, when mail is not configured

Only when step 1 showed no mail configuration and the user has chosen not to set it up yet:

```bash
blocks iam users create --email "<email>" --password "<value>" --roles "<role>" --dry-run --json
```

Handle it strictly:

- **The user supplies the password, or approves one, in the moment.** Do not invent one and announce it.
- **Show it exactly once, in the terminal, and nowhere else.** Never in a summary you write afterwards, never in a file, a README, a commit, a config, or a note "for later".
- **Tell them to change it after the first login**, and treat it as compromised the moment it is reused anywhere else.
- **Never echo it back** in later messages in the conversation, even if asked to confirm what it was.

## 4. Enable the account if needed

`blocks iam users activate <userId>` and `blocks iam users deactivate <userId>` are the administrator's enable/disable toggle for an account — the pair that suspends and restores access. They are not the same thing as the person completing their own activation form from an emailed link.

```bash
blocks iam users activate <userId> --reason "<why>" --dry-run --json
```

Use it when the account exists but is disabled. Do not run it reflexively on a freshly created account you have not checked.

## 5. Verify a real login

The only proof that works: have the user open the app and sign in.

```bash
blocks iam users list --email "<email>" --json
```

confirms the record exists, but a listed user is not a user who can log in — a null authorization URL on the identity provider or `isOidcEnabled: false` both produce a valid-looking user who cannot get through the front door. If sign-in fails, go back to the OIDC flow rather than creating more users.

## Done when

- One person can complete a real login against the running app.
- Their roles were chosen deliberately, with the user, not defaulted.
- No password exists in any file, commit, or message you wrote.
