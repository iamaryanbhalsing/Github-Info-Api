var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function j(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS_HEADERS),
  });
}

function safeStr(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return null;
}

function safeNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    var n = Number(v);
    return isNaN(n) ? null : n;
  }
  return null;
}

function safeBool(v) {
  if (v === true || v === false) return v;
  if (typeof v === "string") return v === "true" || v === "1";
  return null;
}

function fmtDate(iso) {
  if (!iso) return null;
  return iso;
}

function xRepo(r) {
  return {
    name: r.name,
    full_name: r.full_name,
    description: r.description || null,
    url: r.html_url,
    homepage: r.homepage || null,
    language: r.language || null,
    topics: r.topics && r.topics.length > 0 ? r.topics : null,
    private: r.private,
    fork: r.fork,
    archived: r.archived,
    disabled: r.disabled,
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    watchers: r.watchers_count || 0,
    open_issues: r.open_issues_count || 0,
    license: r.license ? r.license.spdx_id : null,
    size: r.size || 0,
    default_branch: r.default_branch || null,
    created_at: fmtDate(r.created_at),
    updated_at: fmtDate(r.updated_at),
    pushed_at: fmtDate(r.pushed_at),
  };
}

async function handleRequest(request) {
  var url = new URL(request.url);
  var path = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS_HEADERS });
  }

  if (path === "/" || path === "") {
    return j({
      service: "GitHub Profile Scraper v1.0",
      note: "Zero config. Copy, Paste, Deploy.",
      endpoints: {
        "/info?user=<username>": "Full profile info with recent repos",
        "/info?user=<username>&repos=false": "Profile only, no repos",
        "/repos?user=<username>": "List all public repos",
      },
    });
  }

  if (path === "/repos") {
    var userName = url.searchParams.get("user");
    if (!userName) {
      return j({ error: "missing_user", message: "Provide ?user=<username>" }, 400);
    }
    userName = userName.trim();

    try {
      var repoResp = await fetch("https://api.github.com/users/" + encodeURIComponent(userName) + "/repos?per_page=100&sort=updated", {
        headers: { "User-Agent": "gh-scraper-cf-worker", "Accept": "application/vnd.github.v3+json" },
      });
      if (repoResp.status === 404) {
        return j({ error: "not_found", message: "GitHub user not found: " + userName }, 404);
      }
      if (repoResp.status === 403) {
        return j({ error: "rate_limited", message: "GitHub API rate limit exceeded. Try again later." }, 429);
      }
      var repos = await repoResp.json();
      if (!Array.isArray(repos)) {
        return j({ error: "api_error", message: "Unexpected response from GitHub API" }, 502);
      }

      return j({
        success: true,
        username: userName,
        repos: repos.map(xRepo),
        repo_count: repos.length,
        fetched_at: new Date().toISOString(),
      });
    } catch (e) {
      return j({ error: "fetch_failed", message: e.message }, 500);
    }
  }

  if (path === "/info") {
    var userName = url.searchParams.get("user");
    var fetchRepos = url.searchParams.get("repos") !== "false";

    if (!userName) {
      return j({ error: "missing_user", message: "Provide ?user=<username> (e.g., ?user=ftgamer2)" }, 400);
    }

    userName = userName.trim().replace(/^@/, "");

    try {
      var userResp = await fetch("https://api.github.com/users/" + encodeURIComponent(userName), {
        headers: { "User-Agent": "gh-scraper-cf-worker", "Accept": "application/vnd.github.v3+json" },
      });

      if (userResp.status === 404) {
        return j({ error: "not_found", message: "GitHub user not found: " + userName }, 404);
      }
      if (userResp.status === 403) {
        return j({ error: "rate_limited", message: "GitHub API rate limit exceeded. Try again later." }, 429);
      }

      var userData = await userResp.json();

      var profile = {
        username: userData.login,
        id: userData.id,
        node_id: userData.node_id,
        name: userData.name || null,
        avatar_url: userData.avatar_url,
        gravatar_id: userData.gravatar_id || null,
        url: userData.html_url,
        api_url: userData.url,
        bio: userData.bio || null,
        location: userData.location || null,
        company: userData.company || null,
        blog: userData.blog || null,
        email: userData.email || null,
        twitter_username: userData.twitter_username || null,
        hireable: safeBool(userData.hireable),
        type: userData.type,
        site_admin: safeBool(userData.site_admin),
        public_repos: userData.public_repos || 0,
        public_gists: userData.public_gists || 0,
        followers: userData.followers || 0,
        following: userData.following || 0,
        account_created_at: fmtDate(userData.created_at),
        profile_updated_at: fmtDate(userData.updated_at),
      };

      var repos = null;
      if (fetchRepos) {
        var repoResp = await fetch("https://api.github.com/users/" + encodeURIComponent(userName) + "/repos?per_page=20&sort=updated", {
          headers: { "User-Agent": "gh-scraper-cf-worker", "Accept": "application/vnd.github.v3+json" },
        });
        if (repoResp.ok) {
          var repoData = await repoResp.json();
          if (Array.isArray(repoData)) {
            repos = repoData.map(xRepo);
          }
        }
      }

      return j({
        success: true,
        profile: profile,
        repos: repos,
        repos_fetched: repos ? repos.length : 0,
        fetched_at: new Date().toISOString(),
      });

    } catch (e) {
      return j({ error: "fetch_failed", message: e.message }, 500);
    }
  }

  return j({ error: "not_found", message: "Use /info?user=<username> or /repos?user=<username>" }, 404);
}

addEventListener("fetch", function(event) {
  event.respondWith(handleRequest(event.request));
});
// src by @ftgamer2 🐱‍👤
