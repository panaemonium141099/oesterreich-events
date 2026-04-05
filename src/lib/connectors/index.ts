/**
 * Connectors — Universal event feed parsers for the venue-centric ingestion pipeline.
 *
 * Each connector transforms a specific feed format (ICS, JSON-LD, RSS)
 * into ScrapedEvent[] compatible with the existing scraping pipeline.
 */

export { ICSConnector, paramValue } from './ics-connector';
export type { ICSConnectorOptions, ICSParseResult } from './ics-connector';

export { extractEventsFromHtml, fetchAndExtractEvents } from './json-ld-connector';
export type { JsonLdConnectorOptions, JsonLdExtractionResult } from './json-ld-connector';

export { detectFeedsFromHtml, detectFeeds } from './feed-detector';
export type {
  DetectedFeed,
  FeedDetectionResult,
  FeedDetectorOptions,
} from './feed-detector';
