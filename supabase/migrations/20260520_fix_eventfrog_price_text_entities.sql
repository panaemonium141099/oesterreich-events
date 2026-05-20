-- Fix Eventfrog price_text rows where priceCurrency was scraped as an
-- HTML entity ("&#8364;") instead of the ISO code "EUR".
--
-- Root cause + code fix:
--   src/lib/connectors/json-ld-connector.ts -- normalizePriceCurrency()
--   prevents new rows from picking up the entity going forward.
--
-- Affected rows at time of writing: 402 (all source_name='eventfrog').
-- The regex covers the three Euro entity variants observed in the wild:
--   &#8364;, &euro;, &#x20AC;
-- and folds them back to "EUR" so the price_text matches the format the
-- connector emits for healthy rows ("15.00 EUR", "10.00 - 25.00 EUR").

UPDATE events
SET price_text = trim(regexp_replace(
  price_text,
  '&(#0*8364|#x0*20[Aa][Cc]|euro);?',
  'EUR',
  'g'
))
WHERE price_text ~ '&(#0*8364|#x0*20[Aa][Cc]|euro);?';
