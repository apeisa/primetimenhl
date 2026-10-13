# Primetime NHL

Staattinen, suomenkielinen otteluopas Suomessa näytettäville NHL-peleille.

Oletuksena näkyvät primetime-pelit MTV Subilta, Star Channelilta ja Viaplay TV:stä. Suodattimet poistamalla näkyvät myös yöpelit, Viaplayn maksulliset lähetykset sekä ottelut, joiden Suomen lähetystietoja ei vielä ole vahvistettu.

## Käyttö paikallisesti

Tarvitset Node.js 22:n tai uudemman ja `curl`-komennon.

```sh
npm ci
npm test
npm run build
npm run preview
```

Esikatselu: <http://127.0.0.1:4173/>. `dist/` sisältää julkaistavan HTML:n, CSS:n, JavaScriptin, PWA-tiedostot ja `games.json`-aineiston. Sivun vierailut eivät tee pyyntöjä TV-oppaiden tai NHL:n rajapintoihin. Kaikki resurssipolut ovat suhteellisia, joten sivu toimii myös GitHub Pagesin projektihakemistossa.

Suodattimien tila tallennetaan URL:n hakuehtoihin, joten näkymän voi jakaa linkkinä. Ilman hakuehtoja molemmat oletussuodattimet ovat päällä. Jo alkaneet pelit piilotetaan selaimessa minuutin välein.

## GitHub Pages

Repo: <https://github.com/apeisa/primetimenhl>

1. Valitse repositorion **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Pushaa `main`-haaraan tai käynnistä **Actions → Päivitä ja julkaise otteluopas → Run workflow**.
3. Sivun osoite on <https://apeisa.github.io/primetimenhl/>.

Workflow hakee ohjelmatiedot, ajaa testit ja julkaisee sivun kuuden tunnin välein. GitHubin ajastettu ajo voi viivästyä, eikä ole reaaliaikainen. Workflow ei tarvitse henkilökohtaista GitHub-tokenia: julkaisu käyttää ajon rajattuja Pages- ja OIDC-oikeuksia.

Oman domainin voi lisätä myöhemmin **Settings → Pages → Custom domain** -kohdassa ja GitHubin ilmoittamilla DNS-tietueilla. Lisää vasta silloin sama domain tiedostoon `public/CNAME`, jolloin se päätyy myös seuraaviin julkaisuihin. Domainia ei tarvita ensimmäiseen julkaisuun.

Sama `dist/` voidaan julkaista myös Surgeen tai muuhun staattiseen hostingiin. Tietojen päivitys pitää tällöinkin ajaa erikseen.

## Tietolähteet ja yhdistäminen

| Lähde | Haettava tieto |
| --- | --- |
| [NHL](https://www.nhl.com/schedule) / `api-web.nhle.com/v1/schedule/{date}` | Ottelu-ID, joukkueet, virallinen alkamisaika ja ottelun tila |
| [MTV:n ohjelmaopas](https://www.mtv.fi/kanavat/aikataulu) | Subin ohjelmat MTV-sivun käyttämästä julkisesta GraphQL-rajapinnasta; vain `LIVE`-ohjelmat |
| [Starin ohjelmaopas](https://www.starchannel.fi/ohjelmaopas/star) | Ottelunimet ja lähetyksen aikaleimat HTML:stä |
| [Viaplay TV](https://viaplaytv.fi/ohjelmatiedot/) | Päivittäinen HTML-ohjelmaopas; vain `LIVE`-merkityt NHL-, NBA-, NFL- ja MLB-ottelut |
| [Viaplay](https://viaplay.fi/urheilu/jaakiekko/nhl) | Julkinen `content.viaplay.fi/pcdash-fi/urheilu/jaakiekko/nhl` -ohjelmarajapinta; vain suorat ottelulähetykset |

Disney+:lle ei ole automaattista hakijaa ensimmäisessä versiossa. Sen vahvistetut ottelut voi lisätä käsin alla kuvatulla tavalla. Star-lähetys ei yksin riitä todisteeksi saman ottelun saatavuudesta Disney+:ssa.

Joukkueiden kaupunki- ja lempinimet muunnetaan NHL:n joukkuekoodeiksi. Lähetys yhdistetään vain yhteen saman joukkueparin otteluun, jos lähetyksen alku on 60 minuuttia ennen ottelua tai korkeintaan 20 minuuttia sen jälkeen. Epäselvät osumat jätetään yhdistämättä. Näin studion alku ei muuta ottelun virallista alkamisaikaa, eivätkä myöhemmin näytetyt uusinnat muutu ilmaislähetyksiksi. Kanavaoppaan uutisten ympärille pilkottu ottelu näytetään kerran.

Primetime tarkoittaa Suomen aikaa klo 12.00–24.00 alkavaa peliä. Tasan keskiyöllä alkava peli näytetään edellisen illan alla klo 24.00; klo 00.01 on jo yöpeli. Aikavyöhyke on aina `Europe/Helsinki`, ei kiinteä UTC-siirtymä. Katsottavuus suodatetaan ottelun alkamisen, ei studion alkamisen mukaan.

## Häiriöt ja välimuisti

Jokaisen lähteen viimeisin onnistuneesti jäsennetty tulos tallennetaan `.cache/`-hakemistoon. GitHub Actions säilyttää sen seuraavaa ajoa varten. HTTP-virhe tai muuttunut tietorakenne ei korvaa lähteen aiempaa aineistoa.

- Haku epäonnistui: käytetään korkeintaan 48 tuntia vanhaa lähdeaineistoa, ja häiriön tiedot tallentuvat `games.json`-tiedostoon.
- Yli 48 tuntia vanha kanavatieto: sitä ei esitetä vahvistettuna.
- Tuoretta NHL-otteluohjelmaa ei ole: generointi epäonnistuu ja aiempi julkaistu sivu jää voimaan.
- Päivitysaika näkyy sivun lopussa. Jokaisen lähteen oma hakuaika ja oppaan kattavuus löytyvät `games.json`-tiedostosta.

Jotkin palveluntarjoajien HTTPS-palvelimet lähettävät puutteellisen varmenneketjun. Tällöin GET-haku kokeilee järjestelmän `curl`-komentoa, joka tarkistaa varmenteet normaalisti. TLS-tarkistuksia ei poisteta käytöstä.

Starin osalta mukana on sen palvelimelta puuttuva julkinen Sectigo-välivarmenne. Ohjelma tarkistaa sen allekirjoituksen Node.js:n luotettuun juurivarmenteeseen ennen käyttöä, jolloin myös Linuxissa tehtävä automaattinen haku toimii. Katso `src/certificates/README.md`.

`npm run build:cached` rakentaa sivun ilman verkkohakuja olemassa olevasta välimuistista. Tämä on hyödyllinen ulkoasun kehityksessä. Yhdistämättömät ohjelmatiedot löytyvät `.cache/match-report.json`-tiedostosta. Kaikki ohjelmaoppaat eivät kata koko 14 päivän jaksoa, eikä puuttuva lähetys tarkoita, että ottelu olisi Suomessa katsomattomissa.

## Käsin tehtävät korjaukset

`data/overrides.json` on lista NHL-ottelu-ID:llä kohdistettavista korjauksista. Käytä vain ottelukohtaisesti vahvistettua ohjelmatietoa ja linkitä sen lähde.

```json
[
  {
    "gameId": 2026020084,
    "removeChannels": ["sub"],
    "broadcasts": [
      {
        "channel": "disney",
        "url": "https://www.disneyplus.com/",
        "startTimeUTC": "2026-10-11T21:00:00Z"
      }
    ]
  }
]
```

Tämä on muotoesimerkki, ei vahvistus kyseisen pelin Disney+-lähetyksestä. Ottelun virallisen ajan voi tarvittaessa korjata ylimmän tason `startTimeUTC`-kentällä. Kanavakoodit: `sub`, `star`, `viaplaytv`, `viaplay`, `disney`. Korjaukset merkitään sivulla käsin vahvistetuiksi. Klo 22.00–24.00 alkaneet pelit säilyvät näkymässä seuraavan aamun klo 02.00 asti; muut poistuvat ottelun alkaessa.

## Asetukset ja testit

- `SCHEDULE_DAYS`: haettavan jakson pituus, oletus 14, sallittu 1–31.
- `BUILD_NOW`: ISO-aikaleima toistettavaa generointia varten; normaalisti käytetään nykyhetkeä.
- `MTV_CLIENT_VERSION`: MTV:n julkisen web-asiakkaan versio. Jos oletus vanhenee, hakija yrittää löytää uuden version MTV:n julkisista sivuresursseista.
- `PORT`: esikatselupalvelimen portti, oletus 4173.

`npm test` tarkistaa keskiyön ja kesäajan käsittelyn, joukkueiden tunnistuksen, uusintojen ja epäselvien osumien poissulkemisen, kanavien yhdistämisen, ohjelmaoppaiden jäsentämisen, välimuistin palautumisen, korjaukset sekä HTML:n oletussuodatuksen ja tekstien escapetuksen. Testit eivät tarvitse verkkoyhteyttä.

Palvelu on riippumaton otteluopas. Lähetysoikeuksia ei päätellä yleisestä kausisopimuksesta; ottelukohtainen kanavamerkintä perustuu ohjelmatietoihin.

## Teema ja asennus

Teema seuraa oletuksena järjestelmää. Teemavalinnan voi vaihtaa vaaleaksi tai tummaksi; selain muistaa valinnan. Sivulla ei ole kanavakohtaista suodatinta.

Sivun voi asentaa kotinäytölle selaimen asennustoiminnolla (iPhonessa Safari → Jaa → Lisää Koti-valikkoon). Manifestin polut toimivat myös GitHub Pagesin projektihakemistossa. Sovellusikonia käytetään vain kotinäytöllä.

Service worker hakee sivun ja resurssit ensisijaisesti verkosta. Ilman yhteyttä näytetään viimeksi tallennettu otteluohjelma; sen ikä näkyy päivitysajasta. Klo 22.00–24.00 alkaneet pelit säilyvät näkymässä seuraavan aamun klo 02.00 asti myös offline-tilassa. Muut alkaneet pelit ja lähteen valmiiksi ilmoittamat ottelut piilotetaan.

## NBA, NFL ja MLB

Sivun liigavalinnalla voi näyttää NHL:n, NBA:n, NFL:n, MLB:n tai kaikki liigat. NHL on oletus. `?league=nba`, `?league=nfl`, `?league=mlb` ja `?league=all` ovat jaettavia osoitteita. Primetime- ja ilmaiskanavasuodattimet toimivat valitun liigan sisällä. MLB:n ilmaiskanavasuodatin voi näyttää tyhjää, koska maksutonta TV-lähetystä ei päätellä maksullisesta palvelusta.

- NBA ja NFL: ESPN:n julkinen päiväkohtainen scoreboard (`site.api.espn.com/apis/site/v2/sports/{basketball/nba,football/nfl}/scoreboard`). Vastauksista otetaan alkuaika, joukkueet, ottelu-ID ja tila; Yhdysvaltain TV-kanavia ei käytetä Suomen katselutietoina.
- MLB: liigan oma `statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=team`. Ottelut erotetaan `gamePk`-tunnisteella myös doubleheaderissa.
- MLB:n Viaplay: sama julkinen ohjelmarajapinta kuin NHL:ssä, polku `baseball/major-league-baseball`. Vain LIVE-ottelut.
- Ruutu NFL: `https://www.ruutu.fi/ohjelmat/nfl`, vain `/stream/`-kortit ja niiden tulevat lähetysajat. RedZone ja tallenteet jätetään pois. Vuosi päätellään hakujaksosta, myös vuodenvaihteessa.
- TV5, Kutonen, Nelonen, Jim ja Hero: Elisa Viihteen julkinen EPG (`https://viihde-epg-api-prod.csf.elisa.fi/epg/channels` ja `/schedule`). Haku tehdään kanavittain enintään seitsemän päivämäärän jaksoissa. Vain nimen tai kuvauksen suoraksi ilmoittamat NBA/NFL-ottelut hyväksytään.

Jos NFL:n ilmaiskanavaopas ilmoittaa vain `NFL LIVE:` ilman joukkueita, lähetys yhdistetään ainoastaan saman ajankohdan yhteen suomenkieliseen Ruudun NFL-otteluun (enintään 20 minuutin ero). Molemmat lähdelinkit tallentuvat lähetyksen `evidence`-kenttään. Jos osuma puuttuu tai vaihtoehtoja on useita, ilmaislähetystä ei vahvisteta.

NBA League Pass ja DAZN NFL Game Pass lisätään maksullisina Suomen tilauspalveluina liigan vahvistetuille otteluille. Saatavuuden lähteet: [NBA:n alueohje](https://support.watch.nba.com/hc/en-us/articles/115000586473-Global-NBA-League-Pass-Availability) ja [DAZN:n Game Pass -ohje](https://www.dazn.com/en-GB/help/articles/16310468908957-dazn-and-nfl-game-pass-the-ultimate-football-experience). Ne eivät tarkoita maksutonta TV-kanavaa tai yleistä HBO Max / Prime Video -tilausta. MLB.TV:n ottelukohtaista saatavuutta ja HBO Maxin erillistä otteluopasta ei automaattisesti päätellä; vahvistetun ottelun voi lisätä korjauksena.

Korjauksessa voi antaa `league: "nba"`, `"nfl"` tai `"mlb"`; ilman liigaa se tarkoittaa NHL:ää. Ottelu-ID:n tyyppi vastaa lähdettä: NBA/NFL/MLB käyttävät merkkijonoa, NHL numeroa. Uudet kanavat ovat `tv5`, `kutonen`, `nelonen`, `jim`, `hero`, `ruutu`, `nba_pass`, `nfl_pass` ja `hbomax`.

Lähteet käyttävät palveluiden julkisia verkkosyötteitä, eivät taattua kehittäjä-API-sopimusta. Validointi ja 48 tunnin välimuistisuoja ovat samat kuin NHL:ssä. Jos yhden uuden liigan ohjelmaa ei saada, muut liigat toimivat ja kyseisen liigan kohdalla näytetään ilmoitus. Lähteen onnistunut tyhjä ottelupäivä hyväksytään (esimerkiksi kausien välissä).
