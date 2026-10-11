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

Esikatselu: <http://127.0.0.1:4173/>. `dist/` sisältää julkaistavan HTML:n, CSS:n, JavaScriptin, faviconin ja `games.json`-aineiston. Sivun vierailut eivät tee pyyntöjä TV-oppaiden tai NHL:n rajapintoihin. Kaikki resurssipolut ovat suhteellisia, joten sivu toimii myös GitHub Pagesin projektihakemistossa.

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
| [Viaplay TV](https://viaplaytv.fi/ohjelmatiedot/) | Päivittäinen HTML-ohjelmaopas; vain `LIVE`-merkityt NHL-ottelut |
| [Viaplay](https://viaplay.fi/urheilu/jaakiekko/nhl) | Julkinen `content.viaplay.fi/pcdash-fi/urheilu/jaakiekko/nhl` -ohjelmarajapinta; vain suorat ottelulähetykset |

Disney+:lle ei ole automaattista hakijaa ensimmäisessä versiossa. Sen vahvistetut ottelut voi lisätä käsin alla kuvatulla tavalla. Star-lähetys ei yksin riitä todisteeksi saman ottelun saatavuudesta Disney+:ssa.

Joukkueiden kaupunki- ja lempinimet muunnetaan NHL:n joukkuekoodeiksi. Lähetys yhdistetään vain yhteen saman joukkueparin otteluun, jos lähetyksen alku on 60 minuuttia ennen ottelua tai korkeintaan 20 minuuttia sen jälkeen. Epäselvät osumat jätetään yhdistämättä. Näin studion alku ei muuta ottelun virallista alkamisaikaa, eivätkä myöhemmin näytetyt uusinnat muutu ilmaislähetyksiksi. Kanavaoppaan uutisten ympärille pilkottu ottelu näytetään kerran.

Primetime tarkoittaa Suomen aikaa klo 12.00–24.00 alkavaa peliä. Tasan keskiyöllä alkava peli näytetään edellisen illan alla klo 24.00; klo 00.01 on jo yöpeli. Aikavyöhyke on aina `Europe/Helsinki`, ei kiinteä UTC-siirtymä. Katsottavuus suodatetaan ottelun alkamisen, ei studion alkamisen mukaan.

## Häiriöt ja välimuisti

Jokaisen lähteen viimeisin onnistuneesti jäsennetty tulos tallennetaan `.cache/`-hakemistoon. GitHub Actions säilyttää sen seuraavaa ajoa varten. HTTP-virhe tai muuttunut tietorakenne ei korvaa lähteen aiempaa aineistoa.

- Haku epäonnistui: käytetään korkeintaan 48 tuntia vanhaa lähdeaineistoa, ja sivu näyttää häiriöstä ilmoituksen.
- Yli 48 tuntia vanha kanavatieto: sitä ei esitetä vahvistettuna.
- Tuoretta NHL-otteluohjelmaa ei ole: generointi epäonnistuu ja aiempi julkaistu sivu jää voimaan.
- Selain ilmoittaa yli vuorokauden vanhasta sivusta. Jokaisen lähteen oma hakuaika ja oppaan kattavuus näkyvät sivun lopun lähdetiedoissa.

Jotkin palveluntarjoajien HTTPS-palvelimet lähettävät puutteellisen varmenneketjun. Tällöin GET-haku kokeilee järjestelmän `curl`-komentoa, joka tarkistaa varmenteet normaalisti. TLS-tarkistuksia ei poisteta käytöstä.

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

Tämä on muotoesimerkki, ei vahvistus kyseisen pelin Disney+-lähetyksestä. Ottelun virallisen ajan voi tarvittaessa korjata ylimmän tason `startTimeUTC`-kentällä. Kanavakoodit: `sub`, `star`, `viaplaytv`, `viaplay`, `disney`. Korjaukset merkitään sivulla käsin vahvistetuiksi. Ne poistuvat näkymästä, kun ottelu alkaa.

## Asetukset ja testit

- `SCHEDULE_DAYS`: haettavan jakson pituus, oletus 14, sallittu 1–31.
- `BUILD_NOW`: ISO-aikaleima toistettavaa generointia varten; normaalisti käytetään nykyhetkeä.
- `MTV_CLIENT_VERSION`: MTV:n julkisen web-asiakkaan versio. Jos oletus vanhenee, hakija yrittää löytää uuden version MTV:n julkisista sivuresursseista.
- `PORT`: esikatselupalvelimen portti, oletus 4173.

`npm test` tarkistaa keskiyön ja kesäajan käsittelyn, joukkueiden tunnistuksen, uusintojen ja epäselvien osumien poissulkemisen, kanavien yhdistämisen, ohjelmaoppaiden jäsentämisen, välimuistin palautumisen, korjaukset sekä HTML:n oletussuodatuksen ja tekstien escapetuksen. Testit eivät tarvitse verkkoyhteyttä.

Palvelu on riippumaton otteluopas. Lähetysoikeuksia ei päätellä yleisestä kausisopimuksesta; ottelukohtainen kanavamerkintä perustuu ohjelmatietoihin.
