# Einstaklingsverkefni, fyrri skil

## Arðgreiðslusnjóboltahermir

## Scope verkefnisins

Verkefnið verður web application sem er sambærilegt við þjónustur eins og “Snowball Analytics” og “The Dividend Tracker”.  
Notandi á að geta fengið innsæi í heilsu og stöðu verðbréfasafns með áherslu sett á arðgreiðslur. Markmið verkefnisins er að notandi getur sjálfur smíðað einfalt verðbréfasafn og sótt alvöru markaðs- og arðgreiðsluupplýsingar frá API og gert þá líkön um hvernig safnið gæti vaxið yfir gefinn tíma sé g.r.f. að útborganir séu fjárfestar aftur.

Forritið er einungis hermir, og mun auðvitað ekki bera neina áhættu með meðhöndlun á alvöru pening. Þetta er bara til að reikna út frá gefnu safni sem notandi býr til sjálfur.

## Hvaða skilyrði verði útfærð og hvaða efnistök

Bakendi verður útfærður til að eiga við lógík verðbréfasafnsins og útreikninga.

REST API verður útfært til að eiga við söfn, eignir og líkön.

External API verður notaður til að sækja gögn um verðbréf og arðgreiðslur.  
(Í lokaskil verður þetta með öllum líkendum óaðgengilegt fyrir notenda nema tími sé til þess að útfæra í Admin viðmóti.)  
Hér mun ég örugglega nota Alpha Vantage API, eða Finnhub. Einnig hef ég aðgang að API sem er hjá núverandi Verðbréfamiðil mínum.

Gagnagrunnur verður notaður til að geyma söfn og eignir.

Framendi verður útfærður til að leyfa notenda að byggja söfn og sjá niðurstöður.

## Framework og tól

Ég geri ráð fyrir að eftirfarandi framework verði notuð í verkefnið:

- Node.js  
- Hono  
- PostgreSQL  
- React  
- Recharts (fyrir gröf og niðurstöður)  
- Alpha Vantage (external API fyrir data á eignum)

## Verkplan

**Vika 6:**  
Fyrri skil undirbúið. Ákveðið verður hvaða external API verður notað og skissað verður upp gagnamódel fyrir safnið.

**Vika 7:**  
Byrjað verður að setja upp bakenda. Grunnur á strúktúr settur upp og endapúnktar fyrir safnið og eignir verða settir upp.

**Vika 8:**  
Áframhald með bakenda. Gagnagrunnur tengdur og sett upp schema fyrir söfn. External API verður full útfærður til að geta sótt upplýsingar um eignir.  
(Í lokaskilum verða gögn með öllum líkendum “seeduð” inn nema tími sé til þess að útfæra.)

**Vika 9:**  
„Snjóboltahermir“ og líkön verða útfærð, þ.m.t. endurfjárfesting, g.r.f. gróði og líkön fyrir ákveðin tíma í framtíðina.

**Vika 10:**  
Útfærsla á framenda byrjar. Annaðhvort React eða Next.js framendi svo notandi geti búið til safn, bætt við eignum og reiknað niðurstöður. Bakendi og framendi tengdir.

**Vika 11:**  
Áframhald með framenda með áherslu á að koma útreikningum fram á sjónrænan hátt.

**Vika 12:**  
Páskafrí. Hugsanlega takmarkaður tími til að vinna í verkefninu en eitthvað verður haldið áfram með framenda. Ef ég er á eftir áætlun er þetta góður tími til að ná mér aftur.

**Vika 13:**  
Skýrslugerð. Ég vil reyna að vinna hana jafnóðum en hér verður sérstaklega unnið í henni ásamt kynningu. Sett upp hýsing fyrir verkefnið.

**Vika 14:**  
Skýrslugerð kláruð og loka yfirfærsla.

**Vika 15:**  
Skil. Allt farið yfir og gert klárt.

## Matskvarði

### 30% Hermun
Þessi hluti metur hvort hermun virki rétt. Litið er á útreikninga á arðgreiðslum, endurfjárfestingu og vaxtaforsendur og tímabil. Hermun þarf að gefa rökrétta og endurtekningahæfa niðurstöðu sem byggð er á forsendum sem notandi gefur og fortíðargögnum.

### 25% Bakendi og REST API
Metið er hvort bakendi sé rétt uppsettur og hvort REST API endapunktar virki rétt fyrir söfn, eignir og keyrslu hermunar. Litið er á skýra uppbyggingu, rétt HTTP notkun og tengingu við gagnagrunn.

### 20% External API tenging og gögn
Metið er hvort external API sé notað rétt, hvernig verð og arðgreiðslur eru sótt, hvernig villur og takmarkanir eru meðhöndlaðar og hvort gögnin nýtist raunhæft í verkefninu.

### 15% Framendi og framsetning niðurstöðu
Metið er hvort framendi leyfi notenda að búa til eignasafn, bæta við eignum og skoða niðurstöðu hermunar á skýran hátt. Áhersla er á læsilega framsetningu gagna og einfalt viðmót.

### 10% Próf og hýsing
Metið er hvort skrifuð séu próf sem skipta máli, sérstaklega fyrir útreikninga og hermunarlógík. Einnig hvort verkefnið sé sett upp í hýsingu.
