# Not-found pages

Unknown hash routes and ordinary unknown document paths display the shared site header, footer, typography and theme, with links to the homepage and portfolio. Unknown physical paths use an absolute document base so nested URLs can load the application assets. Home navigation leaves the unknown document path instead of merely changing its hash.

The API application's web handler serves the application shell with HTTP 404, `no-store` and `noindex` for missing HTML document navigations. Unknown API, uploads, assets, dot paths and extension-bearing asset requests retain their JSON 404 response. Analytics records the missing physical path without its query string.

Static regional servers have their own HTTP fallback configuration. The frontend can render the error page when they serve its shell, but this change does not by itself change those servers' HTTP status or fallback policy. Validate document status and fallback behavior on every serving layer during release acceptance.
