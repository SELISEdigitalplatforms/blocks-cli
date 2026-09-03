---
name: blocks-captcha
description: "Configure the login captcha of a SELISE Blocks project through the blocks CLI ('captcha list/get/save/enable/disable/delete'): register a reCAPTCHA or hCaptcha site key and secret, switch it on or off, see which configuration blocks-iam actually enforces at login, and retire one. CLI-only, project-scoped; the captcha secret is stored server-side and never shown. Use for 'enable captcha on login', 'change the recaptcha keys', 'why is captcha not showing', 'turn captcha off'."
---

When invoking a project-scoped `blocks` command, either use the resolved account's saved selection or pass `--project <tenantId>` for that one command without changing saved state. `--project` applies to CLI commands only, never SDK calls.

# Blocks Captcha — login captcha configuration

A captcha configuration tells blocks-iam whether to demand a captcha on password login, with which provider (`recaptcha`, `hcaptcha`, or the built-in `bcaptcha`), which site key the login page renders, and which generator (`EasyCaptchaGenerator` or `HardCaptchaGenerator`). The provider **secret** is stored server-side; reads return a `secretId` reference only, never the value, and nothing in the CLI reveals it.

**CLI-only, no SDK path.** **Prerequisite:** a project is selected (`blocks use <tenantId>`); every command runs on an impersonated project token. If login/project state is unknown, run the blocks-bootstrap skill first.

## Which configuration is live

A project may hold several configurations, and more than one may be enabled. blocks-iam enforces exactly one: **the first enabled record in id order**. Every `captcha list`, `enable` and `disable` output therefore carries `activeForLogin` — read that field, never assume the record you just enabled is the enforced one.

```bash
blocks captcha list --json
# {"activeForLogin": "<id or null>", "configs": [{"id", "isEnable", "provider", "captchaKey", "captchaGenerator", "secretId"}], "totalCount": n}
blocks captcha get <id> --json
```

`activeForLogin: null` means login never asks for a captcha.

## Command map

| Command | Notes |
|---|---|
| `blocks captcha list` | All configurations plus `activeForLogin`. Read-only. |
| `blocks captcha get <id>` | One configuration; `secretId` reference, never the secret. Read-only. |
| `blocks captcha save [<id>] --provider p [--captcha-key k] [--captcha-secret s] [--generator g] --enable\|--enable=false` | Omit `<id>` to create, pass it to update. Mutating. |
| `blocks captcha enable <id>` / `blocks captcha disable <id>` | Flip only `isEnable`; nothing else changes. Mutating. |
| `blocks captcha delete <id>` | Removes the record and retires its stored secret. Mutating. |

## Creating and updating

```bash
blocks captcha save --provider recaptcha --captcha-key <siteKey> --captcha-secret <secret> \
  --generator EasyCaptchaGenerator --enable --dry-run --json
blocks captcha save --provider recaptcha --captcha-key <siteKey> --captcha-secret <secret> \
  --generator EasyCaptchaGenerator --enable --yes --json
```

- **Creating requires `--enable` or `--enable=false`.** The server stores an omitted flag as disabled, which would silently create a configuration login never uses; the CLI refuses (`captcha_enable_required`) until you say which you want.
- **`--provider` is validated** against what blocks-iam can verify: `recaptcha`, `hcaptcha`, `bcaptcha`. The portal offers the first two.
- **`--captcha-secret` semantics differ between create and update.** On create it stores the secret. On update (an `<id>` is passed) it **replaces** the stored secret. Omitted or empty, the stored secret is left untouched — so an update that only changes the site key does not need the secret again.
- The secret is redacted in `--dry-run` output (`"captchaSecret": "***"`) and is never echoed back by any command. Pass it from a variable rather than typing it into a prompt or transcript.

Update the site key only:

```bash
blocks captcha save <id> --provider recaptcha --captcha-key <newSiteKey> --yes --json
```

## Switching on and off

```bash
blocks captcha enable <id> --dry-run --json     # shows activeForLoginAfter before touching anything
blocks captcha enable <id> --yes --json
blocks captcha disable <id> --yes --json
```

`enable`/`disable` read the record and re-save it with only `isEnable` changed and no secret, so keys and the stored secret are untouched. If another enabled record sorts first, the output's `note` (also printed to stderr) says so — disable that one to make yours live. A record already in the requested state reports `upToDate: true` and sends nothing.

## Deleting

```bash
blocks captcha delete <id> --dry-run --json     # shows whether the record is currently enabled
blocks captcha delete <id> --yes --json
```

The server retires the stored secret, then removes the configuration. Deleting the enforced configuration stops requiring a captcha at login — the confirmation says so. The configuration cannot be restored; re-create it with `save`.

## `--dry-run` before `--yes` — always

`save`, `enable`, `disable` and `delete` follow the standard `blocks` mutation discipline: `--dry-run` prints the plan without calling the API; `--yes` skips the confirmation. Omitting both drops into an interactive prompt that hangs in a non-interactive run.

## Gotchas

- **Enabled is not the same as enforced.** Only the first enabled record in id order gates login. Always check `activeForLogin`.
- **The secret cannot be read back.** If the user has lost the provider secret, they set a new one with `captcha save <id> --captcha-secret <new>`; nothing in the CLI reveals the stored one.
- **Login behaviour.** When a captcha is enforced and the client sends none, blocks-iam answers the token request with `captcha_required` and the site key; an invalid answer is `captcha_invalid`. Those are login-flow responses, not CLI errors.
- **Impersonated project token only.** A project must be selected first (`blocks use <tenantId>`).

## Example trigger prompts

- "Enable reCAPTCHA on login with these keys." → `captcha save --provider recaptcha --captcha-key ... --captcha-secret ... --enable` (dry-run first).
- "Turn captcha off for now." → `captcha list` to find `activeForLogin`, then `captcha disable <id>`.
- "Why does login not show a captcha?" → `captcha list --json` and check `activeForLogin` (null, or a record whose keys are wrong).
- "Rotate the hCaptcha secret." → `captcha save <id> --provider hcaptcha --captcha-secret <new>`.
- "What is the current captcha secret?" → not available from the CLI; set a new one if it is lost.
- "Remove the old captcha config." → `captcha delete <id>` (dry-run first).
