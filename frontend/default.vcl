vcl 4.0;

backend default {
    .host = "127.0.0.1";
    .port = "3001";
}

sub vcl_recv {
    if (req.method != "GET" && req.method != "HEAD") {
        return (pass);
    }

    if (req.url ~ "^/\.well-known(?:/security\.txt)?(?:\?.*)?$") {
        return (synth(308, "Permanent Redirect"));
    }

    if (req.url ~ "^/security\.txt(?:\?.*)?$") {
        return (synth(200, "OK"));
    }

    if (req.url ~ "^/api(?:[/?#]|$)") {
        return (pass);
    }

    if (req.url ~ "^/(ti|dwm)(?:[/?#]|$)") {
        return (pass);
    }

    if (req.url ~ "^/s(?:[/?#]|$)") {
        return (pass);
    }

    if (req.url ~ "^/(?:dashboard|browser|profile)(?:[/?#]|$)"
        || req.url ~ "^/(?:scanner|vms|db/backups|automation/health)(?:[/?#]|$)") {
        # Authenticated HTML routes and their public aliases are safe to cache
        # only when the complete session cookie is part of the hash. API
        # requests remain uncached.
        if (!(req.http.Cookie ~ "(^|; )access_token=") || !(req.http.Cookie ~ "(^|; )id=")) {
            return (pass);
        }
    } else if (req.http.Cookie ~ "(^|; )access_token=" || req.http.Cookie ~ "(^|; )id=" || req.url ~ "^/(role|ai)(/|$)") {
        return (pass);
    }

    if (req.http.Cookie) {
        set req.http.X-Theme = regsub(req.http.Cookie, ".*theme=([^;]+);?.*", "\1");
    }
    return (hash);
}

sub vcl_synth {
    if (req.url ~ "^/\.well-known(?:/security\.txt)?(?:\?.*)?$") {
        set resp.http.Location = "https://hanasand.com/security.txt";
        set resp.http.Cache-Control = "public, max-age=31449600";
        return (deliver);
    }

    if (req.url ~ "^/security\.txt(?:\?.*)?$") {
        set resp.http.Content-Type = "text/plain; charset=utf-8";
        set resp.http.Cache-Control = "public, max-age=31449600";
        synthetic({"Contact: mailto:security@hanasand.com
Canonical: https://hanasand.com/security.txt
Preferred-Languages: en
Expires: 2027-10-04T00:00:00Z
"});
        return (deliver);
    }
}

sub vcl_hash {
    # Hash theme and the complete authenticated session for general pages so
    # cached HTML cannot cross users, tenants, impersonation targets or roles.
    hash_data(req.http.X-Theme);
    if (req.url ~ "^/(?:dashboard|browser)(?:[/?#]|$)"
        || req.url ~ "^/(?:scanner|vms|db/backups|automation/health)(?:[/?#]|$)") {
        hash_data(req.http.Cookie);
    } else if (req.url ~ "^/profile(?:[/?#]|$)") {
        # Profile SSR reads these cookies. Ignore unrelated browser cookies
        # that can change between otherwise identical page requests.
        hash_data(regsub(req.http.Cookie + "; id=__cache_missing__", "(^|; )id=([^;]*)", "\2"));
        hash_data(regsub(req.http.Cookie + "; access_token=__cache_missing__", "(^|; )access_token=([^;]*)", "\2"));
        hash_data(regsub(req.http.Cookie + "; name=__cache_missing__", "(^|; )name=([^;]*)", "\2"));
        hash_data(regsub(req.http.Cookie + "; avatar=__cache_missing__", "(^|; )avatar=([^;]*)", "\2"));
        hash_data(regsub(req.http.Cookie + "; roles=__cache_missing__", "(^|; )roles=([^;]*)", "\2"));
        hash_data(regsub(req.http.Cookie + "; dashboard_view_mode=__cache_missing__", "(^|; )dashboard_view_mode=([^;]*)", "\2"));
        hash_data(regsub(req.http.Cookie + "; dashboard_navigation=__cache_missing__", "(^|; )dashboard_navigation=([^;]*)", "\2"));
        hash_data(regsub(req.http.Cookie + "; hanasand_workspace=__cache_missing__", "(^|; )hanasand_workspace=([^;]*)", "\2"));
        hash_data(regsub(req.http.Cookie + "; impersonation_token=__cache_missing__", "(^|; )impersonation_token=([^;]*)", "\2"));
        hash_data(regsub(req.http.Cookie + "; impersonating_id=__cache_missing__", "(^|; )impersonating_id=([^;]*)", "\2"));
        hash_data(regsub(req.http.Cookie + "; impersonating_name=__cache_missing__", "(^|; )impersonating_name=([^;]*)", "\2"));
    }
}

sub vcl_backend_response {
    if (bereq.url ~ "^/$" && beresp.status == 200 && !(bereq.http.Cookie ~ "(^|; )access_token=") && !(bereq.http.Cookie ~ "(^|; )id=")) {
        # The public homepage is safe to cache even though the shared Next
        # layout reads cookies and headers. Authenticated requests already
        # pass in vcl_recv; theme cookies are part of the cache hash.
        unset beresp.http.Set-Cookie;
        set beresp.ttl = 5m;
        set beresp.grace = 30s;
        set beresp.http.Cache-Control = "public, max-age=5, stale-while-revalidate=30";
        return (deliver);
    } else if (bereq.url ~ "^/(?:dashboard/)?automation/health(?:[/?#]|$)"
        && bereq.is_bgfetch && beresp.status >= 500) {
        # Keep the last session-specific page if its background refresh fails.
        return (abandon);
    } else if (bereq.url ~ "^/(?:dashboard/)?automation/health(?:[/?#]|$)"
        && beresp.status == 200) {
        # Keep the session-keyed page available while a slow refresh completes.
        # Varnish serves this grace object immediately and fetches a replacement
        # in the background after the 15-second fresh lifetime.
        set beresp.ttl = 15s;
        set beresp.grace = 52w;
        return (deliver);
    } else if (bereq.url ~ "^/profile(?:[/?#]|$)" && beresp.status == 200) {
        # Profile HTML is streamed. Keep it fresh long enough for the complete
        # response to enter Varnish before the session's next navigation.
        set beresp.ttl = 1m;
        return (deliver);
    } else if ((bereq.url ~ "^/(?:dashboard|browser)(?:[/?#]|$)"
        || bereq.url ~ "^/(?:scanner|vms|db/backups)(?:[/?#]|$)")
        && beresp.status == 200) {
        # Next marks cookie-aware dynamic pages private. These pages are safe
        # because vcl_hash includes the authenticated session cookie.
        # Set-Cookie is safe to replay only for that same session key.
        set beresp.ttl = 5s;
        return (deliver);
    } else if (beresp.http.Set-Cookie) {
        set beresp.uncacheable = true;
        set beresp.ttl = 0s;
        return (deliver);
    } else if (beresp.http.Cache-Control ~ "(?i)(no-cache|no-store|private)") {
        set beresp.uncacheable = true;
        set beresp.ttl = 0s;
    } else {
        set beresp.ttl = 52w;
    }
    return (deliver);
}

sub vcl_deliver {
    set resp.http.Via = "Varnish Hanasand Cache";

    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT:" + obj.hits;
    } else {
        set resp.http.X-Cache = "MISS";
    }

    return (deliver);
}
