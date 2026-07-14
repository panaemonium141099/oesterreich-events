-- MASTERPLAN §10.4 / P2: 24.566 Events (9.095 künftige) hatten bundesland NULL
-- trotz 4-stelliger AT-PLZ. Mapping exakt wie getBundeslandFromPLZ()
-- in src/lib/plzCoordinates.ts. Nur AT (country NULL = Alt-Scraper = AT).
UPDATE events SET bundesland = CASE
    WHEN postal_code LIKE '1%' THEN 'wien'
    WHEN postal_code LIKE '2%' OR postal_code LIKE '3%' THEN 'niederoesterreich'
    WHEN postal_code LIKE '4%' THEN 'oberoesterreich'
    WHEN substring(postal_code, 1, 2)::int BETWEEN 50 AND 57 THEN 'salzburg'
    WHEN substring(postal_code, 1, 2)::int BETWEEN 60 AND 66 THEN 'tirol'
    WHEN substring(postal_code, 1, 2)::int BETWEEN 67 AND 69 THEN 'vorarlberg'
    WHEN substring(postal_code, 1, 2)::int BETWEEN 70 AND 78 THEN 'burgenland'
    WHEN postal_code LIKE '8%' THEN 'steiermark'
    WHEN postal_code LIKE '9%' THEN 'kaernten'
    ELSE NULL
  END
WHERE bundesland IS NULL
  AND postal_code ~ '^\d{4}$'
  AND (country IS NULL OR country = 'AT');
