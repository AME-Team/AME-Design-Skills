"""GitHub REST/GraphQL API 共通クライアント（main.py/reply.py/pr_streak.py 共通）."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, cast


class HttpError(RuntimeError):
    """GitHub API の HTTP エラー。ステータスコードを保持する."""

    def __init__(self, status_code: int, message: str) -> None:
        """HTTP ステータスコードとメッセージを保持する."""
        super().__init__(message)
        self.status_code = status_code


_REVIEW_THREADS_QUERY = """
query($owner: String!, $repo: String!, $pr: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          comments(first: 100) {
            nodes { databaseId }
          }
        }
      }
    }
  }
}
"""

_RESOLVE_THREAD_MUTATION = """
mutation($threadId: ID!) {
  resolveReviewThread(input: {threadId: $threadId}) {
    thread { id isResolved }
  }
}
"""


def resolve_env() -> tuple[str, str]:
    """GITHUB_API_URL と GITHUB_REPOSITORY を解決する."""
    api_url = os.environ.get("GITHUB_API_URL", "https://api.github.com")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        msg = "GITHUB_REPOSITORY environment variable is required"
        raise RuntimeError(msg)
    return api_url, repo


def _graphql_url() -> str:
    return os.environ.get("GITHUB_GRAPHQL_URL", "https://api.github.com/graphql")


def get_token(token_file: str, env_key: str = "GITHUB_PAT_TOKEN") -> str:
    """トークンファイル → 環境変数の優先順位でトークンを解決する."""
    path = Path(token_file).expanduser()
    if path.is_file():
        token = path.read_text(encoding="utf-8").strip()
        if token:
            return token
    token = os.environ.get(env_key, "").strip()
    if token:
        return token
    msg = f"GitHub token not found: {path} or ${env_key}"
    raise RuntimeError(msg)


def bot_login(name: str) -> str:
    """GitHub App slug から bot の実際の login 名を返す.

    例: ``ame-ai-reviewer`` → ``ame-ai-reviewer[bot]``。
    本関数は GitHub App 運用を前提とする。すでに ``[bot]`` 付きの名前を渡した場合は
    二重付与を防ぐためそのまま返す。
    """
    return name if name.endswith("[bot]") else f"{name}[bot]"


def mentions_reviewer(body: str, name: str) -> bool:
    """コメント本文がレビュアーへのメンションを含むかを判定する.

    GitHub App 運用時は ``@{slug}[bot]`` が正式形式だが、``@{slug}`` (``[bot]`` なし) でも
    GitHub 側で通知される場合があるため、両方の形式を受け入れる。
    """
    return f"@{name}" in body or f"@{bot_login(name)}" in body


def http_request(
    method: str,
    url: str,
    token: str,
    body: dict[str, Any] | None = None,
    accept: str = "application/vnd.github+json",
) -> Any:
    """GitHub REST/GraphQL 共通の HTTP 呼び出し."""
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", accept)
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        msg = f"GitHub API error {e.code} for {method} {url}: {detail}"
        raise HttpError(e.code, msg) from e
    if not raw:
        return None
    if accept == "application/vnd.github.diff":
        return raw
    return json.loads(raw)


def graphql_request(
    query: str, variables: dict[str, Any], token: str
) -> dict[str, Any]:
    """GraphQL リクエスト。HTTP 200 でも errors 配列を持ちうるため明示チェックする."""
    body = {"query": query, "variables": variables}
    result: object = http_request("POST", _graphql_url(), token, body=body)
    if not isinstance(result, dict):
        msg = f"Unexpected GraphQL response: {result!r}"
        raise TypeError(msg)
    result_dict = cast("dict[str, Any]", result)
    errors = result_dict.get("errors")
    if errors:
        msg = f"GraphQL errors: {errors}"
        raise RuntimeError(msg)
    data = result_dict.get("data")
    if not isinstance(data, dict):
        msg = f"Unexpected GraphQL response (no data): {result!r}"
        raise TypeError(msg)
    return cast("dict[str, Any]", data)


def list_review_threads(pr_number: int, token: str) -> list[dict[str, Any]]:
    """PR の全レビュースレッド（isResolved・コメント databaseId 含む）を取得する."""
    _, repo = resolve_env()
    owner, name = repo.split("/", 1)
    threads: list[dict[str, Any]] = []
    after: str | None = None
    while True:
        data = graphql_request(
            _REVIEW_THREADS_QUERY,
            {"owner": owner, "repo": name, "pr": pr_number, "after": after},
            token,
        )
        page = data["repository"]["pullRequest"]["reviewThreads"]
        threads.extend(page["nodes"])
        if not page["pageInfo"]["hasNextPage"]:
            break
        after = page["pageInfo"]["endCursor"]
    return threads


def resolve_review_thread(pr_number: int, comment_id: int, token: str) -> None:
    """comment_id を含むスレッドを特定し GraphQL mutation で Resolve する.

    GitHub REST にはスレッド Resolve に相当するエンドポイントが存在しないため GraphQL を使う。
    """
    for thread in list_review_threads(pr_number, token):
        ids = {c.get("databaseId") for c in thread["comments"]["nodes"]}
        if comment_id in ids:
            graphql_request(_RESOLVE_THREAD_MUTATION, {"threadId": thread["id"]}, token)
            return
    msg = f"Review thread not found for comment {comment_id}"
    raise RuntimeError(msg)
