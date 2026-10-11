# Starin puuttuva välivarmenne

`sectigo-ov-r36.pem` on julkinen **Sectigo Public Server Authentication CA OV R36** -välivarmenne. Starin HTTPS-palvelin jättää sen varmenneketjustaan pois.

Lähde on palvelimen oman varmenteen Authority Information Access -kentän ilmoittama Sectigo-osoite:

<http://crt.sectigo.com/SectigoPublicServerAuthenticationCAOVR36.crt>

DER-muotoinen julkinen varmenne on muunnettu PEM-muotoon. Sen allekirjoitus on tarkistettu Node.js:n valmiiksi luotettua **Sectigo Public Server Authentication Root R46** -juurivarmennetta vasten. Sama tarkistus ja voimassaolon tarkistus tehdään ohjelmassa ennen jokaista käyttökertaa. Varmenteen voimassaolo päättyy 21.3.2036.

Varmennetta käytetään ainoastaan Starin ohjelmaoppaan HTTPS-pyynnöissä. Palvelimen varmenteen voimassaolon ja palvelinnimen tarkistuksia ei ohiteta eikä uusia juurivarmenteita lisätä. Jos Star vaihtaa myöntäjää, tarkista sen uusi ketju; älä poista TLS-tarkistusta käytöstä.
