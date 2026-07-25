# Kaggle submission package

Deadline: **Jul 25, 2026 18:00 GMT+2**

## Checklist

1. [ ] Merge PR(s) to `main` on https://github.com/ardjo-s/Picsou
2. [ ] Open https://www.kaggle.com/competitions/paris-gemma-4-hackathon/writeups
3. [ ] Click **New Writeup**
4. [ ] Paste content from `docs/WRITEUP.md` (under 1500 words)
5. [ ] Set track: **Context Engineering for SLMs**
6. [ ] Attachments → Project Links: `https://github.com/ardjo-s/Picsou`
7. [ ] Attachments → Demo: link to `docs/demo/JURY-DEMO.md` on GitHub or paste CLI transcript
8. [ ] Click **Submit** (not draft)

## Writeup title suggestion

**Picsou Router: context engineering for thrifty Gemma 4 attention triage**

## Subtitle suggestion

**Which SLM is enough—and does Alien context pay for itself per token?**

## Demo attachment text (paste if needed)

```text
Clone https://github.com/ardjo-s/Picsou and run:
  npm test
  npm run evaluate:matrix

No GPU or API key required. See docs/demo/JURY-DEMO.md.
```

## Eligibility gates

| Gate | Status |
| --- | --- |
| Public repo | https://github.com/ardjo-s/Picsou |
| Writeup submitted | User action required |
| Login-free demo | `docs/demo/JURY-DEMO.md` |

## Brev live smoke (optional)

If `curl http://127.0.0.1:30000/v1/models` succeeds before submit, add one line to
the Writeup: "Live Gemma 4 E2B smoke tested via SGLang on NVIDIA Brev." Otherwise
state fixture-first demo honesty (already in WRITEUP).
