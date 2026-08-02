# Legal documents

Published PromptShot legal documents:

- `offer.pdf` — public offer
- `privacy.pdf` — personal data processing policy

Maintainable HTML sources are in `landing/legal-source/`. The `/terms` and
`/policy` pages detect the PDFs during the Next.js build; if a file is absent,
the corresponding page shows a publication-pending notice instead of a broken
link.
