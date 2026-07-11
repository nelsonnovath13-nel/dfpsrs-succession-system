# Jinsi ya Kumtumia ChatGPT Kuendelea na Project Hii Bila Kuiharibu

Maelezo haya ni kwa ajili yako Nelson — jinsi ya ku-set up ChatGPT (au AI yeyote
mwingine) ili aendelee kufanya kazi kwenye mfumo huu kwa ubora na bila kuvunja
kilichopo tayari.

## Hatua ya 1: Mpe context kamili kabla ya kumwomba chochote

Usimwambie tu "endelea na project hii." Mpe kwanza faili hizi mbili kutoka kwenye
zip (zipo ndani ya project folder):
- `PROJECT_HANDOFF.md`
- `database/schema_notes.md`

Prompt ya kuanzia (bandika kama ulivyo, kisha ambatanisha zip / faili hizo mbili):

```
Hii ni project halisi iliyokwisha-deploy live (sio mockup). Soma
PROJECT_HANDOFF.md na database/schema_notes.md kwanza kabla ya kubadilisha
chochote. Database tayari ipo live kwenye Supabase (project ref
nqrhqpwfmprtwhfmlrcz) — USIRUDISHE migrations zilizokwishafanyika, ongeza
mpya tu kama kuna mabadiliko mapya yanayohitajika. Vile vile usibadilishe
design system (rangi, mitindo ya button/card) iliyokwishawekwa kwenye
tailwind.config.ts na app/globals.css — itumie kama ilivyo.

Kabla ya kuandika code yoyote, nieleze kwanza unachotaka kufanya na ni faili
zipi utabadilisha, halafu nisubiri niseme "endelea" ndipo uandike code.
```

Hii inamlazimisha asome kwanza, asielewe vibaya, na akupe nafasi ya kukagua plan
yake kabla ya kuandika code — badala ya kuanza kuandika mara moja na labda
kuvunja kitu.

## Hatua ya 2: Mwambie asiguse infrastructure iliyopo

ChatGPT (tofauti na mimi) haina uwezo wa moja kwa moja wa ku-deploy kwenye
Vercel au kuandika kwenye Supabase yako moja kwa moja — atakuandikia code tu,
halafu wewe (au tool nyingine) ndio mtakayo-deploy. Kwa hiyo mwambie wazi:

```
Wewe utaniandikia code tu. Mimi ndiye nitakayeweka (deploy) kwenye Vercel na
kuendesha migrations kwenye Supabase. Kwa kila mabadiliko ya database,
nipe SQL kamili ya migration peke yake (sio maelezo tu), ili niweze
kuiendesha mwenyewe kwenye Supabase SQL editor.
```

## Hatua ya 3: Mwombe achunguze kabla ya kubadilisha, si baada

Kila unapoomba feature mpya, tumia muundo huu wa maombi (hii ndiyo inayonipa
mimi ubora unaouona):

1. **Eleza tatizo/kipengele kwa uwazi** — si "boresha app" bali "ongeza uwezo wa
   mmiliki kupakia risiti ya malipo ya Local Government Leader kwenye ukurasa wa
   succession record."
2. **Mwambie akague design/schema iliyopo kwanza** kabla ya kupendekeza jinsi ya
   kuitekeleza.
3. **Mwambie akuonyeshe mpango (plan) kwa maandishi kabla ya code.**
4. **Baada ya kuridhika na mpango, ndipo useme "sawa, andika code."**
5. **Mjaribishe kwa `npm run build` kabla ya kudai imekamilika** — mwambie moja
   kwa moja: "hakikisha `npm run build` inapita bila error kabla ya kuniambia
   umemaliza."

## Hatua ya 4: Epuka makosa ya kawaida ChatGPT hufanya kwenye miradi kama hii

- **Anaweza kusahau muktadha wa awali** akiwa na mazungumzo marefu — kila
  ukianzisha mazungumzo mapya, mkumbushe kusoma PROJECT_HANDOFF.md tena.
  Usidhani anakumbuka kutoka mazungumzo ya jana.
- **Anaweza kubadilisha design bila kuombwa** (mfano: kurudisha rounded corners,
  emoji, rangi tofauti) — mkatae mara moja akifanya hivyo, mkumbushe design
  system iliyopo.
  ni ipi.
- **Anaweza "kuiga" schema mpya badala ya kutumia iliyopo** — daima mwambie
  "tumia majina ya column/table yaliyopo kwenye schema_notes.md, usiunde mapya
  bila sababu."
- **Anaweza kukupa code isiyojaribiwa** — daima mwombe athibitishe kwa build/lint
  kabla ya kusema "nimemaliza."

## Hatua ya 5: Kwa deployment (muhimu sana)

Hakuna GitHub repo iliyounganishwa kwa sasa — kila deploy inahitaji faili ZOTE
kwa wakati mmoja (angalia sehemu ya 9 ya PROJECT_HANDOFF.md). Kama utaendelea
na AI tool isiyo na uwezo wa moja kwa moja wa ku-deploy (kama ChatGPT ya kawaida),
njia bora zaidi sasa ni:

1. Fungua GitHub repo mpya, weka code humo (`git init`, `git add .`,
   `git commit`, `git push`).
2. Kwenye Vercel dashboard, unganisha project na hiyo repo (Import Git
   Repository).
3. Baada ya hapo, kila `git push` itafanya deploy moja kwa moja — hakuna haja ya
   kubandika faili 40+ kila wakati.

Hii ndiyo hatua ya kwanza ninayopendekeza uifanye kabla ya kuendelea na feature
mpya — itakuepusha na maumivu ya kichwa ya deployment ya faili nyingi.

## Muhtasari wa haraka — prompt moja unayoweza kubandika moja kwa moja

```
Soma PROJECT_HANDOFF.md na database/schema_notes.md zilizoambatanishwa kabla
ya kufanya lolote. Hii ni mfumo halisi uliokwisha-deploy (Digital Family
Property & Succession Records System, Tanzania) — database ipo live kwenye
Supabase, design system ipo tayari kwenye tailwind.config.ts na
app/globals.css. Usibadilishe rangi/mtindo bila kuombwa, usiunde schema mpya
bila sababu, na kabla ya kuandika code yoyote nieleze mpango wako kwanza
niridhie. Kila mabadiliko ya database, nipe SQL migration kamili peke yake.
Kabla ya kusema umemaliza kazi, hakikisha umejaribu (mentally verify) kuwa
haitavunja `npm run build`.

Kazi ya leo: [eleza hapa unachotaka kuongeza au kurekebisha]
```
