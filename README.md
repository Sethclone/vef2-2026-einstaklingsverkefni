# Dividend Snowballer

A dividend portfolio simulator — build a stock portfolio, fetch live market and dividend data, and simulate how it could grow over time through dividend reinvestment (DRIP).

**Live app:** https://joyful-vision-production-1468.up.railway.app/

---

## Features

- Create and manage dividend portfolios with real stock holdings
- Fetch live quotes and dividend data via the Finnhub API
- Run a snowball simulation: reinvest dividends over N years with configurable growth assumptions
- Import your real Trading 212 portfolio via the T212 API and simulate it directly

---

## Tech Stack

- **Backend:** Node.js, Hono, Prisma 7, PostgreSQL
- **Frontend:** React, TypeScript, Vite, Recharts

---

## Local Setup

### Prerequisites

- Node.js 20+
- A PostgreSQL database
- A [Finnhub](https://finnhub.io/) API key (free tier works)
- _(Optional)_ A Trading 212 API key + secret for the T212 import feature

### Backend

```bash
cd backend/dividend-snowballer
npm install
```

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dividend_snowballer
FINNHUB_API_KEY=your_finnhub_api_key
TRADING_212_API_KEY=your_t212_key        # optional
TRADING_212_API_SECRET=your_t212_secret  # optional
PORT=3000
```

Run migrations and start:

```bash
npx prisma migrate dev --name init
npm run dev   # http://localhost:3000
```

### Frontend

```bash
cd frontend/dividend-snowballer
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3000
```

Start the dev server:

```bash
npm run dev   # http://localhost:5173
```

---

## Railway Deployment

The app is deployed on [Railway](https://railway.app/) with two services: **backend** and **frontend**.

### Backend service — required environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Railway provides this automatically if you add a Postgres plugin) |
| `FINNHUB_API_KEY` | Your Finnhub API key |
| `TRADING_212_API_KEY` | Trading 212 API key _(optional)_ |
| `TRADING_212_API_SECRET` | Trading 212 API secret _(optional)_ |
| `PORT` | Set automatically by Railway |



## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/portfolios` | List all portfolios |
| POST | `/api/portfolios` | Create a portfolio |
| GET | `/api/portfolios/:id` | Get portfolio with holdings |
| PUT | `/api/portfolios/:id` | Update portfolio |
| DELETE | `/api/portfolios/:id` | Delete portfolio |
| POST | `/api/portfolios/:id/holdings` | Add a holding |
| PUT | `/api/portfolios/:id/holdings/:hid` | Update a holding |
| DELETE | `/api/portfolios/:id/holdings/:hid` | Remove a holding |
| POST | `/api/portfolios/:id/simulate` | Run snowball simulation |
| GET | `/api/stocks/:symbol/quote` | Fetch live stock quote |
| GET | `/api/stocks/:symbol/dividends` | Fetch dividend history |
| GET | `/api/t212/portfolio` | Fetch your T212 portfolio |
| GET | `/api/t212/suggested-params` | Get suggested simulation params from T212 |
| POST | `/api/t212/simulate` | Simulate your T212 portfolio |

### Simulation body parameters

```json
{
  "years": 10,
  "growthRate": 7,
  "dividendGrowthRate": 3,
  "drip": true,
  "additionalAnnualInvestment": 0
}
```

---

## Skýrsla


### Dividend Snowball Skýrsla

Þessi skýrsla segir frá hvernig uppbygging á einstaklingsverkefninu fór fram, grunnhugmynd er kynnt fyrir lesanda og sagt er frá hvað fór vel, hvað fór illa og hvernig leyst var úr vandamálum sem upp komu.


### Hugmyndin
Grunnhugmyndin á verkefninu var að búa til tól fyrir fjáfesta sem leyfir að sjá hvernig eignasafn, þá sérstaklega eignasafn með áherslu á arðgreiðslum, myndi vaxa yfir gefinn tíma. Krafan sem ég hafði fyrir þessu verkefni var að hægt væri að búa til eða sækja eignasafn og út frá því væri hægt að spá hvernig það myndi líta út í framtíðinni út frá gefnum forsendum eða gögnum. Þær forsendur sem skipta mestu máli er hvernig eignin hefur þróast í verði undanfarin ár og einnig hvernig vöxtur á arðgreiðslum hefur þróast.
Ástæðan af hverju þetta tól er hentugt er því að þessi aðferð fjárfestinga er mjög óhefðbundin, oftast er stefnan að fjárfesta í vel vaxandi fyrirtækjum með því markmiði að selja það fyrir gróða í framtíðinni. Ég fjárfesti ekki á þann hátt heldur legg ég frekar áherslu á að fjárfesta í fyrirtæki sem greiða hærri arð en í staðinn fæ ég minni vöxt á verðinu á tilheyrandi hlutabréfi. Markmiðið er þá að leyfa safninu að vaxa með að endurfjárfesta arðinn og einnig spara öfgakennt mikið svo að safnið vex sem hraðast, svo eftir mörg ár þegar safnið hefur stækkað töluvert, er þá arðurinn orðinn ágætlega mikill og þá er hægt að hætta endurfjárfestingu og leyfa honum að spila sem reglulegt sjóðstreymi. Í raun væri þetta þá eins og annar lífeyrissjóður sem gefur þann möguleika á að minnka við eða hætta í vinnu fyrr en á hefðbundum tíma. 
 
### Úfærsla
Það fyrsta sem gert var í verkefninu var að ákveða stakkin og þau API sem yrðu notuð, hugmyndin var fyrst að leyfa notenda að búa til eigið safn og séð hvernig það myndi líta út í framtíðinni. Þær forsendur sem voru gefnar í „simulation“ voru áætlaður vöxtur á verðbréfum og áætlaður vöxtur á arð. Enginn lógík var til að áætla þessar tölur enn.

Hono var notað fyrir endapunkta og Prisma/Postgres var notað fyrir gagnagrunnin. Gagnagrunnurinn geymir söfnin og einnig innihald þeirra, það er líka geymt þau „simulation“ sem eru framkvæmd á hverju hlutabréfi.
Upprunalega API sem var notað var Alpha Vantage, ástæðan af hverju það var valið er því það gaf upp öll þau nauðsynlegu gögn sem ég þurfti en hafði þann ókost að leyfa aðeins 25 request á dag og einnig 5/request á sek. Það takmarkaði prufur og upbbygingu töluvert og þar sem tíminn leið tók ég þá ákvörðun að endurgera allt sem tengist API-inum, seinna var skipt yfir í FinnHub þar sem það býður upp á 60 request á min og skilst mér ekki hafa neitt daglegt hámark.
Framendinn er Vite-React og enginn CSS framework er notaður, ég afritaði CSS skrá sem ég fann á netinu og byggði ofan á hann þegar ég þurfti á því að halda, ég get sagt að  CSS og hönnun á flottum framenda er mesti veikleiki minn þegar kemur að vefforitun.
Ég hafði það í huga fyrst að ég vildi fá leið til að nota þetta sem persónulegt app til að halda utan um mitt eignasafn og Trading212 sem er verðbréfamiðillinn minn býður upp á API sem var notfærður í forsíðuna á verkefninu. Hann er þó ekki fullkominn og það var ákveðin áskorun að koma því til að virka almennilega.

Það sem var útfært fyrst var möguleikinn á að búa til eigið eignasafn og einnig að „simulate-a“ það, þó þetta sé ekki endilega simulation en frekar bara array sem sýnir hver staðan verður á safninu eftir gefinn tíma.
Fyrst voru forsendur fyrirfram ákveðnar en seinna voru þau fundin með útreikningum sjálfkrafa til að gefa nákvæmari niðurstöður. Þær forsendur eru, Price Growth%, Dividend Growth%, Time horizon og Additional annual investment. Þá prósentan sem er ályktað að verðbréf hækki í verði á ári, sama með arðgreiðslurnar, hversu langan tíma á að spá fyrir og hversu mikið verður bætt af eigin pening á ári. Svo er möguleiki á að velja DRIP, sem er þá að endurfjárfesta arðgreiðslurnar strax en ekki að taka þær af reikninginum.
 
Hvernig er reiknað framtíðarspá
Með þessari fjárfestingastenfu fylgið mikið „set and forget“ hugafar, það er ekki verið að selja oft og einnig bara litið til langtímans. Eins og nefnt var áður er þetta sett upp sem array þar sem næsta ár byggir á fyrra ári þar til komið er að enda. 

Það eru þrír arrays sem haldið er utan um: verð, arðgreiðslur og fjöldi hluta. Áður en lykkjan byrjar þá breytir þetta forsendum yfir í tölur þannig að 7% -> 1.07 og notar núverandi verð á eignasafni sem grunnlínu.
Fyrir hvert ár eru 6 skref framkvæmd. Fyrst er verðið margfaldað með vaxtaprósentu, næst er arðurinn margfaldaður með vaxtaprósentu, svo er reiknað brúttótekjurnar á arð sem dot product af bréfum og arðgreiðsluhlutföll. Næst er lagt skattinn á arðinn og ef kveikt er á DRIP er lagt arðinn (eftir skatt) hlutfallslega á hvert bréf. Í lok er sett auka innborganir hlutfallsega á bréfin. Á hverju ári er þá þessi útreikningur lagður á YearResult breytu og sama logík lagð á hana þar til komið er á síðasta árið.
Það eru tvær mismunandi tegundir af simulation sem hægt er að gera, fyrsta er að gera það á mitt verðbréfasafn og hin á „sandkassa eignasafnið“ Sandkassa simulationið les gögnin frá Postgres með prisma og sækir svo verð og arðgreiðsluupplýsingar frá Finnhub. Það er svo vistað á gagnagrunninn. Gögnin eru svo cache-uð í klukkutíma til að koma í veg fyrir að fara yfir rate-limit.
Trading212 leiðinn (sem er þá eigið eignasafn) sækir verð frá Trading212 API og breytir öllu í evrur(ef annar gjaldmiðill felur sig í safninu). Sækir svo arðgreiðsluhlutföll frá Finnhub, og reiknar svo með sömu leið. Gert var tilraun að sækja skattprósentur m.v. land en því miður er það ekki möguleiki á T212. Þessi aðferð geymir ekki gögn í gagnagrunn.
 
My Portfolio
My portfolio síðan var útfærð því það kemur í veg fyrir það að breyta mínu persónulega eignasafni handvirkt þegar breytingar verða, þetta þjónar líka að mestu leiti þeim tilgang sem síða eins og DividendSnowball eða TheDividendTracker myndu gefa, án þess að þurfa að greiða fyrir kostnaðinn á þeim síðum. 
Þegar síðan er opnuð er strax sent út tvö köll á Trading212 API, eitt fyrir eignasafnið mitt á T212 og annað fyrir arðgreiðslur sem búið er að greiða út. Þetta fer á bakendann og hann kallar á þessi tvö fetch frá T212 og breytur einnig öllum verður í EUR. Svo er kallað á Finnhub fyrir arðgreiðsluhlutföllin þar sem T212 API því miður styður það ekki. Þar sem finnhub býður ekki upp á gögn fyrir allar eignir þá er sleppt þeim sem ekki skila svari. Fundið er svo dividend per share með að margfalda yield með verðið í evrum. Hver eign hefur sinn Ticker(ID) og það er sett upp sem XXX_US_EQ, XXX er nafnið á fyrirtækinu, því fylgir svo landi og svo týpu eigna, yfirleitt EQ sem stendur fyrir Equity(Þá venjulegt bréf) en óheppilega eru ekki öll Id þannig og því gat ég ekki útfært skattin eins og ég vildi, það er mjög mismunandi ticker-ar og það gerði það mjög erfitt að útfæra þetta eins og ég vildi.
Efst uppi er sýnt heildarverð á safni og einnig heildarkostnaður. Þessi gildi koma beint frá T212 í gegnum walletimpact hlutinn sem T212 skilar og eru þegar reiknuð í evrum, þannig að gjaldmiðlaviðskipti eins og GBX og USD eru þegar meðhöndluð af T212. Heildartölurnar sem sýndar eru eru bara summa þessara gilda yfir allar eignir. Unrealized P&L er gróðinn sem ég myndi fá ef ég seldist út núna og er einnig sótt beint frá T212. Avg cost per share í töflunni er fundinn með því að deila heildarkostnaði úr walletImpact með fjölda bréfa.
Á framenda er fært eignir í useSortable hook, hann heldur utan um raðirnar og í hvaða átt það á að flokka þær, ef smellt er á dálk þá flokkast hann eftir upphæð eða stafrófsröð.
Það sem skilast frá T212 og Finnhub er svo cache-að í bakendanum í klukkutíma, þannig er komið í veg fyrir að fara yfir rate limit á báðum API.

 
### Hýsing
Verkefnið er hýst á Railway, bakendi og framendi eiga bæði sína eigin síðu og bakendinn er tengdur við PostgreSQL. Railway les beint úr GithHub repoinu og það er þá sjálfkrafa uppfært þegar pushað er á main branch. Umhverfisbreyturnar og API lyklar eru svo stiltir á railway og ekki geymdir í kóðanum.

Kröfur uppfylltar
Í fyrri skil gaf ég upp þessar kröfur:
*	Bakendi verður útfærður til að eiga við lógík verðbréfasafnsins og útreikninga.
*	REST API verður útfært til að eiga við söfn, eignir og líkön.
*	External API verður notaður til að sækja gögn um verðbréf og arðgreiðslur.
Hér mun ég örugglega nota Alpha Vantage API, eða Finnhub. Einnig hef ég aðgang að API sem er hjá núverandi Verðbréfamiðil mínum.
*	Gagnagrunnur verður notaður til að geyma söfn og eignir.
*	Framendi verður útfærður til að leyfa notenda að byggja söfn og sjá niðurstöður.
Bakendinn var útfærður og sér um alla flesta lógík á verðbréfasafninu, allir útreikningar nema breyting á gjaldmiðil fer fram þar.
Rest API var útfært en þó aðalega fyrir sandkassa eignasöfnin og því sem fylgir þeim.
Finnhub og Trading212 voru bæði notuð til að sækja gögn um eignirnar og einnig mitt eigið safn.
Gagnagrunnur geymir sandkössur söfn og eignir
Framendi útfærður og nothæfur fyrir allar útfærðar aðgerðir.
 
### Tækni

Allt verkefnið er skrifað í typescript, bæði fram og bakendi. Þetta var til að passa upp á að týpur haldi sér eins á milli þeirra og því að þetta er málið sem við höfum helst unnið með í þessu námskeið
Bakendinn notar Hono sem HTTP frameworkið, þetta var einnig valið þar sem mesta reynslan hefur verið á því útaf námskeiðinu og einnig því þæginlegt er að setja upp routing og middleware.

Prisma var notað sem ORM fyrir PostgreSQL, ég valdi það útaf þægindi og mér lýst mjög vel á hvernig sett er upp schema og að lítið mál sé að útfæra uppfærslur og migrations.
Framendi notar Vite og React,. Vite er mjög hraðvirkt og þæginlegt í notkun, React er notað þar sem ég kann ekki á annað og ReCharts var notað fyrir gröfin, það var mesta straightforward library til að nota með React og þarfnaðist ekki mikið configuration til að setja upp á simulation síðunni.

Utankomandi API-in eru Finnhub og Trading212, Upphaflega var Alpha vantage notað en rate limit á því var of lítið til að geta unnið með og því var Finnhub valið þar sem það er ekki dagleg hámarksnotkun og leyft er 60 request á min. Trading212 er notað þar sem það er minn persónulegi verðbréfamiðill og býður upp á að sækja gögn frá mínum reikning til að nota á síðunni.

Verkefnið er hýst á Railway, bæði bakendi, framendi og gagnagrunnur. Railway var valið þar sem ég er núþegar með áskrift hjá þeim þannig ég þarf ekki að stressast á að það detti út eða að trial endi.
 
### Hvað gekk vel
Það sem gekk vel frá byrjun var úrfærsla á bakenda og uppsetning á sandkassa eignunum, það var mjög ósvipað því sem við gerðum í bæði hópverkefni 1 og hópverkefni 2, Alpha vantage var notað og valdi smá töfum á gögnum en verkefnið virkaði ágætlega. Lítið mál var að setja upp postgres og ég náði að hafa verkefnið hýst og virkandi fyrir kynninguna mína svo að ég gat kynnt demo á tækninni. 
Simulation lógíkin fór vel, þurfti nánast ekkert restructuring í framtíð nema að bæta virkni fyrir skatta.
Að skipta frá Alpha Vantage yfir í finnhub fór mjög vel, að refactora API layerinn borgaði sig gríðarlega þar sem ég var þá laus við rate limit flöskuhálsin og gerði prufur mun léttari meðan unnið var í verkefninu, það tók þó sinn tíma að laga þetta.
Að setja inn in-memory caching strax var mjög hentugt og lagaði það að lenda í rate limit frá Finnhub og T212 án þess að þurfa eitthvað eins og Redis.
Það var mjög heppilegt að T212 bauð upp á að skila allt í evrum þannig að ég þurfti ekki að sjá sjálfur um að nota annað API fyrir gjaldmiðla.
 
### Hvað gekk illa
Alpha vantage var mjög leiðinlegt API, Það leyfir upp í 25 requests á dag og gerði það nánast ómögulegt að prófa meðan ég vann í verkefninu, ég þurfti því að refactora allan API layerinn sem tók töluverðan tíma.
T212 Api er í beta útgáfu sinni og er ekki með sérstaklega gott documentation, ég lenti í veseni með authentication þar sem það þarfnast base64 encoding og responsið kom alltaf tilbaka sem plain array eða {items: [...]} object. Verð voru í skrítnu formi þar sem GBP er í pence en heppilega var létt að laga það með þeirra API án þess að laga það í verkefninu sjálfu.
Fría útgáfan af Finnhub býður ekki alltaf upp á upplýsingar á arð, og oft lenti ég í að fá null skilað sem valdi veseni á útreikningum og þyrfti því að hafa aðferð til að eiga við það með að gera dividendPerShareAnnual / price. Ég gat því ekki sótt viðeigandi gögn og þurfti sjálfur að reikna út hvað það væri.
CSS og framendi er minn mesti veikleiki, ég notaði ekki CSS framework og stylesheetið var tekið af neti og viðbætur útfærðar handvirkt, þetta tók mikinn tíma m.v. hversu lítið það gerir fyrir verkefnið sjálft. Ég vildi þó að síðan líti ágætlega út og vil einnig æfa mig í að gera flottari framenda.
Útfærslan á sköttum fór ekki eins vel og ég vonaði, og ég endaði með því að setja 15% bandaríska skattinn sem fallback á allt sem var ekki hægt að greina, tickerarnir eru geymdir á skrítinn og óhefðbundinn hátt og því miður var ekki tími til að útfæra það.
 
### Hvað var áhugavert

Það sem mér fannst áhugavert er hversu messy heimur fjármála er í gegnum API, rosalega erfitt er að finna API sem vil ekki að þú takir út veskið og borgar 500+$ á mánuði, mjög erfitt er fyrir almenna fjárfesta að fá almennileg gögn og að búa til almennileg forrit sjálfir,  upplýsingar um arð eru kannski aðgengileg á einum stað en ekki öðrum, og stundum er það reiknað mismunandi miða við hvaða API þú notar. Mikið af verkefninu var að brúa þetta saman frekar en að vinna í simulationinu.
Að koma í veg fyrir rate limit var líka áhugaverður partur, Alpha vantage lét mig næstum gefast upp á þessu en ég er í lok glaður að hafa fært mig yfir á Finnhub, sem er þó alls ekki fullkomið en gerir næstum það sem þarf. Chaching er skemmtilegt dæmi og bætir hraðan á síðunni og gott hugafar að hafa þegar kemur að slíkum verkefnum.

Það sem mér fannst áhugaverðast og skemmtilegast var þegar ég náði loksins að hlaða mínu eigin eignasafni inn frá T212, áður þurfti ég að nota aðrar þjónustur sem oftast kostuðu fyrir sömu eða sivpaða virkni, og þar var ekki integration með miðlinum sjálfum heldur var þetta hlaðið upp með kaupsögu í CSV. Þar sem ég hafði gögnin birt á þeirri síðu var létt að fara yfir og lagfæra þau gögn sem ekki voru rétt frekar en að vinna með test eða seeduð gögn. 

Þetta verkefni fór alls ekki eins og ég var að búast við, ég byrjaði á því haldandi það að þetta væri létt og þetta tók á að setja saman. Ég lærði mikið á þessu og mun örruglega í mínum frítíma halda áfram að bæta virkni og lagfæra síðuna, hugsanlega með að bæta við CSV import eða tengingu við önnur brokerage API eins og Interactive brokers þannig að síðan væri þannig séð nothæf fyrir almenning. s
