-- ad_request pro Tag nach User-Agent und IP-Zahl (2026-10-17)
--
-- Seit 2026-10-17 meldet AdSlot jede AdSense-Anforderung als Analytics-Event
-- `ad_request` (event_data.slot = Anzeigenblock). Damit ist sichtbar, ob ein
-- JS-ausfuehrender Crawler (Beispiel: Baidus Render-Farm aus 116.179.33.x,
-- fester UA Chrome/99.0.4844.51, seit 17.10. per Caddy gesperrt) Anzeigen
-- ausloest. Ein echter Besucher hat wenige Requests pro Session und viele
-- verschiedene UAs; ein Crawler fuehrt zu einem UA mit vielen IPs und
-- Requests, eine Session je Pageview.
--
-- Ausfuehren auf dem Server (Prod-DB nur per SSH):
--   ssh root@157.180.42.4 'docker exec -i supabase-db psql -U postgres' \
--     < docs/ops/ad-request-nach-ua-und-ip.sql

-- 1) Pro Tag und User-Agent: Requests, IPs, Sessions, Slots
select
  (created_at at time zone 'Europe/Vienna')::date as tag,
  user_agent,
  count(*)                               as ad_requests,
  count(distinct ip_hash)                as ips,
  count(distinct session_id)             as sessions,
  count(distinct event_data->>'slot')    as slots
from analytics_events
where event_type = 'ad_request'
  and created_at >= now() - interval '14 days'
group by 1, 2
order by 1 desc, 3 desc;

-- 2) Pro Tag gesamt, mit Verhaeltnis zu den Pageviews der Anzeigen-Seiten
--    (Event-, Aktivitaets- und Blog-Detailseiten tragen Slots)
with t as (
  select
    (created_at at time zone 'Europe/Vienna')::date as tag,
    count(*) filter (where event_type = 'ad_request')  as ad_requests,
    count(distinct ip_hash) filter (where event_type = 'ad_request') as ad_ips,
    count(*) filter (where event_type = 'page_view'
                       and page ~ '^(/en)?/(events|aktivitaet|blog)/') as anzeigen_pageviews
  from analytics_events
  where created_at >= now() - interval '14 days'
    and event_type in ('ad_request', 'page_view')
  group by 1
)
select tag, ad_requests, ad_ips, anzeigen_pageviews,
       round(100.0 * ad_requests / nullif(anzeigen_pageviews, 0), 1) as prozent
from t
order by tag desc;
