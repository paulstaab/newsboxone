# Backend Implemented Test Cases Baseline

## Purpose
This document captures currently implemented backend test coverage in a self-contained, human-readable format.
Each test case has a stable ID, a short description, and an expected result so it can be understood without opening source files.

## API Test Cases
The public API is specified in `docs/api-contract.yaml`.
This document tracks implemented backend coverage for that shared NewsBoxOne API surface.

Rust API tests seed fixture data on top of the production SQL migrations so schema coverage stays aligned with runtime behavior.

## Current Automation Gaps
- No dedicated automated tests currently target CLI command invocation directly.
- CLI behavior is validated via required manual validation steps in repository workflow.

## Source of Truth
- Unit and API tests under `tests/`.
- Shared fixtures under `tests/fixtures/`.
- Shared API behavior in `docs/api-contract.yaml`.

## Enumerated Test Cases

### Service Runtime and CORS

| ID | Case | Description | Expected Result |
|---|---|---|---|
| TC-SVC-001 | Public version endpoint reachable | Request `/api/version` through the public application surface. | Endpoint responds successfully (`200`). |
| TC-SVC-002 | Health endpoint response | Call `/status` and verify health payload format. | Returns `200` with body `{"status":"ok"}`. |
| TC-SVC-003 | CORS on service endpoint | Send request to `/status` with an `Origin` header. | Response includes `access-control-allow-origin: *`. |
| TC-SVC-004 | CORS on API endpoint | Send request to `/api/version` with an `Origin` header. | Response includes `access-control-allow-origin: *`. |
| TC-SVC-005 | CORS preflight support | Send `OPTIONS` preflight request with `Access-Control-Request-Method`. | Returns success and includes CORS method headers. |

### Feed Parsing and URL Safety

| ID | Case | Description | Expected Result |
|---|---|---|---|
| TC-FEED-001 | Parse Atom 0.3/1.0 and RSS variants | Add feeds from multiple fixture formats (`atom`, `rss`, GitHub Atom, feed without explicit IDs). | Feed is stored and at least one article is ingested for each fixture. |
| TC-FEED-002 | Block dangerous URL schemes and targets | Validate unsafe URLs such as `file://`, localhost, private ranges, and metadata IPs. | URL validation rejects each unsafe URL with SSRF protection error. |
| TC-FEED-003 | Allow safe public HTTPS URL | Validate a normal public HTTPS feed URL. | URL validation succeeds without exception. |
| TC-FEED-004 | Block dangerous redirect targets | Validate redirect hops that point to localhost, private ranges, or metadata IPs. | Redirect target validation rejects each unsafe hop before the request is followed. |
| TC-FEED-005 | Fail closed on DNS resolution errors | Validate a hostname-based URL whose DNS lookup fails during SSRF checks. | URL validation rejects the request instead of bypassing address validation. |

### Feed Quality Decisioning

| ID | Case | Description | Expected Result |
|---|---|---|---|
| TC-FEEDQ-001 | Prefer extracted full text when clearly better | Mock extraction result as much longer than feed-provided content. | Feed quality flags set to use extracted full text; quality check timestamp updated. |
| TC-FEEDQ-002 | Keep extraction disabled when not better | Mock extraction result as short or low-value content. | Feed quality flags keep extracted full text disabled; quality check timestamp updated. |

### Article Content Extraction

| ID | Case | Description | Expected Result |
|---|---|---|---|
| TC-ART-001 | Extract main article body | Run article extraction on a fixture HTML page containing body and footer. | Main body text is included; footer text is excluded. |
| TC-ART-002 | Skip extraction on TLD mismatch | Evaluate optional article extraction for a feed URL and article URL with different TLDs. | Extraction is skipped, a warning includes both TLDs, and feed-provided content remains the chosen article text. |

### Media Thumbnail Extraction

| ID | Case | Description | Expected Result |
|---|---|---|---|
| TC-THUMB-001 | Parse `img src` with double quotes | Extract first image URL from HTML using `src="..."`. | Correct image URL is returned. |
| TC-THUMB-002 | Parse `img src` with single quotes | Extract first image URL from HTML using `src='...'`. | Correct image URL is returned. |
| TC-THUMB-003 | Use first image when multiple images exist | Provide HTML with two or more images. | URL of the first image is returned. |
| TC-THUMB-004 | Handle image tags with extra attributes | Provide image tag with class or size attributes. | Correct `src` URL is still extracted. |
| TC-THUMB-005 | No image present | Provide HTML with no image tag. | Result is `None`. |
| TC-THUMB-006 | Empty content | Provide empty HTML content. | Result is `None`. |
| TC-THUMB-007 | Null content | Provide `None` as content. | Result is `None`. |
| TC-THUMB-008 | Relative image URL | Provide image with relative path URL. | Relative URL is returned unchanged. |
| TC-THUMB-009 | Data URL image | Provide image with `data:` URL. | Data URL is returned. |
| TC-THUMB-010 | Case-insensitive `IMG` tag parsing | Provide uppercase image tag or attributes. | URL extraction still succeeds. |
| TC-THUMB-011 | Keep explicit thumbnail if provided | Create article with explicit `media_thumbnail` and image in body. | Explicit thumbnail remains unchanged. |
| TC-THUMB-012 | Fallback thumbnail from body image | Create article without explicit thumbnail but with body image. | Thumbnail is set from first body image. |
| TC-THUMB-013 | No thumbnail when body has no images | Create article with text-only body. | Thumbnail remains `None`. |
| TC-THUMB-014 | No thumbnail when body is missing | Create article with `None` content. | Thumbnail remains `None`. |
| TC-THUMB-015 | Feed integration for image extraction | Ingest feed fixture with image and no-image scenarios. | Thumbnails are extracted per article expectations. |

### Newsletter HTML Cleanup

| ID | Case | Description | Expected Result |
|---|---|---|---|
| TC-HTML-001 | Remove hidden content blocks | Input contains hidden div content used for previews or tracking. | Hidden content is removed; visible content remains. |
| TC-HTML-002 | Simplify layout tables | Input contains nested email layout tables. | Content is preserved while layout-specific table structure is stripped. |
| TC-HTML-003 | Remove meta tags | Input contains HTML `<meta>` tags. | Meta tags are removed from output. |
| TC-HTML-004 | Preserve semantic content structure | Input contains headings, paragraphs, and lists. | Structural tags and text content are preserved. |
| TC-HTML-005 | Clean complex newsletter markup | Input combines hidden sections, tables, and metadata. | Core readable content remains; clutter and tracking elements removed. |
| TC-HTML-006 | Handle empty HTML input | Input is empty string. | Output is empty string. |
| TC-HTML-007 | Handle null HTML input | Input is `None`. | Output is empty string. |
| TC-HTML-008 | Remove tracking pixels | Input includes tracking pixel images and normal content. | Tracking pixel URLs are removed; newsletter content remains. |

### Email and Newsletter Processing

| ID | Case | Description | Expected Result |
|---|---|---|---|
| TC-EMAIL-001 | Ingest unread IMAP emails into mailing-list feeds | Mock mailbox returns unseen list emails from two senders. | Two mailing-list feeds are created or updated with expected article counts. |
| TC-EMAIL-002 | Avoid duplicates on repeated updates | Run update cycle multiple times with the same mocked inputs. | Existing article GUID hashes are reused; duplicates are not inserted. |
| TC-EMAIL-003 | LLM multi-item newsletter splitting | Mock LLM response with `mode=multi` and two items. | Two separate articles are created with expected URLs and summaries. |
| TC-EMAIL-004 | LLM single-item newsletter shaping | Mock LLM response with `mode=single`, summary, and cleaned content. | One article is created with cleaned content and provided summary. |
| TC-EMAIL-005 | Remove only stale read and unstarred newsletter items | Dataset includes old/new, read/unread, starred/unstarred, and non-newsletter items. | Only old read unstarred newsletter items are deleted. |
| TC-EMAIL-006 | Run cleanup even without credentials | No mailbox credentials configured. | Cleanup function is still invoked exactly once. |

### Application API Test Cases

| ID | Case | Description | Expected Result |
|---|---|---|---|
| TC-API-001 | Health endpoint | Call `/status`. | Returns `200` with `{"status":"ok"}`. |
| TC-API-002 | Version endpoint | Call `/api/version`. | Returns `200` with API version payload. |
| TC-API-003 | Feed listing | Call `GET /api/feeds` with valid credentials. | Returns `200` with `feeds` payload. |
| TC-API-004 | Conditional auth enforcement | Call a protected API endpoint without credentials when auth env vars are set. | Returns `401` with `{"detail":"Not authenticated"}` and Basic auth challenge header. |
| TC-API-005 | Invalid credentials rejected | Call a protected endpoint with wrong Basic credentials. | Returns `401` with `{"detail":"Invalid authentication credentials"}`. |
| TC-API-006 | Feed create duplicate conflict | Call `POST /api/feeds` for an already existing feed URL. | Returns `409` conflict. |
| TC-API-007 | Feed create invalid folder | Call `POST /api/feeds` with a non-existent `folderId`. | Returns `422` validation error. |
| TC-API-008 | Feed create SSRF localhost block | Call `POST /api/feeds` with URL `http://127.0.0.1:...` when testing mode is disabled. | Returns `400` with SSRF protection error detail. |
| TC-API-009 | Feed create SSRF redirect block | Resolve a feed URL redirect target against a blocked localhost or private destination when testing mode is disabled. | Redirect validation rejects the blocked target before it is fetched. |
| TC-API-010 | Feed delete cascade | Call `DELETE /api/feeds/{feed_id}` for an existing feed with items. | Returns `200`, deletes feed, and deletes associated articles. |
| TC-API-011 | Feed move invalid folder | Call `POST /api/feeds/{feed_id}/move` with non-existent `folderId`. | Returns `422` validation error. |
| TC-API-012 | Feed rename success path | Call `POST /api/feeds/{feed_id}/rename` with `{"feedTitle": ...}`. | Returns `200` and updates feed title in storage. |
| TC-API-013 | Feed read success path | Call `POST /api/feeds/{feed_id}/read` with `{"newestItemId": ...}`. | Returns `200` and marks matching feed items as read. |
| TC-API-014 | Folder creation endpoint | Call `POST /api/folders` with a valid non-empty name. | Returns `200` with created folder in `folders` payload. |
| TC-API-015 | Folder duplicate-create conflict | Call `POST /api/folders` for an existing folder name. | Returns `409` with `{"detail":"Folder already exists"}`. |
| TC-API-016 | Folder rename invalid-name validation | Call `PUT /api/folders/{folder_id}` with an empty name. | Returns `422` validation error. |
| TC-API-017 | Folder delete cascade | Call `DELETE /api/folders/{folder_id}` for a folder containing feeds and items. | Returns `200`, deletes folder, deletes feeds in folder, and deletes their articles. |
| TC-API-018 | Folder read side effect | Seed a feed/article in a non-root folder and call `POST /api/folders/{folder_id}/read`. | Returns `200` and matching folder items are marked `unread=false`. |
| TC-API-019 | Items listing | Call `GET /api/items` with valid selection parameters. | Returns `200` with `items` payload and current item fields. |
| TC-API-020 | Items invalid type validation | Call `GET /api/items?type=99&id=0`. | Returns `400` with invalid selection detail. |
| TC-API-021 | Items unread filtering | Call `GET /api/items?type=3&id=0&getRead=false` with mixed read/unread items. | Returns only unread items. |
| TC-API-022 | Items folder selection | Call `GET /api/items?type=1&id={folder_id}` with items in and out of that folder. | Returns only items whose feeds belong to the specified folder. |
| TC-API-023 | Items starred selection | Call `GET /api/items?type=2&id=0` with mixed starred/unstarred items. | Returns only starred items. |
| TC-API-024 | Updated-items filtering | Call `GET /api/items/updated?lastModified={ts}&type=3&id=0`. | Returns only items meeting `lastModified` criteria. |
| TC-API-025 | Item content missing | Call `GET /api/items/{item_id}/content` for a missing item ID. | Returns `404` with `{"detail":"Item not found"}`. |
| TC-API-026 | Mark multiple read | Call `POST /api/items/read/multiple` with `{"itemIds": [...]}`. | Returns `200` and marks targeted items as read. |
| TC-API-027 | Mark multiple unread | Call `POST /api/items/unread/multiple` with `{"itemIds": [...]}` after marking items read. | Returns `200` and marks targeted items unread. |
| TC-API-028 | Star multiple items | Call `POST /api/items/star/multiple` with `{"itemIds": [...]}`. | Returns `200` and marks targeted items starred. |
| TC-API-029 | Unstar multiple items | Call `POST /api/items/unstar/multiple` with `{"itemIds": [...]}` after starring items. | Returns `200` and clears starred state. |
| TC-API-030 | Mark all read boundary behavior | Call `POST /api/items/read` with `{"newestItemId":id}`. | Returns `200`; matching items are marked `unread=false` and `lastModified` increases. |
| TC-API-031 | Single item read state update | Call `POST /api/items/{item_id}/read` for an unread item. | Returns `200`; item is marked `unread=false` and `lastModified` increases. |
| TC-API-032 | Single item unread state update | Call `POST /api/items/{item_id}/unread` for a read item. | Returns `200`; item is marked `unread=true` and `lastModified` increases. |
| TC-API-033 | Single item star state update | Call `POST /api/items/{item_id}/star` for an unstarred item. | Returns `200`; item is marked `starred=true` and `lastModified` increases. |
| TC-API-034 | Single item unstar state update | Call `POST /api/items/{item_id}/unstar` for a starred item. | Returns `200`; item is marked `starred=false` and `lastModified` increases. |

### Ingestion and Update Pipeline Test Cases

| ID | Case | Description | Expected Result |
|---|---|---|---|
| TC-PIPE-001 | Updater inserts new entries | Seed a due feed row and run updater cycle against a valid fixture feed URL. | Due feed is processed, new article rows are inserted, and update error count remains `0`. |
| TC-PIPE-002 | Updater persists update errors | Seed a due feed row with an invalid or blocked URL and run updater cycle. | Feed `update_error_count` increments and `last_update_error` is populated. |
| TC-PIPE-003 | Add-email-credentials success persistence | Run add-email-credentials persistence flow with validator success. | Credentials row is inserted into `email_credentials`. |
| TC-PIPE-004 | Add-email-credentials validation gate | Run add-email-credentials persistence flow with validator failure. | Command path fails and no credential row is persisted. |
| TC-PIPE-005 | Updater skips mailing-list feeds | Seed a due feed row with `is_mailing_list=1` and run updater cycle. | Row is excluded from web-feed updates, and update error fields remain unchanged. |
| TC-PIPE-006 | Feed ingest thumbnail fallback | Add a feed whose entry body HTML contains an `<img>` and no explicit feed thumbnail. | Inserted article stores `media_thumbnail` from the first body image URL. |
| TC-PIPE-007 | Updater stale-article cleanup gate | Seed feed articles spanning stale/fresh, read/unread, starred/unstarred, and in-payload/not-in-payload states; run due-feed update. | Only articles older than 90 days that are read, unstarred, and absent from the latest payload are deleted. |
| TC-PIPE-008 | Readability article extraction | Run article extraction on fixture HTML containing article body and footer. | Extracted HTML contains the main article body and excludes footer boilerplate. |
| TC-PIPE-009 | Feed quality enables extraction | Run updater against a feed whose sampled article extracts to content much longer than the feed summary. | Feed flags persist `use_extracted_fulltext=true`, `use_llm_summary=false`, and `last_quality_check` is updated. |
| TC-PIPE-010 | Feed quality rejects weak extraction | Run updater against a feed whose sampled article extraction is not substantially better than the feed summary. | Feed flags persist `use_extracted_fulltext=false`, `use_llm_summary=false`, and `last_quality_check` is updated. |
| TC-PIPE-011 | Non-LLM summary fallback | Generate an article summary for long content while LLM summarization is disabled. | Summary falls back to the first 160 characters plus `...`. |
| TC-PIPE-012 | LLM summary suffix | Generate an article summary from an LLM result. | Persisted/generated summary ends with ` (AI generated)`. |
| TC-PIPE-013 | LLM summary prompt constraints | Build the article-summary payload. | The prompt requests a 2-3 sentence newspaper-style summary in the same language as the article and keeps the structured `summary` response contract. |
| TC-PIPE-014 | Mock OpenAI journey summary | Add a feed whose article is fetched from a local fixture and whose summary is generated from a mock OpenAI-compatible endpoint. | The running service stores extracted article content and returns the mocked summary with the ` (AI generated)` suffix through the item APIs. |
| TC-PIPE-015 | Heuristic feed-summary quality flag | Run updater without LLM support against a feed whose summary is just the normalized prefix of the chosen article text. | Feed flags persist `use_extracted_fulltext=false` and `use_llm_summary=true`. |
| TC-PIPE-016 | LLM summary-quality accepts good feed summary | Run updater with LLM support against a feed whose summary-quality check returns `is_good=true`. | Feed flags persist `use_llm_summary=false` and keep feed summaries for that feed. |
| TC-PIPE-017 | LLM summary-quality rejects weak feed summary | Run updater with LLM support against a feed whose summary-quality check returns `is_good=false`. | Feed flags persist `use_llm_summary=true`. |
| TC-PIPE-018 | LLM failure falls back to truncation | Generate an article summary for long content with LLM summarization enabled but no usable LLM summary returned. | Summary falls back to the first 160 characters plus `...`. |
| TC-PIPE-019 | Duplicate feed item skips enrichment work | Seed an existing article GUID-hash, enable extraction and LLM summary for the feed, then run a due-feed update with the same entry in the payload. | The duplicate entry is skipped without making article-extraction or LLM summarization requests. |
| TC-PIPE-020 | Structured summary parser normalizes schema-name wrappers | Parse structured LLM summary and summary-quality responses that wrap fields under their schema name instead of returning bare top-level fields. | The parser accepts both wrapped and top-level structured responses and extracts the expected `summary` or `is_good` value. |
| TC-PIPE-021 | Article extraction emits observability log | Trigger article extraction through feed quality sampling or new-article enrichment. | The service logs article extraction at `INFO` with `feed_id`, `article_id`, and `loaded_url`. |
| TC-PIPE-022 | Newsletter mailbox ingestion | Seed IMAP credentials and feed mock unread mailing-list messages through the newsletter updater path. | Mailing-list feeds are created, non-list mail is ignored, and newsletter articles are persisted without duplicates. |
| TC-PIPE-023 | Newsletter HTML cleanup | Process an HTML newsletter containing hidden blocks, meta tags, layout tables, and tracking pixels. | Persisted newsletter content removes hidden/tracking markup while preserving readable content. |
| TC-PIPE-024 | Newsletter LLM multi-item split | Build newsletter articles from a mocked LLM parse result with `mode=multi`. | Up to 25 URL-backed items are converted into separate persisted articles with expected URLs and summaries. |
| TC-PIPE-025 | Newsletter LLM single-item mode | Build newsletter articles from a mocked LLM parse result with `mode=single`. | A single persisted article uses the cleaned LLM content and summary. |
| TC-PIPE-026 | Newsletter stale cleanup gate | Seed newsletter and non-newsletter articles across old/new, read/unread, and starred/unstarred states. | Only stale read unstarred newsletter articles are deleted. |
| TC-PIPE-027 | Newsletter cleanup without credentials | Run the newsletter updater path with no stored mailbox credentials. | No fetch is attempted and stale newsletter cleanup still executes successfully. |
| TC-PIPE-028 | Mocked newsletter journey | Run the CLI credential command and update command with a test-only mocked IMAP mailbox file. | Newsletter feed/items are created through the full subprocess path without requiring a real mailbox. |
| TC-PIPE-029 | Newsletter parser falls back to single mode | Normalize an LLM newsletter parse result that provides fewer than two distinct usable item URLs. | Result is coerced to `single`, uses cleaned fallback content, and supplies a concise summary. |
| TC-PIPE-030 | Newsletter parser deduplicates multi-item links | Normalize an LLM newsletter parse result with duplicate item URLs and at least two distinct links. | Duplicate URLs are discarded and the result remains `multi` only when at least two distinct links remain. |
| TC-PIPE-031 | Newsletter success clears stale feed errors | Seed a mailing-list feed with non-zero `update_error_count` and `last_update_error`, then process a valid newsletter email for that feed. | Newsletter article persistence succeeds and the feed error fields reset to `0` and `NULL`. |
| TC-PIPE-032 | Newsletter structured parser normalizes schema-name wrapper | Parse a structured LLM newsletter response that wraps fields under `newsletter_parse` instead of returning bare top-level fields. | The parser accepts both wrapped and top-level newsletter responses and extracts the expected mode and items. |
| TC-PIPE-033 | Forced feed-quality re-evaluation command path | Trigger the dedicated feed-quality re-evaluation path for a regular feed whose last quality check is still fresh. | Feed quality flags and timestamp are refreshed immediately, while `next_update_time` and article rows remain unchanged. |
| TC-PIPE-034 | Forced feed-quality re-evaluation missing feed | Trigger the dedicated feed-quality re-evaluation path for a non-existent feed ID. | The command path fails with a user-visible `feed {id} not found` error. |
| TC-PIPE-035 | Manual feed-quality override locks only selected attribute | Run the manual feed-quality command for a regular feed while setting only one of the two quality flags. | The selected attribute persists as a manual override, the effective flag is updated immediately, the other attribute remains automatic, and both quality-check/manual-override timestamps are updated. |
| TC-PIPE-036 | Forced re-evaluation clears manual feed-quality overrides | Seed a regular feed with manual overrides for one or both quality flags, then run the forced feed-quality re-evaluation command. | Manual override fields are cleared, the quality flags are recomputed from current feed content, and `next_update_time` remains unchanged. |

### Database Bootstrap Test Cases

| ID | Case | Description | Expected Result |
|---|---|---|---|
| TC-DB-001 | SQLx migration bootstrap | Create a new SQLite file and initialize the pool via `create_pool`. | SQLx baseline migration is applied, core tables are created, and root folder `id=0` exists with `is_root=1`. |
