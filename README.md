# Easel (native SwiftUI)

A native macOS port of Easel, the Canvas LMS client. This replaces the
Tauri (Rust + React) stack with a pure Swift/SwiftUI app while keeping the same
authentication model and Canvas API behavior.

## Build & run

The Xcode project is generated from `project.yml` with
[XcodeGen](https://github.com/yonyz/XcodeGen) (it is **not** checked in):

```sh
brew install xcodegen          # once
cd apple
xcodegen generate              # writes Easel.xcodeproj
open Easel.xcodeproj           # or: xcodebuild -scheme Easel build
```

Requirements: macOS 14+, Xcode 16+ (built with Xcode 26 / Swift 6.2).

## How it maps to the original

| Concern | Original (Tauri) | Native port |
| --- | --- | --- |
| SSO login | Rust opens a `WebviewWindow` at `/login`, harvests cookies | `LoginWebView` (`WKWebView`) + `WKHTTPCookieStore` harvest |
| Session storage | macOS Keychain (release) / JSON (debug) | `SessionStore` → Keychain (`Security`) always |
| API transport | `reqwest` cookie jar | `CanvasClient` actor over `URLSession` (ephemeral cookie jar) |
| CSRF | `X-CSRF-Token` + refresh/retry on 401/403/422 | identical logic in `CanvasClient.request` |
| Pagination | `Link: rel="next"` follow, 50-page cap | `CanvasClient.getAll` |
| State | Zustand + TanStack Query | `@Observable` `AuthManager` / `AppData` / `Prefs` |
| Routing | TanStack Router | `NavigationSplitView` + `NavigationStack` |
| Canvas HTML | DOMPurify + `dangerouslySetInnerHTML` | `CanvasHTMLView` (`NSAttributedString` → `AttributedString`) |

## Auth flow (the critical path)

1. `LoginView` collects a Canvas domain and presents `LoginWebView`.
2. The web view loads `https://{domain}/login`; the user completes SSO
   (e.g. Duke Shibboleth) in the embedded browser.
3. On the post-SSO redirect away from `/login`, the navigation delegate harvests
   **all** cookies (including HttpOnly session cookies) from the web data store,
   capturing `_csrf_token` and requiring a `_normandy_session`/`canvas_session`
   cookie as proof of a completed login.
4. The resulting `Session` is saved to the Keychain and seeded into the
   `CanvasClient` cookie jar; subsequent API calls are authenticated.
5. On launch, `AuthManager.bootstrap()` reloads any stored session. Logout
   POSTs `/logout`, clears the Keychain, and wipes `WKWebsiteDataStore` so the
   IdP session is also cleared.

## Layout

```
Easel/
  App/            App entry + root auth gate
  Auth/           AuthManager, SessionStore (Keychain), LoginWebView
  Networking/     CanvasClient (transport), CanvasAPI (typed endpoints)
  Models/         Session + Codable Canvas models
  Stores/         AppData (course/user cache), Prefs (local UI prefs)
  Util/           Formatters, ContextCode helpers
  Views/          Login, AppShell, Dashboard, Courses, Calendar, Inbox,
                  Announcements, and Course/ (tabbed course workspace)
```
