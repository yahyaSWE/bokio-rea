# Huvudbok

Bokförings- och faktureringsapp för småföretag, inspirerad av arbetsflödena i Bokio men byggd från grunden
med eget namn, egen design och egen kod.

## Funktioner

- **Konton och företag**: registrera dig med e-post och lösenord och skapa ett eller flera företag. Varje företag
  får en egen BAS-kontoplan och egna bokföringsmallar, och du växlar mellan företagen i sidomenyn. All data är isolerad per företag.
- **Översikt**: årets resultat, banksaldo, obetalda fakturor, preliminär moms, diagram, topp 5 kostnader och att göra-lista.
- **Uppladdat**: dra och släpp, välj PDF/bild eller ta en bild direkt med mobilkameran (JPG, PNG, WEBP, HEIC eller PDF, max 20 MB) och bokför dem med *mall*, *manuellt* eller som *utlägg*.
- **Bokfört**: verifikat numrerade per företag och år, sök, underlag och makulering via omvänt verifikat.
- **Momsredovisning**: kvartalsperioder, rutor enligt Skatteverkets blankett, avstämning mot 2650 med öresutjämning och låsning.
- **Fakturering enligt svenska krav** (mervärdesskattelagen 17 kap., aktiebolagslagen 28 kap. 5 §):
  - fullständig faktura med säljarens och köparens namn, adress och organisations-/momsnummer, styrelsens säte för
    aktiebolag, F-skatt (bara om företaget är godkänt), leveransdatum, tjänsteperiod, rabatt och moms per momssats
  - momshantering: 25/12/6/0 %, omvänd betalningsskyldighet, EU-försäljning, export och momsundantag med fakturatext
  - förenklad faktura (högst 4 000 kr inkl. moms) som eget val
  - validering före utfärdande (samma regler i formuläret och på servern, `src/lib/invoice-rules.ts`)
  - nummerserie per företag som räknas upp atomiskt; utfärdade fakturor får en oföränderlig ögonblicksbild
  - rättelse med kreditfaktura (eget nummer, hänvisning till originalet, omvänd bokföring) och historik per faktura
  - dröjsmålsränta (räntelagen eller avtalad) och påminnelseavgift (högst 60 kr, bara om avtalad) som fakturatext
  - **PDF-fakturor** (A4, flera sidor) genereras på servern (`/api/invoices/[id]/pdf`); fakturaregistret kan exporteras som CSV
- **Fakturadesign**: fyra mallar (Modern, Klassisk, Minimal, Elegant), valfri accentfärg, logotyp, bankgiro, plusgiro, IBAN/BIC,
  Swish-QR (förifyllt belopp och fakturanummer), klickbar betallänk och egen sidfot, med förhandsvisning i realtid.
- **AI-avläsning av kvitton** (OpenRouter, `google/gemini-3.1-flash-lite`): leverantör, datum, belopp, moms, land och
  föreslagen mall fylls i automatiskt i bokföringsguiden. Kräver `OPENROUTER_API_KEY`; resultatet sparas per underlag.
- **Bankimport (CSV)**: läs in kontoutdrag från Swedbank, SEB, Handelsbanken, Nordea, Länsförsäkringar, Danske Bank m.fl.
  Transaktionerna matchas mot obetalda kundfakturor, utlägg, obokförda kvitton och verifikat som redan finns på bankkontot,
  och säkra matchningar bokförs automatiskt. Övriga får förslag (mallar, ordlista, tidigare bokningar av samma motpart)
  och bokförs med ett klick. Redan importerade rader hoppas över, och en bokning kan ångras.
- **Användare och behörighet**: bjud in revisor eller redovisningskonsult med en länk (giltig i 14 dagar) som
  *Full behörighet* eller *Läsbehörighet*. Läsbehörighet stoppas på servern i alla åtgärder och API:er som ändrar data.
  Bara ägaren hanterar användare, och företaget har alltid minst en ägare.
- **Koppling till Claude (MCP)**: lägg till `https://<din-app>/api/mcp` som anpassad koppling i Claude (Desktop,
  claude.ai eller mobilen), logga in och godkänn. Claude kan då läsa översikt, resultat- och balansrapport, huvudbok,
  verifikat, kontoplan, fakturor, moms och det som väntar på att bokföras. Inloggningen sker med OAuth 2.1 (PKCE,
  dynamisk registrering, korta nycklar som byts vid förnyelse). Bara ägare och användare med full behörighet kan koppla,
  och kopplingar syns och kopplas från under *Inställningar → Kopplingar*. Vid godkännandet väljer man *Läsa* eller
  *Läsa och bokföra*; med det senare kan Claude bokföra med mall (med förhandsgranskning och kvitto), bokföra bankrader,
  skapa fakturautkast, registrera betalningar och lägga till kunder och artiklar (med dubblettkontroll). Allt märks
  med "Skapad via …" och inget kan raderas.
- **Automatisk utloggning** efter 30 minuters inaktivitet per enhet, med varning två minuter innan (`IDLE_MINUTES` i
  `src/lib/session-config.ts`).
- **Kvitton via e-post**: varje företag får en hemlig adress (Postmark Inbound) dit kvitton och leverantörsfakturor
  skickas eller vidarebefordras. Bilagor (och mejl utan bilaga, som text) hamnar i Uppladdat, läses av med AI och bokförs
  automatiskt när bankraden matchas. Tillåtna avsändare, dubblettkontroll, dygnsgräns och Gmails bekräftelse av
  vidarebefordran visas i appen. Kräver `INBOUND_ADDRESS` och `INBOUND_WEBHOOK_SECRET` (se Inställningar → Kvitton via e-post).
- **Radera företag**: ägaren kan ta bort ett företag permanent (Inställningar → Företag) genom att skriva dess namn, med
  påminnelse om bokföringslagens krav på att spara räkenskapsinformation i sju år. Kontot och andra företag påverkas inte.
- **Utseende**: ljust, mörkt eller automatiskt tema per användare.
- **Räkenskapsår och moms**: företagsform, faktura-/kontantmetoden, moms per månad/kvartal/helår (eller ej momsregistrerad),
  brutet/förlängt räkenskapsår och deadlines enligt Skatteverket.
- **Bokslut**: bolagsskatt, årets resultat, omföring till nästa år och ingående balanser; kan ångras.
- **Import och export (SIE 4)**: exportera ett räkenskapsår eller importera från Fortnox, Visma, Bokio m.fl. med
  kontoplan, ingående balanser och verifikat (originalserier och nummer).
- **Utlägg**, **rapporter** (resultat, balans, huvudbok) och **inställningar** (företag, kontoplan, mallar).

## Lokal utveckling

Kräver Node.js 20 eller senare och Docker (för Postgres).

```bash
npm install
npm run db:setup   # startar Postgres i Docker, kör migreringar och skapar ett demokonto
npm run dev        # http://localhost:3000
```

Demokontots inloggning står överst i `prisma/seed.ts`. Du kan också registrera ett nytt företag på `/register`.
Lokalt sparas uppladdade filer i `uploads/`.

## Publicera på Vercel

1. Lägg koden i ett GitHub-repo och importera det på [vercel.com/new](https://vercel.com/new).
   Sätt **Root Directory** till `app` om repot innehåller mappen `app/`.
2. Under projektets **Storage**:
   - Skapa en **Neon Postgres**-databas och koppla den till projektet (för miljöerna Production och Preview).
     Det sätter `DATABASE_URL` och oftast `DATABASE_URL_UNPOOLED`. Bara `DATABASE_URL` krävs. Om en direkt anslutning
     finns används den för migreringar (`scripts/migrate.mjs`).
   - Skapa en **Blob**-store med åtkomst **Private** och koppla den. Det sätter `BLOB_READ_WRITE_TOKEN`.
   - Valfritt: lägg till miljövariabeln `OPENROUTER_API_KEY` (från openrouter.ai/keys) för AI-avläsning av kvitton.
3. Deploya. Skriptet `vercel-build` kör migreringarna automatiskt, så databastabellerna skapas vid första deployen.
   Kopplade du databasen efter ett misslyckat bygge måste du göra **Redeploy**, eftersom miljövariablerna läses vid byggstart.
4. Öppna sajten och registrera ditt företag.

Kör inte `db:seed` mot produktionsdatabasen.

### Felsökning

- **"Fillagring är inte konfigurerad"** eller `ENOENT ... mkdir '/var/task/...'`: ingen Blob-token finns i deployen.
  Koppla Blob-storen till projektet (Storage → Connect, välj Production) och gör **Redeploy**.
- **"Blob-storen är publik"**: skapa en ny Blob-store med åtkomst **Private** och koppla den istället.
- Variabler med prefix (t.ex. `STORAGE_DATABASE_URL`, `STORAGE_BLOB_READ_WRITE_TOKEN`) hittas automatiskt.

### Så fungerar uppladdning på Vercel

Vercel begränsar anrop till 4,5 MB, så webbläsaren laddar upp filerna direkt till Vercel Blob med en kortlivad token
(`/api/blob`), som bara ges till inloggade användare och bara för det egna företagets mapp. Därefter registreras
filen (`/api/uploads`). Filerna är privata och visas via `/api/files/[id]` efter behörighetskontroll.

## Tester

```bash
npm test   # fakturaregler, PDF-layout och (med databas) nummerserie, kreditfakturor och behörighet
```

## Teknik

Next.js 15 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, Prisma och PostgreSQL,
Vercel Blob och pdf-lib. Lösenord hashas med scrypt, och sessioner lagras i databasen (httpOnly-cookie).

## Begränsningar

- Ingen direkt bankkoppling (kontoutdrag importeras som CSV), inga löner och ingen årsredovisning.
- Fakturor skickas som PDF (nedladdning), inte via e-post.
- Ingen återställning av glömt lösenord och ingen begränsning av antalet inloggningsförsök ännu.
- Inbjudningar skickas inte automatiskt med e-post; länken kopieras eller öppnas i ditt e-postprogram.
- Underlaget för momsrapporten är förenklat. Kontrollera alltid mot Skatteverkets regler.
